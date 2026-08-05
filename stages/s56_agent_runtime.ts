import { type AgentEvent, agentLoop as previousAgentLoop } from "./s55_evaluation_harness.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type RuntimeToolCall = { id: string; name: string; arguments: Record<string, unknown> };
export type RuntimeModel = (
  messages: string[],
  tools: string[],
  signal: AbortSignal,
) => Promise<{ text?: string; calls?: RuntimeToolCall[] }>;
export type RuntimeEvent = {
  sequence: number;
  type: "model" | "tool" | "stop" | "error";
  name?: string;
  detail: string;
};
export type RuntimeLimits = { maxIterations: number; maxToolCalls: number; maxOutputChars: number };

export class BoundedAgentRuntime {
  readonly events: RuntimeEvent[] = [];
  constructor(
    readonly model: RuntimeModel,
    readonly handlers: Record<
      string,
      (args: Record<string, unknown>, signal: AbortSignal) => Promise<string>
    >,
    readonly limits: RuntimeLimits,
  ) {}
  private emit(type: RuntimeEvent["type"], detail: string, name?: string) {
    this.events.push({
      sequence: this.events.length + 1,
      type,
      name,
      detail: detail.slice(0, this.limits.maxOutputChars),
    });
  }
  async run(query: string, signal = new AbortController().signal): Promise<string> {
    const messages = [query];
    let toolCalls = 0;
    for (let iteration = 0; iteration < this.limits.maxIterations; iteration++) {
      if (signal.aborted) throw new DOMException("agent canceled", "AbortError");
      const response = await this.model(messages, Object.keys(this.handlers), signal);
      this.emit("model", response.text ?? "", "model");
      if (!response.calls?.length) {
        this.emit("stop", "answer");
        return (response.text ?? "").slice(0, this.limits.maxOutputChars);
      }
      for (const call of response.calls) {
        if (++toolCalls > this.limits.maxToolCalls) {
          this.emit("stop", "tool budget exhausted");
          return "Stopped: tool budget exhausted";
        }
        const handler = this.handlers[call.name];
        if (!handler) {
          this.emit("error", `unknown tool ${call.name}`, call.name);
          continue;
        }
        const output = await handler(call.arguments, signal);
        this.emit("tool", output, call.name);
        messages.push(`${call.name}: ${output}`);
      }
    }
    this.emit("stop", "iteration budget exhausted");
    return "Stopped: iteration budget exhausted";
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "agent_runtime_demo",
    description: "Run a real bounded model-tool loop with cancellation and structured events",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(definition, async (input) => {
  let calls = 0;
  const runtime = new BoundedAgentRuntime(
    async () =>
      calls++
        ? { text: "done" }
        : { calls: [{ id: "1", name: "echo", arguments: { text: String(input.query) } }] },
    { echo: async (args) => String(args.text) },
    { maxIterations: 4, maxToolCalls: 4, maxOutputChars: 2_000 },
  );
  const answer = await runtime.run(String(input.query));
  return JSON.stringify({ answer, events: runtime.events });
});
registerSystemPromptSection({
  id: "s56-agent-runtime",
  title: "Bounded Agent runtime",
  priority: 37,
  content:
    "Keep one runtime loop responsible for model calls, tool authorization boundaries, cancellation, iteration/tool/output budgets, structured events, and graceful stop reasons. Features should plug into contracts rather than create hidden loops.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s56 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
