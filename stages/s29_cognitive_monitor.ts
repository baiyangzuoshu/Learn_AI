import { type AgentEvent, agentLoop as previousAgentLoop } from "./s28_checkpoint_resume.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Source = { url: string; title: string; text: string; fresh: boolean };
export type ResearchResult = {
  answer: string;
  citations: string[];
  confidence: number;
  escalate: boolean;
};
export function synthesize(query: string, sources: Source[]): ResearchResult {
  const usable = sources.filter((source) => source.fresh && source.text.length > 0),
    confidence = usable.length / Math.max(1, sources.length);
  return {
    answer: usable.length
      ? `${query}: ${usable.map((source) => source.text).join(" ")}`
      : "I don't know",
    citations: usable.map((source) => source.url),
    confidence,
    escalate: confidence < .5,
  };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "grounded_research",
    description:
      "Plan research, rank fresh sources, cite evidence, and escalate when grounding is insufficient",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      synthesize(String(input.query), [{
        url: "https://source.test",
        title: "lesson",
        text: "verified evidence",
        fresh: true,
      }]),
    ),
);
registerSystemPromptSection({
  id: "s29-research",
  title: "RAG, Deep Research, and grounding",
  priority: 40,
  content:
    "Research uses a planner, bounded workers, retrieval, reranking, source freshness, citations, critic checks, checkpoints, and a truthful I-don't-know escalation path.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
