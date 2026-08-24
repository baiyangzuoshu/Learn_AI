import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import {
  enqueueWorkerJob,
  leaseWorkerJob,
  readWorkerJobs,
  settleWorkerJob,
} from "../worker_queue.ts";
import type { WorkerJob } from "../worker_queue.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

function compact(job: WorkerJob): WorkerJob {
  return { ...job, payload: job.payload.slice(0, 240), lastError: job.lastError?.slice(0, 240) };
}

function workerOutput(job: WorkerJob | null | undefined, jobs: WorkerJob[] = []): string {
  return JSON.stringify({
    worker: job ? compact(job) : null,
    workers: jobs.slice(-20).map(compact),
  });
}

export const workerQueue: HarnessFeature = {
  id: "worker-queue",
  register({ tools, prompts }) {
    tools.register(
      definition(
        "worker_enqueue",
        "Enqueue a durable worker job for bounded background processing",
        {
          payload: { type: "string" },
          task_id: { type: "string" },
          trace_id: { type: "string" },
          max_attempts: { type: "integer", minimum: 1, maximum: 10 },
          idempotency_key: { type: "string" },
        },
        ["payload"],
      ),
      async (input, context) =>
        workerOutput(
          await enqueueWorkerJob(
            context.workspace,
            String(input.payload ?? ""),
            {
              taskId: typeof input.task_id === "string" ? input.task_id : undefined,
              traceId: typeof input.trace_id === "string" ? input.trace_id : undefined,
              maxAttempts: typeof input.max_attempts === "number" ? input.max_attempts : undefined,
              idempotencyKey: typeof input.idempotency_key === "string"
                ? input.idempotency_key
                : undefined,
            },
          ),
        ),
    );
    tools.register(
      definition("worker_lease", "Claim the next due worker job with a time-bounded lease", {
        worker_id: { type: "string" },
        lease_seconds: { type: "integer", minimum: 5, maximum: 3600 },
      }, ["worker_id"]),
      async (input, context) =>
        workerOutput(
          await leaseWorkerJob(
            context.workspace,
            String(input.worker_id ?? ""),
            typeof input.lease_seconds === "number" ? input.lease_seconds : undefined,
          ),
        ),
    );
    tools.register(
      definition(
        "worker_settle",
        "Complete or fail a leased worker job; failures retry or dead-letter",
        {
          id: { type: "string" },
          worker_id: { type: "string" },
          success: { type: "boolean" },
          error: { type: "string" },
        },
        ["id", "worker_id", "success"],
      ),
      async (input, context) =>
        workerOutput(
          await settleWorkerJob(
            context.workspace,
            String(input.id ?? ""),
            String(input.worker_id ?? ""),
            input.success === true,
            typeof input.error === "string" ? input.error : undefined,
          ),
        ),
    );
    tools.register(
      definition("worker_status", "Read current worker queue jobs and retry/dead-letter state", {
        id: { type: "string" },
      }, []),
      async (input, context) => {
        const jobs = await readWorkerJobs(
          context.workspace,
          typeof input.id === "string" ? input.id : undefined,
        );
        return workerOutput(jobs.at(-1) ?? null, jobs);
      },
    );
    prompts.register({
      id: "worker-workloads",
      title: "Worker queue and leases",
      priority: 36,
      content:
        "Use the Worker Queue for bounded background work: enqueue a small idempotent payload, lease it with a worker identity, and settle it explicitly. Leases expire and are reclaimed; failed attempts use bounded exponential retry and become Dead Letter after max_attempts. Never claim a job without a worker_id, and never hide a dead-lettered job from the user.",
    });
  },
};
