import { type AgentEvent, agentLoop as previousAgentLoop } from "./s35_evaluation_feedback.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Job = {
  id: string;
  payload: string;
  attempts: number;
  status: "queued" | "running" | "done" | "failed";
};

export class TeachingQueue {
  readonly jobs = new Map<string, Job>();
  enqueue(payload: string): Job {
    const job: Job = { id: `job-${this.jobs.size + 1}`, payload, attempts: 0, status: "queued" };
    this.jobs.set(job.id, job);
    return job;
  }
  async work(handler: (payload: string) => Promise<void>): Promise<Job | undefined> {
    const job = [...this.jobs.values()].find((item) => item.status === "queued");
    if (!job) return undefined;
    job.status = "running";
    job.attempts++;
    try {
      await handler(job.payload);
      job.status = "done";
    } catch {
      job.status = job.attempts < 3 ? "queued" : "failed";
    }
    return job;
  }
}

export function apiEnvelope<T>(requestId: string, result: T) {
  return { requestId, ok: true, result, error: null };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "worker_queue_demo",
    description: "Enqueue and process one bounded worker job",
    parameters: {
      type: "object",
      properties: { payload: { type: "string" } },
      required: ["payload"],
    },
  },
};
registerTool(definition, async (input) => {
  const queue = new TeachingQueue();
  const job = queue.enqueue(String(input.payload));
  await queue.work(async () => {});
  return JSON.stringify(apiEnvelope(crypto.randomUUID(), job));
});
registerSystemPromptSection({
  id: "s36-deploy-worker-queue",
  title: "Deployment, workers, and queues",
  priority: 17,
  content:
    "Separate the HTTP boundary, durable queue, and worker loop. Make jobs idempotent, retryable, observable, and bounded; a teaching Map stands in for a real queue only to expose the protocol.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const queue = new TeachingQueue();
  console.log(queue.enqueue("hello"));
  const query = prompt("s36 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
