import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Message } from "./core/types.ts";
import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

const CHECKPOINT_VERSION = 1;
const MAX_CHECKPOINT_BYTES = 64_000;

export interface SummaryCheckpoint {
  version: number;
  workspaceDigest: string;
  historyCount: number;
  historyDigest: string;
  summary: string;
  updatedAt: number;
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serializeHistory(messages: Message[]): string {
  return JSON.stringify(messages.map(({ role, content }) => ({ role, content })));
}

async function checkpointPath(sessionId: string): Promise<string> {
  return join(appDataDir(), "context-summaries", `${await digest(sessionId)}.json`);
}

function validateCheckpoint(value: unknown): SummaryCheckpoint {
  if (!value || typeof value !== "object") throw new Error("Invalid context summary checkpoint");
  const checkpoint = value as Record<string, unknown>;
  if (
    checkpoint.version !== CHECKPOINT_VERSION ||
    typeof checkpoint.workspaceDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(checkpoint.workspaceDigest) ||
    !Number.isSafeInteger(checkpoint.historyCount) || Number(checkpoint.historyCount) < 1 ||
    typeof checkpoint.historyDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(checkpoint.historyDigest) ||
    typeof checkpoint.summary !== "string" || !checkpoint.summary.trim() ||
    checkpoint.summary.length > MAX_CHECKPOINT_BYTES ||
    !Number.isFinite(checkpoint.updatedAt)
  ) throw new Error("Invalid context summary checkpoint");
  return checkpoint as unknown as SummaryCheckpoint;
}

/** Load a summary only when it covers the exact current history prefix and workspace. */
export async function loadSummaryCheckpoint(
  sessionId: string,
  workspace: string,
  history: Message[],
): Promise<SummaryCheckpoint | undefined> {
  const path = await checkpointPath(sessionId);
  let checkpoint: SummaryCheckpoint;
  try {
    const raw = await readUtf8(path);
    if (raw.length > MAX_CHECKPOINT_BYTES * 2) {
      throw new Error("Context summary checkpoint too large");
    }
    checkpoint = validateCheckpoint(JSON.parse(raw));
  } catch (error) {
    if (isNotFound(error)) return undefined;
    await unlink(path).catch(() => {});
    return undefined;
  }
  const valid = checkpoint.workspaceDigest === await digest(workspace) &&
    checkpoint.historyCount <= history.length &&
    checkpoint.historyDigest ===
      await digest(serializeHistory(history.slice(0, checkpoint.historyCount)));
  if (!valid) {
    await unlink(path).catch(() => {});
    return undefined;
  }
  return checkpoint;
}

export async function saveSummaryCheckpoint(
  sessionId: string,
  workspace: string,
  history: Message[],
  historyCount: number,
  summary: string,
): Promise<void> {
  if (
    !Number.isSafeInteger(historyCount) || historyCount < 1 || historyCount > history.length ||
    !summary.trim() || summary.length > MAX_CHECKPOINT_BYTES
  ) return;
  const checkpoint: SummaryCheckpoint = {
    version: CHECKPOINT_VERSION,
    workspaceDigest: await digest(workspace),
    historyCount,
    historyDigest: await digest(serializeHistory(history.slice(0, historyCount))),
    summary,
    updatedAt: Date.now(),
  };
  await writeJsonAtomic(await checkpointPath(sessionId), checkpoint);
}
