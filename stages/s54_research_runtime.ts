import { type AgentEvent, agentLoop as previousAgentLoop } from "./s53_persistent_memory_store.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type SourceResult = { source: string; claims: string[]; confidence: number; error?: string };
export type ResearchCheckpoint = {
  id: string;
  iteration: number;
  questions: string[];
  results: SourceResult[];
  status: "running" | "completed" | "failed";
};
export type SourceFetcher = (question: string, signal: AbortSignal) => Promise<SourceResult>;

export class ResearchRuntime {
  constructor(readonly fetcher: SourceFetcher, readonly maxIterations = 4) {}
  async run(goal: string, questions: string[], signal?: AbortSignal): Promise<ResearchCheckpoint> {
    const checkpoint: ResearchCheckpoint = {
      id: crypto.randomUUID(),
      iteration: 0,
      questions: [...questions],
      results: [],
      status: "running",
    };
    try {
      while (checkpoint.iteration < this.maxIterations && checkpoint.questions.length) {
        if (signal?.aborted) throw new DOMException("research canceled", "AbortError");
        const batch = checkpoint.questions.splice(0, 3);
        const settled = await Promise.allSettled(
          batch.map((question) => this.fetcher(question, signal ?? new AbortController().signal)),
        );
        for (const item of settled) {
          checkpoint.results.push(
            item.status === "fulfilled"
              ? item.value
              : { source: "unknown", claims: [], confidence: 0, error: String(item.reason) },
          );
        }
        checkpoint.iteration++;
        const supported = checkpoint.results.filter((item) => item.confidence >= 0.75).length;
        if (supported >= 2) break;
        checkpoint.questions.push(`${goal}: cross-check missing evidence`);
      }
      checkpoint.status = checkpoint.results.some((item) => item.confidence >= 0.75)
        ? "completed"
        : "failed";
      return checkpoint;
    } catch (error) {
      checkpoint.status = "failed";
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return checkpoint;
    }
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "research_runtime_demo",
    description: "Run bounded parallel research with cancellation and checkpoint state",
    parameters: {
      type: "object",
      properties: { goal: { type: "string" }, questions: { type: "array" } },
      required: ["goal", "questions"],
    },
  },
};
registerTool(definition, async (input) => {
  const runtime = new ResearchRuntime(async (question) => ({
    source: `source:${question}`,
    claims: [`evidence for ${question}`],
    confidence: 0.8,
  }));
  return JSON.stringify(
    await runtime.run(
      String(input.goal),
      Array.isArray(input.questions) ? input.questions.map(String) : [],
    ),
  );
});
registerSystemPromptSection({
  id: "s54-research-runtime",
  title: "Research runtime",
  priority: 35,
  content:
    "A research runtime owns external state, parallel source fetching, cancellation, retries, quality thresholds, follow-up questions, and checkpoint status. Synthesis consumes verified results only after the bounded exploration phase.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s54 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
