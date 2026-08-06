import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s35_evaluation_feedback/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Provider = {
  id: string;
  capabilities: Set<string>;
  quality: number;
  latency: number;
  cost: number;
  failures: number;
};
export function selectProvider(providers: Provider[], capability: string) {
  const selected =
    providers.filter((item) => item.capabilities.has(capability) && item.failures < 3).sort((
      a,
      b,
    ) => (b.quality - a.quality) - (a.cost - b.cost) - (a.latency - b.latency))[0];
  if (!selected) throw new Error("no provider route");
  return selected;
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "provider_router",
    description: "Route models by capability, quality, latency, cost, and circuit-breaker state",
    parameters: {
      type: "object",
      properties: { capability: { type: "string" } },
      required: ["capability"],
    },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      selectProvider([{
        id: "fast",
        capabilities: new Set(["chat"]),
        quality: .8,
        latency: 100,
        cost: .02,
        failures: 0,
      }, {
        id: "quality",
        capabilities: new Set(["chat", "reasoning"]),
        quality: .98,
        latency: 800,
        cost: .2,
        failures: 0,
      }], String(input.capability)),
    ),
);
registerSystemPromptSection({
  id: "s36-providers",
  title: "Provider routing and resilience",
  priority: 47,
  content:
    "Provider adapters expose capability, usage, retryability, latency, and cost. Route deliberately, open circuits on repeated failure, use bounded fallback, and never expose credentials in telemetry.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s36 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
