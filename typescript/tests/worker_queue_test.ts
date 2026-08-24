import { setAppDataPath } from "../src/platform.ts";
import {
  enqueueWorkerJob,
  leaseWorkerJob,
  readWorkerJobs,
  settleWorkerJob,
} from "../src/worker_queue.ts";

const root = `/private/tmp/ai-agent-worker-queue-${crypto.randomUUID()}`;
setAppDataPath(`${root}/app-data`);

async function freshWorkspace(label: string): Promise<string> {
  const workspace = `${root}/${label}`;
  await Deno.mkdir(workspace, { recursive: true });
  return workspace;
}

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}

function assertMatch(actual: string, pattern: RegExp): void {
  if (!pattern.test(actual)) throw new Error(`expected ${actual} to match ${pattern}`);
}

Deno.test("worker queue is idempotent and exposes lease/retry state", async () => {
  const workspace = await freshWorkspace("retry");
  const first = await enqueueWorkerJob(workspace, "render image", {
    maxAttempts: 2,
    idempotencyKey: "render-1",
    taskId: "task-1",
    traceId: "trace-1",
  });
  const duplicate = await enqueueWorkerJob(workspace, "different payload", {
    idempotencyKey: "render-1",
  });
  assertEquals(duplicate.id, first.id);
  assertEquals(duplicate.payload, "render image");

  const leased = await leaseWorkerJob(workspace, "worker-a", 5);
  assertEquals(leased?.id, first.id);
  assertEquals(leased?.status, "leased");
  assertEquals(leased?.attempts, 1);
  assertEquals(leased?.leaseOwner, "worker-a");
  assertMatch(leased?.leaseUntil ?? "", /^20/);

  const retry = await settleWorkerJob(workspace, first.id, "worker-a", false, "temporary failure");
  assertEquals(retry.status, "queued");
  assertEquals(retry.attempts, 1);
  assertEquals(retry.lastError, "temporary failure");
  assertEquals((await readWorkerJobs(workspace, first.id))[0].status, "queued");
});

Deno.test("worker queue moves exhausted jobs to dead letter", async () => {
  const workspace = await freshWorkspace("dead-letter");
  const job = await enqueueWorkerJob(workspace, "must fail", { maxAttempts: 1 });
  const leased = await leaseWorkerJob(workspace, "worker-b", 5);
  assertEquals(leased?.id, job.id);
  const dead = await settleWorkerJob(workspace, job.id, "worker-b", false, "permanent failure");
  assertEquals(dead.status, "dead");
  assertEquals(dead.lastError, "permanent failure");
  assertEquals((await readWorkerJobs(workspace, job.id))[0].status, "dead");
});
