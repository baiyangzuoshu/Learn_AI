import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s24_retrieval_augmented_memory/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Job = {
  id: string;
  traceId: string;
  attempts: number;
  status: "queued" | "leased" | "done" | "dead";
  leaseUntil?: number;
};
export class DurableWork {
  readonly jobs = new Map<string, Job>();
  enqueue(traceId: string) {
    const job = {
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
      traceId,
      attempts: 0,
      status: "queued" as const,
    };
    this.jobs.set(job.id, job);
    return job;
  }
  lease(now = Date.now()) {
    const job = [...this.jobs.values()].find((item) =>
      item.status === "queued" || (item.status === "leased" && (item.leaseUntil ?? 0) < now)
    );
    if (!job) return;
    job.status = "leased";
    job.attempts++;
    job.leaseUntil = now + 30_000;
    return job;
  }
  settle(id: string, ok: boolean) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("job missing");
    job.status = ok ? "done" : job.attempts >= 3 ? "dead" : "queued";
    return job;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "durable_work",
    description:
      "Run background, scheduled, and queued work through lease, retry, cancellation, and dead-letter states",
    parameters: { type: "object", properties: {} },
  },
};
registerTool(definition, async () => {
  const queue = new DurableWork(), job = queue.enqueue(crypto.randomUUID()), leased = queue.lease();
  return JSON.stringify(leased && queue.settle(job.id, true));
});
registerSystemPromptSection({
  id: "s25-workloads",
  title: "Background, scheduler, and worker workloads",
  priority: 36,
  content:
    "HTTP admission, scheduled execution, and long-running agent work are separate. Lease work, bound retries, propagate cancellation, and preserve dead-letter evidence.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s25 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
