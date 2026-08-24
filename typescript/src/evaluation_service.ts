import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type EvaluationState = "passed" | "blocked";

export interface EvaluationCase {
  id: string;
  input: string;
  expected: string;
  citation?: string;
}

export interface EvaluationResult {
  id: string;
  pass: boolean;
  grounded: boolean;
  review: boolean;
}

export interface EvaluationRecord {
  id: string;
  tenant: string;
  datasetVersion: string;
  traceId: string;
  state: EvaluationState;
  passRate: number;
  groundingRate: number;
  passThreshold: number;
  groundingThreshold: number;
  review: string[];
  results: EvaluationResult[];
  caseCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  idempotencyKeys: string[];
}

export interface EvaluationRunInput {
  tenant: string;
  datasetVersion: string;
  cases: EvaluationCase[];
  outputs: Record<string, string>;
  traceId?: string;
  passThreshold?: number;
  groundingThreshold?: number;
  idempotencyKey?: string;
}

const MAX_RECORDS = 100;
const MAX_CASES = 100;
const MAX_TEXT = 8_000;
const MAX_VERSION = 120;
const MAX_TENANT = 120;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:@-]{0,119}$/u;
const locks = new Map<string, Promise<void>>();

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Evaluation operation cancelled", "AbortError");
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
  if (!KEY_PATTERN.test(value)) throw new Error("idempotency_key 无效");
  return value;
}

function numberInRange(value: unknown, name: string, min: number, max: number): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${name} 无效`);
  return result;
}

function validateCase(raw: unknown): EvaluationCase {
  if (!raw || typeof raw !== "object") throw new Error("evaluation case 无效");
  const value = raw as Record<string, unknown>;
  return {
    id: text(value.id, "case id", 120),
    input: text(value.input, "case input", MAX_TEXT),
    expected: text(value.expected, "case expected", MAX_TEXT),
    citation: value.citation === undefined ? undefined : text(value.citation, "citation", 2_000),
  };
}

function validateResult(raw: unknown): EvaluationResult {
  if (!raw || typeof raw !== "object") throw new Error("evaluation result 无效");
  const value = raw as Record<string, unknown>;
  return {
    id: text(value.id, "result id", 120),
    pass: value.pass === true,
    grounded: value.grounded === true,
    review: value.review === true,
  };
}

function validateRecord(raw: unknown): EvaluationRecord {
  if (!raw || typeof raw !== "object") throw new Error("evaluation record 无效");
  const value = raw as Record<string, unknown>;
  const state = String(value.state ?? "") as EvaluationState;
  if (state !== "passed" && state !== "blocked") throw new Error("evaluation 状态无效");
  const results = Array.isArray(value.results) ? value.results.map(validateResult) : [];
  if (results.length > MAX_CASES) throw new Error("evaluation case 过多");
  const review = Array.isArray(value.review)
    ? value.review.map((item) => text(item, "review id", 120)).slice(0, MAX_CASES)
    : [];
  const keys = Array.isArray(value.idempotencyKeys)
    ? value.idempotencyKeys.map((item) => text(item, "idempotency key", 120)).slice(0, 60)
    : [];
  const id = text(value.id, "evaluation id", 80);
  if (!/^eval-[A-Za-z0-9-]{8,40}$/.test(id)) throw new Error("evaluation id 无效");
  return {
    id,
    tenant: label(value.tenant, "tenant"),
    datasetVersion: text(value.datasetVersion, "dataset_version", MAX_VERSION),
    traceId: text(value.traceId, "trace_id", 120),
    state,
    passRate: numberInRange(value.passRate, "pass_rate", 0, 1),
    groundingRate: numberInRange(value.groundingRate, "grounding_rate", 0, 1),
    passThreshold: numberInRange(value.passThreshold, "pass_threshold", 0.5, 1),
    groundingThreshold: numberInRange(value.groundingThreshold, "grounding_threshold", 0.5, 1),
    review,
    results,
    caseCount: numberInRange(value.caseCount, "case_count", 0, MAX_CASES),
    revision: numberInRange(value.revision, "revision", 0, 1_000_000),
    createdAt: text(value.createdAt, "createdAt", 80),
    updatedAt: text(value.updatedAt, "updatedAt", 80),
    idempotencyKeys: keys,
  };
}

async function storagePath(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const key = [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  return `${appDataDir()}/evaluations/${key}.json`;
}

async function readRecords(workspace: string): Promise<EvaluationRecord[]> {
  try {
    const value = JSON.parse(await readUtf8(await storagePath(workspace))) as unknown;
    if (!Array.isArray(value) || value.length > MAX_RECORDS) throw new Error("evaluation 存储无效");
    return value.map(validateRecord);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveRecords(workspace: string, records: EvaluationRecord[]): Promise<void> {
  if (records.length > MAX_RECORDS) throw new Error("evaluation 记录已达上限");
  await writeJsonAtomic(await storagePath(workspace), records);
}

function clone(record: EvaluationRecord): EvaluationRecord {
  return {
    ...record,
    review: [...record.review],
    results: record.results.map((result) => ({ ...result })),
    idempotencyKeys: [...record.idempotencyKeys],
  };
}

async function withLock<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(workspace) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => release = resolve);
  locks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(workspace) === current) locks.delete(workspace);
  }
}

export async function runEvaluation(
  workspace: string,
  input: EvaluationRunInput,
  signal?: AbortSignal,
): Promise<EvaluationRecord> {
  abortIfNeeded(signal);
  const tenant = label(input.tenant, "tenant");
  const datasetVersion = text(input.datasetVersion, "dataset_version", MAX_VERSION);
  if (!Array.isArray(input.cases) || input.cases.length === 0 || input.cases.length > MAX_CASES) {
    throw new Error("cases 数量无效");
  }
  const cases = input.cases.map(validateCase);
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error("case id 必须唯一");
    ids.add(item.id);
  }
  if (!input.outputs || typeof input.outputs !== "object" || Array.isArray(input.outputs)) {
    throw new Error("outputs 无效");
  }
  const outputs = input.outputs as Record<string, unknown>;
  const passThreshold = input.passThreshold === undefined
    ? 0.95
    : numberInRange(input.passThreshold, "pass_threshold", 0.5, 1);
  const groundingThreshold = input.groundingThreshold === undefined
    ? 0.95
    : numberInRange(input.groundingThreshold, "grounding_threshold", 0.5, 1);
  const traceId = input.traceId
    ? text(input.traceId, "trace_id", 120)
    : `trace-${crypto.randomUUID()}`;
  const idempotencyKey = key(input.idempotencyKey);
  return await withLock(workspace, async () => {
    abortIfNeeded(signal);
    const records = await readRecords(workspace);
    const operationKey = idempotencyKey ? `run:${tenant}:${idempotencyKey}` : undefined;
    const existing = operationKey &&
      records.find((record) => record.idempotencyKeys.includes(operationKey));
    if (existing) return clone(existing);
    const results = cases.map((item) => {
      const candidate = typeof outputs[item.id] === "string" ? outputs[item.id] as string : "";
      const pass = candidate === item.expected;
      const grounded = !item.citation || candidate.includes(item.citation);
      return { id: item.id, pass, grounded, review: !pass || !grounded };
    });
    const passRate = results.filter((result) => result.pass).length / results.length;
    const groundingRate = results.filter((result) => result.grounded).length / results.length;
    const review = results.filter((result) => result.review).map((result) => result.id);
    const state: EvaluationState = passRate >= passThreshold && groundingRate >= groundingThreshold
      ? "passed"
      : "blocked";
    const now = new Date().toISOString();
    const record: EvaluationRecord = {
      id: `eval-${crypto.randomUUID().slice(0, 12)}`,
      tenant,
      datasetVersion,
      traceId,
      state,
      passRate: Number(passRate.toFixed(3)),
      groundingRate: Number(groundingRate.toFixed(3)),
      passThreshold,
      groundingThreshold,
      review,
      results,
      caseCount: cases.length,
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

export async function readEvaluations(
  workspace: string,
  options: { id?: string; tenant: string },
): Promise<EvaluationRecord[]> {
  const tenant = label(options.tenant, "tenant");
  const id = options.id ? text(options.id, "evaluation id", 80) : undefined;
  const records = await readRecords(workspace);
  return records.filter((record) => record.tenant === tenant && (!id || record.id === id)).map(
    clone,
  );
}
