import { type AgentEvent, agentLoop as previousAgentLoop } from "./s21_bounded_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Trace = { traceId: string; spanId: string; parent?: string; name: string; ms: number };
export class TraceBook {
  readonly spans: Trace[] = [];
  async span<T>(name: string, work: (trace: Trace) => Promise<T>, parent?: Trace) {
    const trace = {
        traceId: parent?.traceId ?? crypto.randomUUID(),
        spanId: crypto.randomUUID().slice(0, 8),
        parent: parent?.spanId,
        name,
        ms: 0,
      },
      started = performance.now();
    try {
      return await work(trace);
    } finally {
      trace.ms = Math.round(performance.now() - started);
      this.spans.push(trace);
    }
  }
}
export function validate(input: unknown, required: string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("object input required");
  }
  for (const key of required) if (!(key in input)) throw new Error(`missing ${key}`);
  return input as Record<string, unknown>;
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "typed_trace",
    description: "Validate structured input and emit trace-linked model and tool spans",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(definition, async (input) => {
  const traces = new TraceBook();
  const result = await traces.span(
    "agent",
    async (root) =>
      await traces.span("tool", async () => String(validate(input, ["text"]).text), root),
  );
  return JSON.stringify({ result, spans: traces.spans });
});
registerSystemPromptSection({
  id: "s22-contracts",
  title: "Structured contracts and tracing",
  priority: 33,
  content:
    "Validate inputs and outputs at every boundary. Propagate one trace through UI, agent, provider, tool, protocol, worker, and evaluation events.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
