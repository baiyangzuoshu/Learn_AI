import { type AgentEvent, agentLoop as previousAgentLoop } from "./s66_observability_evaluation.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Job = {
  id: string;
  input: string;
  attempts: number;
  state: "queued" | "leased" | "done" | "dead";
  leaseUntil?: number;
  error?: string;
};

export class DurableQueue {
  readonly jobs = new Map<string, Job>();
  enqueue(input: string, id = `job-${crypto.randomUUID().slice(0, 8)}`) {
    const existing = this.jobs.get(id);
    if (existing) return existing;
    const job = { id, input: input.slice(0, 4_000), attempts: 0, state: "queued" as const };
    this.jobs.set(id, job);
    return job;
  }
  lease(now = Date.now(), ttlMs = 5_000) {
    const job = [...this.jobs.values()].find((item) =>
      item.state === "queued" || (item.state === "leased" && (item.leaseUntil ?? 0) < now)
    );
    if (!job) return undefined;
    job.state = "leased";
    job.leaseUntil = now + ttlMs;
    job.attempts++;
    return job;
  }
  ack(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.state = "done";
      delete job.leaseUntil;
    }
  }
  fail(id: string, error: string, maxAttempts = 3) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.attempts >= maxAttempts) {
      job.state = "dead";
      job.error = error;
    } else {
      job.state = "queued";
      job.error = error;
    }
  }
}

export async function createDeployHandler(queue = new DurableQueue()) {
  return async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ ok: true, queued: queue.jobs.size });
    }
    if (url.pathname === "/jobs" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      return Response.json(queue.enqueue(String(body.input ?? "")), { status: 202 });
    }
    if (url.pathname === "/jobs" && request.method === "GET") {
      return Response.json([...queue.jobs.values()]);
    }
    return Response.json({ error: "not found" }, { status: 404 });
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "durable_deploy_runtime",
    description: "Enqueue an idempotent job, lease it, and acknowledge or dead-letter failures",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const queue = new DurableQueue();
  const job = queue.enqueue(String(input.input), "demo-job");
  const leased = queue.lease();
  if (leased) queue.ack(leased.id);
  return JSON.stringify({ job, leased, jobs: [...queue.jobs.values()] });
});
registerSystemPromptSection({
  id: "s67-durable-deploy",
  title: "Durable queue and deployment runtime",
  priority: 48,
  content:
    "Separate HTTP admission from worker execution. Queue jobs are idempotent, leased, retryable, acknowledged, and dead-lettered instead of being lost on process restart.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s67 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
