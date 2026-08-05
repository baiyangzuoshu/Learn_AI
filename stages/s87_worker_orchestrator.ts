import { type AgentEvent, agentLoop as previousAgentLoop } from "./s86_eval_pipeline.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type WorkItem = {
  id: string;
  traceId: string;
  attempt: number;
  leaseOwner?: string;
  leaseUntil?: number;
  status: "queued" | "leased" | "done" | "dead";
};
export class WorkerOrchestrator {
  readonly items = new Map<string, WorkItem>();
  enqueue(traceId: string) {
    const item: WorkItem = {
      id: `work-${crypto.randomUUID().slice(0, 8)}`,
      traceId,
      attempt: 0,
      status: "queued",
    };
    this.items.set(item.id, item);
    return item;
  }
  lease(worker: string, now = Date.now(), ttlMs = 30_000) {
    const item = [...this.items.values()].find((value) =>
      value.status === "queued" || (value.status === "leased" && (value.leaseUntil ?? 0) <= now)
    );
    if (!item) return;
    item.status = "leased";
    item.leaseOwner = worker;
    item.leaseUntil = now + ttlMs;
    item.attempt++;
    return item;
  }
  settle(id: string, success: boolean, maxAttempts = 3) {
    const item = this.items.get(id);
    if (!item) throw new Error("work not found");
    item.status = success ? "done" : item.attempt >= maxAttempts ? "dead" : "queued";
    delete item.leaseOwner;
    delete item.leaseUntil;
    return item;
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "worker_orchestrator",
    description:
      "Lease trace-linked worker jobs and settle them through retries or dead-letter state",
    parameters: {
      type: "object",
      properties: { worker: { type: "string" } },
      required: ["worker"],
    },
  },
};
registerTool(definition, async (input) => {
  const orchestrator = new WorkerOrchestrator(),
    item = orchestrator.enqueue(crypto.randomUUID()),
    leased = orchestrator.lease(String(input.worker));
  return JSON.stringify({
    leased,
    settled: leased && orchestrator.settle(leased.id, true),
    items: [...orchestrator.items.values()],
  });
});
registerSystemPromptSection({
  id: "s87-worker-orchestrator",
  title: "Trace-linked Worker orchestration",
  priority: 68,
  content:
    "Long-running agents run as leased workers. Every item carries trace context, bounded attempts, deterministic settlement, and dead-letter evidence.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s87 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
