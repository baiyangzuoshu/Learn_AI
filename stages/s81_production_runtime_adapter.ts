import { type AgentEvent, agentLoop as previousAgentLoop } from "./s80_aiops_release_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ProductionRun = {
  query: string;
  workspace: string;
  budget: { iterations: number; tools: number; output: number };
  traceId: string;
};
export type RuntimeAdapterEvent = {
  type: "start" | "budget" | "complete" | "failed";
  detail: string;
  traceId: string;
};
export interface RuntimePort {
  run(input: ProductionRun, signal?: AbortSignal): Promise<string>;
}

export class GuardedRuntimeAdapter {
  constructor(
    private readonly runtime: RuntimePort,
    private readonly emit: (event: RuntimeAdapterEvent) => void,
  ) {}
  async execute(input: ProductionRun, signal?: AbortSignal) {
    this.emit({ type: "start", detail: input.workspace, traceId: input.traceId });
    if (!input.query.trim()) throw new Error("query is required");
    if (input.budget.iterations < 1 || input.budget.tools < 0 || input.budget.output < 1) {
      throw new Error("invalid runtime budget");
    }
    try {
      const output = await this.runtime.run(input, signal);
      if (output.length > input.budget.output) throw new Error("runtime output budget exceeded");
      this.emit({ type: "complete", detail: `${output.length} chars`, traceId: input.traceId });
      return output;
    } catch (error) {
      this.emit({
        type: "failed",
        detail: error instanceof Error ? error.message : String(error),
        traceId: input.traceId,
      });
      throw error;
    }
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "production_runtime_adapter",
    description:
      "Adapt a bounded production run through an explicit workspace, budget, signal, and trace contract",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  const events: RuntimeAdapterEvent[] = [],
    adapter = new GuardedRuntimeAdapter(
      { run: async (run) => `handled:${run.query}` },
      (event) => events.push(event),
    );
  const output = await adapter.execute({
    query: String(input.query),
    workspace: "/workspace",
    budget: { iterations: 4, tools: 3, output: 1000 },
    traceId: crypto.randomUUID(),
  });
  return JSON.stringify({ output, events });
});
registerSystemPromptSection({
  id: "s81-production-runtime-adapter",
  title: "Production Runtime adapter",
  priority: 62,
  content:
    "Production features call one AgentRuntime through a typed adapter carrying workspace, budgets, cancellation, and trace context; they never create competing loops.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s81 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
