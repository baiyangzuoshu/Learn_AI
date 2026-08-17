import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type MemoryKind = "semantic" | "episodic" | "procedural";

export interface MemoryRecord {
  id: string;
  tenant: string;
  kind: MemoryKind;
  text: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
  deleted?: boolean;
  deletedAt?: string;
  revision: number;
  idempotencyKeys: string[];
}

export interface MemoryWriteInput {
  tenant: string;
  kind: MemoryKind;
  text: string;
  source?: string;
  expiresAt?: number;
  idempotencyKey?: string;
}

export interface MemoryCitation {
  id: string;
  tenant: string;
  kind: MemoryKind;
  source?: string;
  createdAt: string;
}

export interface MemoryHit {
  id: string;
  tenant: string;
  kind: MemoryKind;
  text: string;
  score: number;
  matchedTerms: string[];
  citation: MemoryCitation;
}

const MAX_RECORDS = 500;
const MAX_TEXT_LENGTH = 8_000;
const MAX_SOURCE_LENGTH = 500;
const MAX_TENANT_LENGTH = 120;
const MAX_IDEMPOTENCY_LENGTH = 120;
const MAX_IDEMPOTENCY_STORED = 40;
const MAX_QUERY_LENGTH = 1_000;
const MEMORY_ID = /^memory-[A-Za-z0-9-]{8,40}$/;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
const KINDS = new Set<MemoryKind>(["semantic", "episodic", "procedural"]);
const workspaceLocks = new Map<string, Promise<void>>();
const LEGACY_TENANT = "legacy";

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Memory operation cancelled", "AbortError");
}

function normalizedText(value: unknown, name: string, max: number): string {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} 无效`);
  }
  return result;
}

function label(value: unknown, name: string): string {
  const result = normalizedText(value, name, MAX_TENANT_LENGTH);
  if (!LABEL_PATTERN.test(result)) throw new Error(`${name} 无效`);
  return result;
}

function kind(value: unknown): MemoryKind {
  const result = String(value ?? "") as MemoryKind;
  if (!KINDS.has(result)) throw new Error("memory kind 无效");
  return result;
}

function idempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (value.length > MAX_IDEMPOTENCY_LENGTH || !KEY_PATTERN.test(value)) {
    throw new Error("idempotency_key 无效");
  }
  return value;
}

function scopedKey(operation: string, tenant: string, key: string): string {
  return `${operation}:${tenant}:${key}`;
}

function validateRecord(raw: unknown): MemoryRecord {
  if (!raw || typeof raw !== "object") throw new Error("memory record 无效");
  const value = raw as Record<string, unknown>;
  const revision = Number(value.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("memory revision 无效");
  const storedKeys = Array.isArray(value.idempotencyKeys)
    ? value.idempotencyKeys.map((item) => normalizedText(item, "idempotency key", 300)).slice(
      0,
      MAX_IDEMPOTENCY_STORED,
    )
    : [];
  const expiresAt = value.expiresAt === undefined ? undefined : Number(value.expiresAt);
  if (expiresAt !== undefined && !Number.isFinite(expiresAt)) throw new Error("expires_at 无效");
  return {
    id: validateId(value.id),
    tenant: label(value.tenant, "tenant"),
    kind: kind(value.kind),
    text: normalizedText(value.text, "text", MAX_TEXT_LENGTH),
    source: typeof value.source === "string"
      ? normalizedText(value.source, "source", MAX_SOURCE_LENGTH)
      : undefined,
    createdAt: normalizedText(value.createdAt, "createdAt", 80),
    updatedAt: normalizedText(value.updatedAt, "updatedAt", 80),
    expiresAt,
    deleted: value.deleted === true,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : undefined,
    revision,
    idempotencyKeys: storedKeys,
  };
}

function validateId(value: unknown): string {
  const id = String(value ?? "");
  if (!MEMORY_ID.test(id)) throw new Error("memory id 无效");
  return id;
}

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function memoryPath(workspace: string): Promise<string> {
  return `${appDataDir()}/memory-service/${await workspaceKey(workspace)}.json`;
}

async function readRecords(workspace: string): Promise<MemoryRecord[]> {
  try {
    const value = JSON.parse(await readUtf8(await memoryPath(workspace))) as unknown;
    if (!Array.isArray(value) || value.length > MAX_RECORDS) throw new Error("memory 存储无效");
    return value.map(validateRecord);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveRecords(workspace: string, records: MemoryRecord[]): Promise<void> {
  if (records.length > MAX_RECORDS) throw new Error(`最多保存 ${MAX_RECORDS} 条 memory`);
  await writeJsonAtomic(await memoryPath(workspace), records);
}

function clone(record: MemoryRecord): MemoryRecord {
  return { ...record, idempotencyKeys: [...record.idempotencyKeys] };
}

function touch(record: MemoryRecord): void {
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

function active(record: MemoryRecord, now = Date.now()): boolean {
  return record.deleted !== true && (record.expiresAt === undefined || record.expiresAt > now);
}

function tokens(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}_]+|[\u3400-\u9fff]/gu) ?? [];
}

function citation(record: MemoryRecord): MemoryCitation {
  return {
    id: record.id,
    tenant: record.tenant,
    kind: record.kind,
    source: record.source,
    createdAt: record.createdAt,
  };
}

export async function writeMemory(
  workspace: string,
  input: MemoryWriteInput,
  signal?: AbortSignal,
): Promise<MemoryRecord> {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const memoryKind = kind(input.kind);
  const text = normalizedText(input.text, "text", MAX_TEXT_LENGTH);
  const source = input.source === undefined
    ? undefined
    : normalizedText(input.source, "source", MAX_SOURCE_LENGTH);
  const expiresAt = input.expiresAt === undefined ? undefined : Number(input.expiresAt);
  if (expiresAt !== undefined && !Number.isFinite(expiresAt)) throw new Error("expires_at 无效");
  const key = idempotencyKey(input.idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const operationKey = key && scopedKey("write", tenant, key);
    const existing = operationKey &&
      records.find((record) => record.idempotencyKeys.includes(operationKey));
    if (existing) return clone(existing);
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: `memory-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      kind: memoryKind,
      text,
      source,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      revision: 0,
      idempotencyKeys: operationKey ? [operationKey] : [],
    };
    if (records.length >= MAX_RECORDS) throw new Error("memory record 已达上限");
    records.unshift(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function tombstoneMemory(
  workspace: string,
  id: string,
  tenant: string,
  idempotencyKeyValue?: string,
  signal?: AbortSignal,
): Promise<MemoryRecord> {
  abortIfNeeded(signal);
  const memoryId = validateId(id);
  const normalizedTenant = label(tenant, "tenant");
  const key = idempotencyKey(idempotencyKeyValue);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = records.find((item) => item.id === memoryId);
    if (!record) throw new Error("memory 不存在");
    if (record.tenant !== normalizedTenant) throw new Error("memory tenant 不匹配");
    const operationKey = key && scopedKey("tombstone", normalizedTenant, key);
    if (record.deleted || operationKey && record.idempotencyKeys.includes(operationKey)) {
      return clone(record);
    }
    record.deleted = true;
    record.deletedAt = new Date().toISOString();
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function replaceMemory(
  workspace: string,
  input: MemoryWriteInput,
  signal?: AbortSignal,
): Promise<MemoryRecord> {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const memoryKind = kind(input.kind);
  const text = normalizedText(input.text, "text", MAX_TEXT_LENGTH);
  const source = input.source === undefined
    ? undefined
    : normalizedText(input.source, "source", MAX_SOURCE_LENGTH);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const now = new Date().toISOString();
    for (const record of records) {
      if (record.tenant === tenant && !record.deleted) {
        record.deleted = true;
        record.deletedAt = now;
        touch(record);
      }
    }
    const record: MemoryRecord = {
      id: `memory-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      kind: memoryKind,
      text,
      source,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      idempotencyKeys: [],
    };
    if (records.length >= MAX_RECORDS) throw new Error("memory record 已达上限");
    records.unshift(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function migrateLegacyMemory(
  workspace: string,
  signal?: AbortSignal,
): Promise<{ migrated: boolean; record?: MemoryRecord }> {
  abortIfNeeded(signal);
  const workspaceId = await workspaceKey(workspace);
  const legacyPath = `${appDataDir()}/memory/${workspaceId}.md`;
  let legacyText: string;
  try {
    legacyText = await readUtf8(legacyPath);
  } catch (error) {
    if (isNotFound(error)) return { migrated: false };
    throw error;
  }
  const text = legacyText.trim();
  if (!text) return { migrated: false };
  const migrationKey = scopedKey("write", LEGACY_TENANT, `legacy-md-${workspaceId}`);
  const existing = (await readRecords(workspace)).find((record) =>
    record.idempotencyKeys.includes(migrationKey)
  );
  if (existing) return { migrated: false, record: clone(existing) };
  const record = await writeMemory(workspace, {
    tenant: LEGACY_TENANT,
    kind: "semantic",
    text,
    source: "legacy-markdown-memory",
    idempotencyKey: `legacy-md-${workspaceId}`,
  }, signal);
  return { migrated: true, record };
}

export const legacyMemoryTenant = LEGACY_TENANT;

export async function searchMemory(
  workspace: string,
  options: {
    tenant: string;
    query: string;
    kind?: MemoryKind;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<MemoryHit[]> {
  abortIfNeeded(signal);
  const tenant = label(options.tenant, "tenant");
  const query = normalizedText(options.query, "query", MAX_QUERY_LENGTH);
  const queryTerms = [...new Set(tokens(query))];
  if (!queryTerms.length) throw new Error("query 无有效检索词");
  const requestedKind = options.kind === undefined ? undefined : kind(options.kind);
  const limit = options.limit === undefined
    ? 8
    : Math.min(20, Math.max(1, Math.trunc(options.limit)));
  const now = Date.now();
  const records = await readRecords(workspace);
  return records.filter((record) =>
    record.tenant === tenant && active(record, now) &&
    (!requestedKind || record.kind === requestedKind)
  ).map((record) => {
    const recordTerms = new Set(tokens(record.text));
    const matchedTerms = queryTerms.filter((term) => recordTerms.has(term));
    const phraseBonus = record.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ? 0.25
      : 0;
    return {
      id: record.id,
      tenant: record.tenant,
      kind: record.kind,
      text: record.text.slice(0, 1_000),
      score: matchedTerms.length / queryTerms.length + phraseBonus,
      matchedTerms,
      citation: citation(record),
    } satisfies MemoryHit;
  }).filter((hit) => hit.matchedTerms.length > 0).sort((a, b) =>
    b.score - a.score || a.id.localeCompare(b.id)
  ).slice(0, limit);
}

export async function readMemoryRecords(
  workspace: string,
  options: { tenant?: string; includeDeleted?: boolean } = {},
): Promise<MemoryRecord[]> {
  const tenant = options.tenant === undefined ? undefined : label(options.tenant, "tenant");
  const records = await readRecords(workspace);
  return records.filter((record) =>
    (!tenant || record.tenant === tenant) && (options.includeDeleted || record.deleted !== true)
  ).map(clone);
}
