import { type AgentEvent, agentLoop } from "./s28_checkpoint_resume.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_assess",
    description:
      "Gate execution using confidence, evidence, knowledge gaps, and stagnation signals",
    parameters: {
      type: "object",
      properties: {
        confidence: { type: "number" },
        evidence: { type: "array" },
        knowledge_gaps: { type: "array" },
        recent_actions: { type: "array" },
      },
      required: ["confidence", "evidence", "knowledge_gaps", "recent_actions"],
    },
  },
};
registerTool(definition, async (input) => {
  const confidence = Number(input.confidence);
  const evidence = Array.isArray(input.evidence) ? input.evidence.map(String) : [];
  const knowledgeGaps = Array.isArray(input.knowledge_gaps) ? input.knowledge_gaps.map(String) : [];
  const recentActions = Array.isArray(input.recent_actions) ? input.recent_actions.map(String) : [];
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  if ([evidence, knowledgeGaps, recentActions].some((items) => items.length > 100)) {
    throw new Error("cognitive input exceeds 100 items");
  }
  const tail = recentActions.slice(-3);
  const stagnating = tail.length === 3 && new Set(tail).size === 1;
  const gate = stagnating
    ? "pivot"
    : knowledgeGaps.length > 0 || confidence < 0.5 || evidence.length === 0
    ? "gather-evidence"
    : confidence < 0.8
    ? "ask-or-verify"
    : "act";
  return JSON.stringify({
    gate,
    confidence,
    stagnating,
    evidenceCount: evidence.length,
    knowledgeGaps,
  });
});
registerSystemPromptSection({
  id: "s29-cognitive-monitor",
  title: "Cognitive monitor",
  priority: 10,
  content:
    "Maintain explicit confidence, evidence, knowledge gaps, and recent actions. Gate risky execution on evidence, detect repeated-action stagnation, pivot strategy when stuck, and expose uncertainty instead of fabricating certainty.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s29 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
