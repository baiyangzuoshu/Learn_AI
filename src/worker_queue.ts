import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeJsonAtomic } from "./platform.ts";

export type WorkerJobStatus = "queued" | "leased" | "done" | "dead";

export interface WorkerJob {
  id: string;
  taskId?: string;
  traceId?: string;
  payload: string;
  status: WorkerJobStatus;
  attempts: number;
  maxAttempts: number;
  leaseOwner?: string;
  leaseUntil?: string;
  nextAttemptAt?: string;
  lastError?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

const MAX_JOBS = 500;
const MAX_PAYLOAD = 2_000;
const DEFAULT_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 3_600;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS = 10;
const queueLocks = new Map<string, Promise<void>>();

async function withQueueLock<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
  const previous = queueLocks.get(workspace) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => release = resolve);
  queueLocks.set(workspace, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queueLocks.get(workspace) === current) queueLocks.delete(workspace);
  }
}

async function workspaceKey(workspace: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  return [...new Uint8Array(digest)].slice(0, 12).map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function queuePath(workspace: string): Promise<string> {
  return `${appDataDir()}/worker-queue/${await workspaceKey(workspace)}.json`;
}

function idempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(value)) throw new Error("idempotency_key 无效");
  return value;
}

function normalizeJob(raw: unknown): WorkerJob {
  if (!raw || typeof raw !== "object") throw new Error("Worker Job 无效");
  const value = raw as Record<string, unknown>;
  const status = String(value.status ?? "") as WorkerJobStatus;
  if (!["queued", "leased", "done", "dead"].includes(status)) throw new Error("Worker 状态无效");
  const payload = String(value.payload ?? "");
  const attempts = Number(value.attempts ?? 0), maxAttempts = Number(value.maxAttempts ?? 3);
  if (
    !Number.isInteger(attempts) || attempts < 0 || !Number.isInteger(maxAttempts) || maxAttempts < 1
  ) {
    throw new Error("Worker attempts 无效");
  }
  return {
    id: String(value.id ?? ""),
    taskId: typeof value.taskId === "string" ? value.taskId : undefined,
    traceId: typeof value.traceId === "string" ? value.traceId : undefined,
    payload: payload.slice(0, MAX_PAYLOAD),
    status,
    attempts,
    maxAttempts: Math.min(maxAttempts, MAX_ATTEMPTS),
    leaseOwner: typeof value.leaseOwner === "string" ? value.leaseOwner : undefined,
    leaseUntil: typeof value.leaseUntil === "string" ? value.leaseUntil : undefined,
    nextAttemptAt: typeof value.nextAttemptAt === "string" ? value.nextAttemptAt : undefined,
    lastError: typeof value.lastError === "string" ? value.lastError.slice(0, 1_000) : undefined,
    idempotencyKey: typeof value.idempotencyKey === "string" ? value.idempotencyKey : undefined,
    createdAt: String(value.createdAt ?? ""),
    updatedAt: String(value.updatedAt ?? ""),
  };
}

async function readJobs(workspace: string): Promise<WorkerJob[]> {
  try {
    const value = JSON.parse(await readUtf8(await queuePath(workspace)));
    if (!Array.isArray(value) || value.length > MAX_JOBS) throw new Error("Worker Queue 无效");
    return value.map(normalizeJob);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function saveJobs(workspace: string, jobs: WorkerJob[]): Promise<void> {
  if (jobs.length > MAX_JOBS) throw new Error(`最多保存 ${MAX_JOBS} 个 Worker Job`);
  await writeJsonAtomic(await queuePath(workspace), jobs);
}

function cloneJob(job: WorkerJob): WorkerJob {
  return { ...job };
}

function touch(job: WorkerJob): void {
  job.updatedAt = new Date().toISOString();
}

function reclaimExpired(jobs: WorkerJob[], now = Date.now()): void {
  for (const job of jobs) {
    if (job.status !== "leased" || !job.leaseUntil) continue;
    if (Date.parse(job.leaseUntil) > now) continue;
    job.leaseOwner = undefined;
    job.leaseUntil = undefined;
    if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      job.lastError = "Lease expired after maximum attempts";
    } else {
      job.status = "queued";
      job.nextAttemptAt = new Date(now).toISOString();
      job.lastError = "Lease expired; queued for retry";
    }
    touch(job);
  }
}

function due(job: WorkerJob, now: number): boolean {
  return !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= now;
}

export async function enqueueWorkerJob(
  workspace: string,
  payload: string,
  options: { taskId?: string; traceId?: string; maxAttempts?: number; idempotencyKey?: string } =
    {},
): Promise<WorkerJob> {
  return await withQueueLock(workspace, async () => {
    const normalizedPayload = payload.trim();
    if (!normalizedPayload || normalizedPayload.length > MAX_PAYLOAD) {
      throw new Error("Worker payload 无效");
    }
    const maxAttempts = Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    if (maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
      throw new Error("max_attempts 必须为 1–10");
    }
    const key = idempotencyKey(options.idempotencyKey);
    const jobs = await readJobs(workspace);
    reclaimExpired(jobs);
    if (key) {
      const existing = jobs.find((job) => job.idempotencyKey === key);
      if (existing) {
        await saveJobs(workspace, jobs);
        return cloneJob(existing);
      }
    }
    const now = new Date().toISOString();
    const job: WorkerJob = {
      id: `job-${crypto.randomUUID().slice(0, 12)}`,
      taskId: options.taskId,
      traceId: options.traceId,
      payload: normalizedPayload,
      status: "queued",
      attempts: 0,
      maxAttempts,
      idempotencyKey: key,
      createdAt: now,
      updatedAt: now,
    };
    jobs.push(job);
    await saveJobs(workspace, jobs);
    return cloneJob(job);
  });
}

export async function leaseWorkerJob(
  workspace: string,
  workerId: string,
  leaseSeconds = DEFAULT_LEASE_SECONDS,
): Promise<WorkerJob | undefined> {
  return await withQueueLock(workspace, async () => {
    const owner = workerId.trim();
    if (!owner || owner.length > 120) throw new Error("worker_id 无效");
    const seconds = Math.floor(leaseSeconds);
    if (seconds < 5 || seconds > MAX_LEASE_SECONDS) {
      throw new Error("lease_seconds 必须为 5–3600");
    }
    const jobs = await readJobs(workspace), now = Date.now();
    reclaimExpired(jobs, now);
    const job = jobs.find((item) => item.status === "queued" && due(item, now));
    if (!job) {
      await saveJobs(workspace, jobs);
      return undefined;
    }
    job.status = "leased";
    job.attempts += 1;
    job.leaseOwner = owner;
    job.leaseUntil = new Date(now + seconds * 1_000).toISOString();
    job.nextAttemptAt = undefined;
    touch(job);
    await saveJobs(workspace, jobs);
    return cloneJob(job);
  });
}

export async function settleWorkerJob(
  workspace: string,
  id: string,
  workerId: string,
  success: boolean,
  error?: string,
): Promise<WorkerJob> {
  return await withQueueLock(workspace, async () => {
    const jobs = await readJobs(workspace), job = jobs.find((item) => item.id === id);
    if (!job) throw new Error("Worker Job 不存在");
    if (job.status !== "leased") throw new Error("Worker Job 当前不在 leased 状态");
    if (job.leaseUntil && Date.parse(job.leaseUntil) <= Date.now()) {
      reclaimExpired(jobs);
      await saveJobs(workspace, jobs);
      throw new Error("Worker Lease 已过期，Job 已回收");
    }
    if (job.leaseOwner !== workerId.trim()) throw new Error("Worker Lease 所有者不匹配");
    job.leaseOwner = undefined;
    job.leaseUntil = undefined;
    if (success) {
      job.status = "done";
      job.lastError = undefined;
    } else if (job.attempts >= job.maxAttempts) {
      job.status = "dead";
      job.lastError = String(error ?? "Worker failed").slice(0, 1_000);
    } else {
      job.status = "queued";
      job.lastError = String(error ?? "Worker failed").slice(0, 1_000);
      const delay = Math.min(60_000, 1_000 * 2 ** Math.max(0, job.attempts - 1));
      job.nextAttemptAt = new Date(Date.now() + delay).toISOString();
    }
    touch(job);
    await saveJobs(workspace, jobs);
    return cloneJob(job);
  });
}

export async function readWorkerJobs(workspace: string, id?: string): Promise<WorkerJob[]> {
  return await withQueueLock(workspace, async () => {
    const jobs = await readJobs(workspace);
    reclaimExpired(jobs);
    await saveJobs(workspace, jobs);
    return jobs.filter((job) => !id || job.id === id).map(cloneJob);
  });
}
