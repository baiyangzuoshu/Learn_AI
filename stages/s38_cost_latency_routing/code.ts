import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s37_security_governance/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Observation = {
  traceId: string;
  promptChars: number;
  toolCalls: number;
  latencyMs: number;
  cost: number;
  success: boolean;
};
export function summarize(observations: Observation[]) {
  const sorted = [...observations].sort((a, b) => a.latencyMs - b.latencyMs);
  return {
    successRate: observations.filter((item) => item.success).length /
      Math.max(1, observations.length),
    p95: sorted[Math.floor(Math.max(0, sorted.length - 1) * .95)]?.latencyMs ?? 0,
    cost: observations.reduce((sum, item) => sum + item.cost, 0),
  };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "agent_observability",
    description:
      "Summarize trace-linked success, latency, cost, prompt size, and tool usage for AIOps",
    parameters: { type: "object", properties: {} },
  },
};
registerTool(
  definition,
  async () =>
    JSON.stringify(
      summarize([{
        traceId: crypto.randomUUID(),
        promptChars: 200,
        toolCalls: 1,
        latencyMs: 200,
        cost: .02,
        success: true,
      }]),
    ),
);
registerSystemPromptSection({
  id: "s38-observability",
  title: "Observability, cost, and AIOps",
  priority: 49,
  content:
    "Trace prompts, model calls, tools, protocols, workers, latency, cost, outcomes, and downstream dependencies. Redact PII, alert on SLO breach, and measure before optimizing.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s38 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
