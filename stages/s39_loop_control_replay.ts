import { type AgentEvent, agentLoop as previousAgentLoop } from "./s38_cost_latency_routing.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type SupportFlow = {
  intent: string;
  route: "triage" | "retrieve" | "ground" | "act" | "escalate";
  cited: boolean;
};
export function supportFlow(intent: string, hasEvidence: boolean, canAct: boolean): SupportFlow {
  return !intent
    ? { intent, route: "triage", cited: false }
    : !hasEvidence
    ? { intent, route: "retrieve", cited: false }
    : !canAct
    ? { intent, route: "escalate", cited: true }
    : { intent, route: "act", cited: true };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "support_architecture",
    description:
      "Compose router, retrieval, grounding, action guardrail, and human escalation into one evidence-first product flow",
    parameters: {
      type: "object",
      properties: { intent: { type: "string" } },
      required: ["intent"],
    },
  },
};
registerTool(
  definition,
  async (input) => JSON.stringify(supportFlow(String(input.intent), true, true)),
);
registerSystemPromptSection({
  id: "s39-product-flow",
  title: "Evidence-first product architecture",
  priority: 50,
  content:
    "Real products compose narrow agents: triage, retrieval, grounding, action guardrail, answer, and escalation. Claims require evidence; risky actions require identity and approval.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
