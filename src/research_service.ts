import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type ResearchState = "planned" | "collecting" | "complete" | "escalated";

export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  text: string;
  fetchedAt: string;
  quality: number;
  fresh: boolean;
  createdAt: string;
}

export interface ResearchRecord {
  id: string;
  tenant: string;
  query: string;
  traceId: string;
  state: ResearchState;
  maxSources: number;
  freshnessHours: number;
  minConfidence: number;
  sources: ResearchSource[];
  citations: string[];
  confidence: number;
  answer?: string;
  escalationReason?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  idempotencyKeys: string[];
}

export interface ResearchStartInput {
  tenant: string;
  query: string;
  traceId?: string;
  maxSources?: number;
  freshnessHours?: number;
  minConfidence?: number;
  idempotencyKey?: string;
}

export interface ResearchSourceInput {
  tenant: string;
  url: string;
  title: string;
  text: string;
  fetchedAt: string;
  quality?: number;
  idempotencyKey?: string;
}

const MAX_RESEARCH = 100;
const MAX_SOURCES = 20;
const MAX_SOURCE_TEXT = 12_000;
const MAX_QUERY = 1_000;
const MAX_TITLE = 240;
const MAX_TENANT = 120;
const MAX_IDEMPOTENCY = 120;
const RESEARCH_ID = /^research-[A-Za-z0-9-]{8,40}$/;
const SOURCE_ID = /^source-[A-Za-z0-9-]{8,40}$/;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
const workspaceLocks = new Map<string, Promise<void>>();

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Research operation cancelled", "AbortError");
}

function text(value: unknown, name: string, max: number): string {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\u0000\u007f]/.test(result)) {
    throw new Error(`${name} 无效`);
  }
  return result;
}

function label(value: unknown, name: string): string {
  const result = text(value, name, MAX_TENANT);
  if (!LABEL_PATTERN.test(result)) throw new Error(`${name} 无效`);
  return result;
}

function key(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (value.length > MAX_IDEMPOTENCY || !KEY_PATTERN.test(value)) {
    throw new Error("idempotency_key 无效");
  }
  return value;
}

function validateId(value: unknown, pattern: RegExp, name: string): string {
  const result = String(value ?? "");
  if (!pattern.test(result)) throw new Error(`${name} 无效`);
  return result;
}

function safeUrl(value: unknown): string {
  const result = text(value, "url", 2_000);
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    throw new Error("url 无效");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.username || parsed.password) throw new Error("研究来源 URL 不得包含凭据");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("研究来源只允许 HTTPS 或 localhost HTTP");
  }
  return parsed.toString();
}

function fetchedAt(value: unknown): string {
  const result = text(value, "fetched_at", 80);
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp)) throw new Error("fetched_at 无效");
  return new Date(timestamp).toISOString();
}

function numberInRange(
  value: unknown,
  name: string,
  min: number,
  max: number,
  integer = false,
): number {
  const result = Number(value);
  if (
    !Number.isFinite(result) || result < min || result > max || integer && !Number.isInteger(result)
  ) {
    throw new Error(`${name} 无效`);
  }
  return integer ? Math.trunc(result) : result;
}

function scopedKey(operation: string, tenant: string, value: string): string {
  return `${operation}:${tenant}:${value}`;
}

function validateSource(raw: unknown): ResearchSource {
  if (!raw || typeof raw !== "object") throw new Error("research source 无效");
  const value = raw as Record<string, unknown>;
  const quality = numberInRange(value.quality, "quality", 0, 1);
  return {
    id: validateId(value.id, SOURCE_ID, "source id"),
    url: safeUrl(value.url),
    title: text(value.title, "title", MAX_TITLE),
    text: text(value.text, "source text", MAX_SOURCE_TEXT),
    fetchedAt: fetchedAt(value.fetchedAt),
    quality,
    fresh: value.fresh === true,
    createdAt: text(value.createdAt, "source createdAt", 80),
  };
}

function validateRecord(raw: unknown): ResearchRecord {
  if (!raw || typeof raw !== "object") throw new Error("research record 无效");
  const value = raw as Record<string, unknown>;
  const state = String(value.state ?? "") as ResearchState;
  if (!["planned", "collecting", "complete", "escalated"].includes(state)) {
    throw new Error("research 状态无效");
  }
  const revision = Number(value.revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0) throw new Error("research revision 无效");
  const sources = Array.isArray(value.sources) ? value.sources.map(validateSource) : [];
  if (sources.length > MAX_SOURCES) throw new Error("research 来源过多");
  const maxSources = numberInRange(value.maxSources, "max_sources", 1, MAX_SOURCES, true);
  const freshnessHours = numberInRange(value.freshnessHours, "freshness_hours", 1, 720, true);
  const minConfidence = numberInRange(value.minConfidence, "min_confidence", 0.1, 0.99);
  const citations = Array.isArray(value.citations)
    ? value.citations.map((item) => safeUrl(item)).slice(0, MAX_SOURCES)
    : [];
  const keys = Array.isArray(value.idempotencyKeys)
    ? value.idempotencyKeys.map((item) => text(item, "idempotency key", 300)).slice(0, 60)
    : [];
  return {
    id: validateId(value.id, RESEARCH_ID, "research id"),
    tenant: label(value.tenant, "tenant"),
    query: text(value.query, "query", MAX_QUERY),
    traceId: text(value.traceId, "trace_id", 120),
    state,
    maxSources,
    freshnessHours,
    minConfidence,
    sources,
    citations,
    confidence: numberInRange(value.confidence ?? 0, "confidence", 0, 1),
    answer: typeof value.answer === "string" ? value.answer.slice(0, 8_000) : undefined,
    escalationReason: typeof value.escalationReason === "string"
      ? value.escalationReason.slice(0, 1_000)
      : undefined,
    revision,
    createdAt: text(value.createdAt, "createdAt", 80),
    updatedAt: text(value.updatedAt, "updatedAt", 80),
    idempotencyKeys: keys,
  };
}

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function researchPath(workspace: string): Promise<string> {
  return `${appDataDir()}/research/${await workspaceKey(workspace)}.json`;
}

async function readRecords(workspace: string): Promise<ResearchRecord[]> {
  try {
    const value = JSON.parse(await readUtf8(await researchPath(workspace))) as unknown;
    if (!Array.isArray(value) || value.length > MAX_RESEARCH) throw new Error("research 存储无效");
    return value.map(validateRecord);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveRecords(workspace: string, records: ResearchRecord[]): Promise<void> {
  if (records.length > MAX_RESEARCH) throw new Error(`最多保存 ${MAX_RESEARCH} 个 research`);
  await writeJsonAtomic(await researchPath(workspace), records);
}

function clone(record: ResearchRecord): ResearchRecord {
  return {
    ...record,
    sources: record.sources.map((source) => ({ ...source })),
    citations: [...record.citations],
    idempotencyKeys: [...record.idempotencyKeys],
  };
}

function touch(record: ResearchRecord): void {
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

function findRecord(records: ResearchRecord[], id: string, tenant: string): ResearchRecord {
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error("research 不存在");
  if (record.tenant !== tenant) throw new Error("research tenant 不匹配");
  return record;
}

function freshAt(fetchedAtValue: string, hours: number, now = Date.now()): boolean {
  const age = now - Date.parse(fetchedAtValue);
  return age >= 0 && age <= hours * 60 * 60 * 1_000;
}

function fresh(source: ResearchSource, hours: number, now = Date.now()): boolean {
  return freshAt(source.fetchedAt, hours, now);
}

export async function startResearch(
  workspace: string,
  input: ResearchStartInput,
  signal?: AbortSignal,
): Promise<ResearchRecord> {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const query = text(input.query, "query", MAX_QUERY);
  const traceId = input.traceId
    ? text(input.traceId, "trace_id", 120)
    : `trace-${crypto.randomUUID()}`;
  const maxSources = input.maxSources === undefined
    ? 8
    : numberInRange(input.maxSources, "max_sources", 1, MAX_SOURCES, true);
  const freshnessHours = input.freshnessHours === undefined
    ? 168
    : numberInRange(input.freshnessHours, "freshness_hours", 1, 720, true);
  const minConfidence = input.minConfidence === undefined
    ? 0.6
    : numberInRange(input.minConfidence, "min_confidence", 0.1, 0.99);
  const idempotencyKey = key(input.idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const operationKey = idempotencyKey && scopedKey("start", tenant, idempotencyKey);
    const existing = operationKey &&
      records.find((record) => record.idempotencyKeys.includes(operationKey));
    if (existing) return clone(existing);
    if (records.length >= MAX_RESEARCH) throw new Error("research 任务已达上限");
    const now = new Date().toISOString();
    const record: ResearchRecord = {
      id: `research-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      query,
      traceId,
      state: "planned",
      maxSources,
      freshnessHours,
      minConfidence,
      sources: [],
      citations: [],
      confidence: 0,
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

export async function addResearchSource(
  workspace: string,
  researchId: string,
  input: ResearchSourceInput,
  signal?: AbortSignal,
): Promise<ResearchRecord> {
  abortIfNeeded(signal);
  const id = validateId(researchId, RESEARCH_ID, "research id");
  const tenant = label(input.tenant, "tenant");
  const sourceUrl = safeUrl(input.url);
  const title = text(input.title, "title", MAX_TITLE);
  const sourceText = text(input.text, "source text", MAX_SOURCE_TEXT);
  const fetched = fetchedAt(input.fetchedAt);
  const quality = input.quality === undefined ? 0.5 : numberInRange(input.quality, "quality", 0, 1);
  const idempotencyKey = key(input.idempotencyKey);
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = findRecord(records, id, tenant);
    const operationKey = idempotencyKey && scopedKey("source", tenant, idempotencyKey);
    if (operationKey && record.idempotencyKeys.includes(operationKey)) return clone(record);
    if (record.state === "complete" || record.state === "escalated") {
      throw new Error(`research 已处于终态：${record.state}`);
    }
    if (record.sources.length >= record.maxSources) throw new Error("research 来源已达上限");
    const now = new Date().toISOString();
    record.sources.push({
      id: `source-${crypto.randomUUID().slice(0, 12)}`,
      url: sourceUrl,
      title,
      text: sourceText,
      fetchedAt: fetched,
      quality,
      fresh: freshAt(fetched, record.freshnessHours),
      createdAt: now,
    });
    record.state = "collecting";
    if (operationKey) record.idempotencyKeys.push(operationKey);
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function synthesizeResearch(
  workspace: string,
  researchId: string,
  tenant: string,
  signal?: AbortSignal,
): Promise<ResearchRecord> {
  abortIfNeeded(signal);
  const id = validateId(researchId, RESEARCH_ID, "research id");
  const normalizedTenant = label(tenant, "tenant");
  return await withWorkspaceLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const record = findRecord(records, id, normalizedTenant);
    if (record.state === "complete" || record.state === "escalated") return clone(record);
    const now = Date.now();
    for (const source of record.sources) source.fresh = fresh(source, record.freshnessHours, now);
    const usable = record.sources.filter((source) =>
      source.fresh && source.text.length > 0 && source.quality >= 0.35
    );
    const averageQuality = usable.length
      ? usable.reduce((sum, source) => sum + source.quality, 0) / usable.length
      : 0;
    const coverage = usable.length / Math.max(1, record.sources.length);
    const confidence = Math.min(1, averageQuality * 0.65 + coverage * 0.35);
    record.confidence = Number(confidence.toFixed(3));
    record.citations = usable.map((source) => source.url);
    if (record.confidence < record.minConfidence || !usable.length) {
      record.state = "escalated";
      record.answer = "证据不足，无法可靠回答";
      record.escalationReason = usable.length
        ? `confidence ${record.confidence} < threshold ${record.minConfidence}`
        : "没有新鲜且质量足够的来源";
    } else {
      record.state = "complete";
      record.answer = usable.slice(0, 4).map((source) =>
        `[${source.title}] ${source.text.slice(0, 800)}`
      ).join("\n");
      record.escalationReason = undefined;
    }
    touch(record);
    await saveRecords(workspace, records);
    return clone(record);
  });
}

export async function readResearch(
  workspace: string,
  options: { id?: string; tenant: string },
): Promise<ResearchRecord[]> {
  const tenant = label(options.tenant, "tenant");
  const id = options.id ? validateId(options.id, RESEARCH_ID, "research id") : undefined;
  const records = await readRecords(workspace);
  return records.filter((record) => record.tenant === tenant && (!id || record.id === id)).map(
    clone,
  );
}
