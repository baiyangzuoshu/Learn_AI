import { type AgentEvent, agentLoop as previousAgentLoop } from "./s33_flow_handoff_guardrails.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Release = {
  version: string;
  prompt: string;
  tools: string;
  model: string;
  schema: number;
};
export type Metric = { success: number; p95: number; cost: number; error: number };
export function promote(release: Release, metric: Metric) {
  const reasons = [
    !/^\d+\.\d+\.\d+$/.test(release.version) ? "invalid version" : "",
    metric.success < .98 ? "success SLO" : "",
    metric.p95 > 800 ? "latency SLO" : "",
    metric.cost > 1 ? "cost SLO" : "",
    metric.error > .05 ? "error SLO" : "",
  ].filter(Boolean);
  return {
    promoted: !reasons.length,
    canaryPercent: reasons.length ? 0 : 10,
    rollback: !!reasons.length,
    reasons,
  };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "release_gate",
    description: "Version prompt, tools, model, and schema; promote by SLO canary gate or rollback",
    parameters: {
      type: "object",
      properties: { version: { type: "string" } },
      required: ["version"],
    },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      promote({ version: String(input.version), prompt: "p", tools: "t", model: "m", schema: 1 }, {
        success: 1,
        p95: 200,
        cost: .1,
        error: 0,
      }),
    ),
);
registerSystemPromptSection({
  id: "s34-release",
  title: "Release, canary, rollback, and AIOps",
  priority: 45,
  content:
    "Release a versioned prompt/tool/model/schema manifest through evaluation, security, SLO, canary, alert, rollback, and incident evidence. A build is not a safe promotion.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
