import { type AgentEvent, agentLoop as previousAgentLoop } from "./s63_memory_database.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type RuntimeEvent = { type: "model" | "tool" | "error" | "done"; data: string };
export interface ModelProvider {
  complete(input: string, signal: AbortSignal): AsyncIterable<string>;
}
export type RuntimeOptions = { maxIterations?: number; maxOutput?: number; retries?: number };

export class ProviderAgentRuntime {
  constructor(
    private readonly provider: ModelProvider,
    private readonly options: RuntimeOptions = {},
  ) {}
  async run(input: string, signal = new AbortController().signal): Promise<RuntimeEvent[]> {
    const events: RuntimeEvent[] = [];
    const maxOutput = this.options.maxOutput ?? 2_000;
    let attempt = 0;
    while (attempt <= (this.options.retries ?? 2)) {
      try {
        let output = "";
        for await (const chunk of this.provider.complete(input, signal)) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          output += chunk;
          if (output.length > maxOutput) throw new Error("model output budget exceeded");
          events.push({ type: "model", data: chunk });
        }
        const parsed = JSON.parse(output) as { answer?: unknown };
        if (typeof parsed.answer !== "string") throw new Error("provider schema requires answer");
        events.push({ type: "done", data: parsed.answer });
        return events;
      } catch (error) {
        attempt++;
        if (
          attempt > (this.options.retries ?? 2) ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          events.push({
            type: "error",
            data: error instanceof Error ? error.message : String(error),
          });
          return events;
        }
      }
    }
    return events;
  }
}

class LessonProvider implements ModelProvider {
  async *complete(input: string) {
    yield JSON.stringify({ answer: `provider handled: ${input}` });
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "provider_agent_runtime",
    description: "Run a streaming provider through a bounded, cancellable, schema-checked runtime",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(await new ProviderAgentRuntime(new LessonProvider()).run(String(input.input))),
);
registerSystemPromptSection({
  id: "s64-provider-runtime",
  title: "Provider-integrated Agent Runtime",
  priority: 45,
  content:
    "The runtime owns provider streaming, output/schema budgets, cancellation, retries, and typed events. Provider implementations remain replaceable adapters.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s64 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
