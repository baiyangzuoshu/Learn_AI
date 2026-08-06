import { type AgentEvent, agentLoop as previousAgentLoop } from "../s31_structured_io/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type CognitiveState = {
  confidence: number;
  stagnation: number;
  contradiction: boolean;
  knowledgeGap: boolean;
  evidence: string[];
};
export function attention(state: CognitiveState): "act" | "retrieve" | "pivot" | "escalate" {
  if (state.confidence < .4 || state.contradiction) return "escalate";
  if (state.knowledgeGap) return "retrieve";
  return state.stagnation >= 2 ? "pivot" : "act";
}
export class CognitiveLoop {
  async run(
    state: CognitiveState,
    action: (route: ReturnType<typeof attention>) => Promise<string>,
  ) {
    const route = attention(state);
    if (route === "escalate") return { route, output: "human review required" };
    const output = await action(route);
    return { route, output, remembered: [...state.evidence, output] };
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_loop",
    description:
      "Route confidence, contradiction, stagnation, and knowledge gaps through one bounded cognitive workspace",
    parameters: {
      type: "object",
      properties: { confidence: { type: "number" } },
      required: ["confidence"],
    },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      await new CognitiveLoop().run({
        confidence: Number(input.confidence),
        stagnation: 0,
        contradiction: false,
        knowledgeGap: false,
        evidence: [],
      }, async (route) => `executed:${route}`),
    ),
);
registerSystemPromptSection({
  id: "s32-cognition",
  title: "Reasoning, research, and cognitive control",
  priority: 43,
  content:
    "Reasoning patterns are selectable primitives. A shared workspace monitors confidence, contradiction, stagnation, and knowledge gaps to act, retrieve, pivot, or escalate.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s32 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
