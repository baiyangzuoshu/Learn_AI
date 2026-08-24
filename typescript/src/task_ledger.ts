import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type TaskState = "planned" | "running" | "verified" | "blocked";

export interface TaskEvidence {
  id: string;
  summary: string;
  checkpoint: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  state: TaskState;
  evidence: TaskEvidence[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  idempotencyKeys: string[];
}

const MAX_TASKS = 100;
const MAX_GOAL_LENGTH = 1_000;
const MAX_EVIDENCE = 100;
const MAX_EVIDENCE_LENGTH = 4_000;

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function ledgerPath(workspace: string): Promise<string> {
  return `${appDataDir()}/task-ledger/${await workspaceKey(workspace)}.json`;
}

function validIdempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(value)) throw new Error("idempotency_key 无效");
  return value;
}

function validateTask(raw: unknown): TaskRecord {
  if (!raw || typeof raw !== "object") throw new Error("任务账本记录无效");
  const value = raw as Record<string, unknown>;
  const state = String(value.state ?? "") as TaskState;
  if (!["planned", "running", "verified", "blocked"].includes(state)) {
    throw new Error("任务状态无效");
  }
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.map((item) => {
      if (!item || typeof item !== "object") throw new Error("任务证据无效");
      const entry = item as Record<string, unknown>;
      const summary = String(entry.summary ?? "").trim();
      if (!summary || summary.length > MAX_EVIDENCE_LENGTH) throw new Error("任务证据过长或为空");
      return {
        id: String(entry.id ?? ""),
        summary,
        checkpoint: String(entry.checkpoint ?? ""),
        idempotencyKey: typeof entry.idempotencyKey === "string" ? entry.idempotencyKey : undefined,
        createdAt: String(entry.createdAt ?? ""),
      };
    })
    : [];
  if (evidence.length > MAX_EVIDENCE) throw new Error("任务证据过多");
  const goal = String(value.goal ?? "").trim();
  const id = String(value.id ?? "");
  if (!/^task-[A-Za-z0-9-]{8,40}$/.test(id) || !goal || goal.length > MAX_GOAL_LENGTH) {
    throw new Error("任务目标或 ID 无效");
  }
  const revision = Number(value.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("任务 revision 无效");
  const idempotencyKeys = Array.isArray(value.idempotencyKeys)
    ? value.idempotencyKeys.map((key) => validIdempotencyKey(String(key))!).filter(Boolean)
    : [];
  return {
    id,
    goal,
    state,
    evidence,
    revision,
    createdAt: String(value.createdAt ?? ""),
    updatedAt: String(value.updatedAt ?? ""),
    idempotencyKeys,
  };
}

async function readTasks(workspace: string): Promise<TaskRecord[]> {
  try {
    const value = JSON.parse(await readUtf8(await ledgerPath(workspace)));
    if (!Array.isArray(value) || value.length > MAX_TASKS) throw new Error("任务账本无效");
    return value.map(validateTask);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveTasks(workspace: string, tasks: TaskRecord[]): Promise<void> {
  if (tasks.length > MAX_TASKS) throw new Error(`最多保存 ${MAX_TASKS} 个任务`);
  await writeJsonAtomic(await ledgerPath(workspace), tasks);
}

function cloneTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    evidence: task.evidence.map((item) => ({ ...item })),
    idempotencyKeys: [...task.idempotencyKeys],
  };
}

function touch(task: TaskRecord): void {
  task.revision += 1;
  task.updatedAt = new Date().toISOString();
}

function idempotent(task: TaskRecord, key: string | undefined): boolean {
  return Boolean(key && task.idempotencyKeys.includes(key));
}

export async function createTask(
  workspace: string,
  goal: string,
  idempotencyKey?: string,
): Promise<TaskRecord> {
  const normalizedGoal = goal.trim();
  if (!normalizedGoal || normalizedGoal.length > MAX_GOAL_LENGTH) throw new Error("goal 无效");
  const key = validIdempotencyKey(idempotencyKey), tasks = await readTasks(workspace);
  if (key) {
    const existing = tasks.find((task) => task.idempotencyKeys.includes(key));
    if (existing) return cloneTask(existing);
  }
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: `task-${crypto.randomUUID().slice(0, 12)}`,
    goal: normalizedGoal,
    state: "planned",
    evidence: [],
    revision: 0,
    createdAt: now,
    updatedAt: now,
    idempotencyKeys: key ? [key] : [],
  };
  tasks.unshift(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}

export async function checkpointTask(
  workspace: string,
  id: string,
  summary: string,
  checkpoint: string,
  idempotencyKey?: string,
): Promise<TaskRecord> {
  const key = validIdempotencyKey(idempotencyKey), tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("任务不存在");
  if (key && idempotent(task, key)) return cloneTask(task);
  const normalized = summary.trim(), marker = checkpoint.trim();
  if (!normalized || normalized.length > MAX_EVIDENCE_LENGTH) throw new Error("evidence 无效");
  if (!marker || marker.length > 200) throw new Error("checkpoint 无效");
  if (task.state === "verified") throw new Error("已验证任务不能继续 checkpoint");
  if (task.evidence.length >= MAX_EVIDENCE) throw new Error("任务证据已达上限");
  task.evidence.push({
    id: `evidence-${crypto.randomUUID().slice(0, 12)}`,
    summary: normalized,
    checkpoint: marker,
    idempotencyKey: key,
    createdAt: new Date().toISOString(),
  });
  if (key) task.idempotencyKeys.push(key);
  task.state = "running";
  touch(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}

export async function verifyTask(
  workspace: string,
  id: string,
  idempotencyKey?: string,
): Promise<TaskRecord> {
  const key = validIdempotencyKey(idempotencyKey), tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("任务不存在");
  if (task.state === "verified" || (key && idempotent(task, key))) return cloneTask(task);
  if (!task.evidence.length) throw new Error("没有 evidence，不能 verified");
  task.state = "verified";
  if (key) task.idempotencyKeys.push(key);
  touch(task);
  await saveTasks(workspace, tasks);
  return cloneTask(task);
}

export async function resumeTask(workspace: string, id: string): Promise<TaskRecord> {
  const tasks = await readTasks(workspace);
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("任务不存在");
  return cloneTask(task);
}
