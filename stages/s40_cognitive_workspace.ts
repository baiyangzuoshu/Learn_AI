import { type AgentEvent, agentLoop as previousAgentLoop } from "./s39_loop_control_replay.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type WorkspaceItem = {
  id: string;
  text: string;
  salience: number;
  tokens: number;
  source: string;
};
export function allocateAttention(items: WorkspaceItem[], budget: number): WorkspaceItem[] {
  let remaining = budget;
  return [...items].sort((a, b) => b.salience - a.salience).filter((item) => {
    if (item.tokens > remaining) return false;
    remaining -= item.tokens;
    return true;
  });
}
export function calibrate(confidence: number, evidenceCount: number, contradictionCount: number) {
  const penalty = Math.min(0.8, contradictionCount * 0.2);
  const support = Math.min(0.2, evidenceCount * 0.05);
  return Math.max(0, Math.min(1, confidence + support - penalty));
}
export function adapt(recentErrors: number, repeatedAction: boolean) {
  if (repeatedAction) return "pivot";
  if (recentErrors > 2) return "slow-down-and-verify";
  return "continue";
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cognitive_workspace_monitor",
    description: "Allocate attention and calibrate confidence before acting",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array" },
        budget: { type: "number" },
        confidence: { type: "number" },
        evidence: { type: "number" },
        contradictions: { type: "number" },
        errors: { type: "number" },
        repeated: { type: "boolean" },
      },
      required: [
        "items",
        "budget",
        "confidence",
        "evidence",
        "contradictions",
        "errors",
        "repeated",
      ],
    },
  },
};
registerTool(definition, async (input) => {
  const items = Array.isArray(input.items) ? input.items as WorkspaceItem[] : [];
  return JSON.stringify({
    focus: allocateAttention(items, Number(input.budget)),
    confidence: calibrate(
      Number(input.confidence),
      Number(input.evidence),
      Number(input.contradictions),
    ),
    adaptation: adapt(Number(input.errors), Boolean(input.repeated)),
  });
});
registerSystemPromptSection({
  id: "s40-cognitive-workspace",
  title: "Cognitive workspace",
  priority: 21,
  content:
    "Treat context as a limited workspace: allocate attention by salience and token cost, monitor evidence and contradictions, calibrate confidence, and adapt when errors or repeated actions signal stagnation.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(adapt(0, true));
  const query = prompt("s40 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
