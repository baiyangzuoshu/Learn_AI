import { type AgentEvent, agentLoop as previousAgentLoop } from "./s38_cost_latency_routing.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type LoopState = {
  iteration: number;
  toolCalls: number;
  elapsedMs: number;
  status: "running" | "done" | "stopped";
};
export function terminationGate(
  state: LoopState,
  limits: { iterations: number; toolCalls: number; timeoutMs: number },
) {
  if (state.iteration >= limits.iterations) return "iteration-limit";
  if (state.toolCalls >= limits.toolCalls) return "tool-limit";
  if (state.elapsedMs >= limits.timeoutMs) return "timeout";
  return null;
}

export class IdempotencyLedger {
  private readonly seen = new Set<string>();
  claim(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

export function replay<T extends { id: string }>(events: T[], uptoId?: string): T[] {
  const index = uptoId ? events.findIndex((event) => event.id === uptoId) : events.length - 1;
  return index < 0 ? [] : events.slice(0, index + 1);
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "loop_control_demo",
    description: "Apply termination, idempotency, and replay rules",
    parameters: {
      type: "object",
      properties: { iterations: { type: "number" }, toolCalls: { type: "number" } },
      required: ["iterations", "toolCalls"],
    },
  },
};
registerTool(definition, async (input) => {
  const state: LoopState = {
    iteration: Number(input.iterations),
    toolCalls: Number(input.toolCalls),
    elapsedMs: 0,
    status: "running",
  };
  const ledger = new IdempotencyLedger();
  const first = ledger.claim("request-1");
  return JSON.stringify({
    stopReason: terminationGate(state, { iterations: 10, toolCalls: 20, timeoutMs: 30_000 }),
    first,
    duplicate: ledger.claim("request-1"),
  });
});
registerSystemPromptSection({
  id: "s39-loop-control-replay",
  title: "Loops, termination, and replay",
  priority: 20,
  content:
    "Control internal, task, and meta loops with explicit termination gates. Use idempotency keys for retries and replay only verified event prefixes; never let a model-defined loop run unbounded.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    terminationGate({ iteration: 10, toolCalls: 0, elapsedMs: 0, status: "running" }, {
      iterations: 10,
      toolCalls: 20,
      timeoutMs: 1000,
    }),
  );
  const query = prompt("s39 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
