import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type HandoffState = "submitted" | "running" | "complete" | "failed";

export interface HandoffEvidence {
  id: string;
  summary: string;
  checkpoint: string;
  createdAt: string;
}

export interface HandoffRecord {
  id: string;
  tenant: string;
  role: string;
  objective: string;
  traceId: string;
  state: HandoffState;
  artifacts: string[];
  evidence: HandoffEvidence[];
  failureReason?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  idempotencyKeys: string[];
}

export type HandoffSubmitInput = {
  tenant: string;
  role: string;
  objective: string;
  traceId?: string;
  idempotencyKey?: string;
};

const MAX_HANDOFFS = 100;
const MAX_OBJECTIVE_LENGTH = 1_000;
const MAX_ROLE_LENGTH = 120;
const MAX_TENANT_LENGTH = 120;
const MAX_TRACE_ID_LENGTH = 120;
const MAX_ARTIFACTS = 20;
const MAX_ARTIFACT_LENGTH = 10_000;
const MAX_EVIDENCE = 40;
const MAX_EVIDENCE_LENGTH = 4_000;
const MAX_FAILURE_LENGTH = 1_000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;

const workspaceLocks = new Map<string, Promise<void>>();

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Handoff operation cancelled", "AbortError");
}

function text(value: unknown, name: string, max: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${name} 无效`);
  }
  return normalized;
}

function label(value: unknown, name: string, max: number): string {
  const normalized = text(value, name, max);
  if (!LABEL_PATTERN.test(normalized)) throw new Error(`${name} 无效`);
  return normalized;
}

function key(value: string | undefined, name = "idempotency_key"): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!KEY_PATTERN.test(value)) throw new Error(`${name} 无效`);
  return value;
}

function scopedKey(operation: string, tenant: string, idempotencyKey: string): string {
  return `${operation}:${tenant}:${idempotencyKey}`;
}

function validateId(value: unknown): string {
  const id = String(value ?? "");
  if (!/^handoff-[A-Za-z0-9-]{8,40}$/.test(id)) throw new Error("handoff id 无效");
  return id;
}

function validateRecord(raw: unknown): HandoffRecord {
  if (!raw || typeof raw !== "object") throw new Error("handoff 记录无效");
  const value = raw as Record<string, unknown>;
  const state = String(value.state ?? "") as HandoffState;
  if (!["submitted", "running", "complete", "failed"].includes(state)) {
    throw new Error("handoff 状态无效");
  }
  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map((artifact) => text(artifact, "artifact", MAX_ARTIFACT_LENGTH))
    : [];
  if (artifacts.length > MAX_ARTIFACTS) throw new Error("handoff artifact 过多");
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.map((item) => {
      if (!item || typeof item !== "object") throw new Error("handoff evidence 无效");
      const entry = item as Record<string, unknown>;
      return {
        id: text(entry.id, "evidence id", 80),
        summary: text(entry.summary, "evidence summary", MAX_EVIDENCE_LENGTH),
        checkpoint: text(entry.checkpoint, "checkpoint", 200),
        createdAt: text(entry.createdAt, "evidence createdAt", 80),
      };
    })
    : [];
  if (evidence.length > MAX_EVIDENCE) throw new Error("handoff evidence 过多");
  const idempotencyKeys = Array.isArray(value.idempotencyKeys)
    ? value.idempotencyKeys.map((item) => text(item, "idempotency key", 300)).slice(0, 80)
    : [];
  const revision = Number(value.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("handoff revision 无效");
  return {
    id: validateId(value.id),
    tenant: label(value.tenant, "tenant", MAX_TENANT_LENGTH),
    role: label(value.role, "role", MAX_ROLE_LENGTH),
    objective: text(value.objective, "objective", MAX_OBJECTIVE_LENGTH),
    traceId: text(value.traceId, "trace_id", MAX_TRACE_ID_LENGTH),
    state,
    artifacts,
    evidence,
    failureReason: typeof value.failureReason === "string"
      ? value.failureReason.slice(0, MAX_FAILURE_LENGTH)
      : undefined,
    revision,
    createdAt: text(value.createdAt, "createdAt", 80),
    updatedAt: text(value.updatedAt, "updatedAt", 80),
    idempotencyKeys,
  };
}

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function handoffPath(workspace: string): Promise<string> {
  return `${appDataDir()}/handoffs/${await workspaceKey(workspace)}.json`;
}

async function readRecords(workspace: string): Promise<HandoffRecord[]> {
  try {
    const value = JSON.parse(await readUtf8(await handoffPath(workspace))) as unknown;
    if (!Array.isArray(value) || value.length > MAX_HANDOFFS) throw new Error("handoff 存储无效");
    return value.map(validateRecord);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveRecords(workspace: string, records: HandoffRecord[]): Promise<void> {
  if (records.length > MAX_HANDOFFS) throw new Error(`最多保存 ${MAX_HANDOFFS} 个 handoff`);
  await writeJsonAtomic(await handoffPath(workspace), records);
}

function clone(record: HandoffRecord): HandoffRecord {
  return {
    ...record,
    artifacts: [...record.artifacts],
    evidence: record.evidence.map((item) => ({ ...item })),
    idempotencyKeys: [...record.idempotencyKeys],
  };
}

function touch(record: HandoffRecord): void {
  record.revision += 1;
  record.updatedAt = new Date().toISOString();
}

async function withWorkspaceLock<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
  const previous = workspaceLocks.get(workspace) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => release = resolve);
  workspaceLocks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (workspaceLocks.get(workspace) === current) workspaceLocks.delete(workspace);
  }
}

function findRecord(records: HandoffRecord[], id: string, tenant: string): HandoffRecord {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error("handoff 不存在");
  if (record.tenant !== tenant) throw new Error("handoff tenant 不匹配");
  return record;
}

export async function submitHandoff(
  workspace: string,
  input: HandoffSubmitInput,
  signal?: AbortSignal,
): Promise<HandoffRecord> {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant", MAX_TENANT_LENGTH);
  const role = label(input.role, "role", MAX_ROLE_LENGTH);
  const objective = text(input.objective, "objective", MAX_OBJECTIVE_LENGTH);
  const traceId = input.traceId
    ? text(input.traceId, "trace_id", MAX_TRACE_ID_LENGTH)
    : `trace-${crypto.randomUUID()}`;
  const idempotencyKey = key(input.idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const operationKey = idempotencyKey && scopedKey("submit", tenant, idempotencyKey);
    const existing = operationKey &&
      records.find((item) => item.idempotencyKeys.includes(operationKey));
    if (existing) return clone(existing);
    const now = new Date().toISOString();
    const record: HandoffRecord = {
      id: `handoff-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      role,
      objective,
      traceId,
      state: "submitted",
      artifacts: [],
      evidence: [],
      revision: 0,
      createdAt: now,
      updatedAt: now,
      idempotencyKeys: operationKey ? [operationKey] : [],
    };
    records.unshift(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function transferHandoff(
  workspace: string,
  id: string,
  tenant: string,
  artifact: string,
  summary: string,
  checkpoint: string,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<HandoffRecord> {
  abortIfNeeded(signal);
  const handoffId = validateId(id);
  const normalizedTenant = label(tenant, "tenant", MAX_TENANT_LENGTH);
  const normalizedArtifact = text(artifact, "artifact", MAX_ARTIFACT_LENGTH);
  const normalizedSummary = text(summary, "evidence summary", MAX_EVIDENCE_LENGTH);
  const normalizedCheckpoint = text(checkpoint, "checkpoint", 200);
  const normalizedKey = key(idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey("transfer", normalizedTenant, normalizedKey);
    if (operationKey && record.idempotencyKeys.includes(operationKey)) return clone(record);
    if (record.state === "complete" || record.state === "failed") {
      throw new Error(`handoff 已处于终态：${record.state}`);
    }
    if (record.artifacts.length >= MAX_ARTIFACTS) throw new Error("handoff artifact 已达上限");
    if (record.evidence.length >= MAX_EVIDENCE) throw new Error("handoff evidence 已达上限");
    record.artifacts.push(normalizedArtifact);
    record.evidence.push({
      id: `evidence-${crypto.randomUUID().slice(0, 12)}`,
      summary: normalizedSummary,
      checkpoint: normalizedCheckpoint,
      createdAt: new Date().toISOString(),
    });
    record.state = "running";
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function completeHandoff(
  workspace: string,
  id: string,
  tenant: string,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<HandoffRecord> {
  abortIfNeeded(signal);
  const handoffId = validateId(id);
  const normalizedTenant = label(tenant, "tenant", MAX_TENANT_LENGTH);
  const normalizedKey = key(idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey("complete", normalizedTenant, normalizedKey);
    if (record.state === "complete") return clone(record);
    if (record.state === "failed") throw new Error("失败的 handoff 不能完成");
    if (!record.artifacts.length || !record.evidence.length) {
      throw new Error("handoff 缺少 artifact 或 evidence，不能完成");
    }
    record.state = "complete";
    if (operationKey && !record.idempotencyKeys.includes(operationKey)) {
      record.idempotencyKeys.push(operationKey);
    }
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function failHandoff(
  workspace: string,
  id: string,
  tenant: string,
  reason: string,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<HandoffRecord> {
  abortIfNeeded(signal);
  const handoffId = validateId(id);
  const normalizedTenant = label(tenant, "tenant", MAX_TENANT_LENGTH);
  const normalizedReason = text(reason, "failure_reason", MAX_FAILURE_LENGTH);
  const normalizedKey = key(idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = findRecord(records, handoffId, normalizedTenant);
    const operationKey = normalizedKey && scopedKey("fail", normalizedTenant, normalizedKey);
    if (record.state === "failed") return clone(record);
    if (record.state === "complete") throw new Error("已完成的 handoff 不能失败");
    record.state = "failed";
    record.failureReason = normalizedReason;
    if (operationKey && !record.idempotencyKeys.includes(operationKey)) {
      record.idempotencyKeys.push(operationKey);
    }
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function readHandoffs(
  workspace: string,
  options: { id?: string; tenant?: string } = {},
): Promise<HandoffRecord[]> {
  const records = await readRecords(workspace);
  const id = options.id ? validateId(options.id) : undefined;
  const tenant = options.tenant ? label(options.tenant, "tenant", MAX_TENANT_LENGTH) : undefined;
  return records.filter((record) =>
    (!id || record.id === id) && (!tenant || record.tenant === tenant)
  )
    .map(clone);
}
