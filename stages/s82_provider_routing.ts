import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "./s81_production_runtime_adapter.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ProviderProfile = {
  id: string;
  quality: number;
  latencyMs: number;
  costPerCall: number;
  capabilities: Set<string>;
};
export type RouteRequest = {
  capability: string;
  minQuality: number;
  maxCost: number;
  maxLatencyMs: number;
};
export class ProviderRouter {
  private readonly failures = new Map<string, number>();
  constructor(private readonly providers: ProviderProfile[]) {}
  choose(request: RouteRequest) {
    const candidates = this.providers.filter((provider) =>
      provider.capabilities.has(request.capability) && provider.quality >= request.minQuality &&
      provider.costPerCall <= request.maxCost && provider.latencyMs <= request.maxLatencyMs &&
      (this.failures.get(provider.id) ?? 0) < 3
    ).sort((a, b) =>
      (a.costPerCall + a.latencyMs / 10_000) - (b.costPerCall + b.latencyMs / 10_000)
    );
    const selected = candidates[0];
    if (!selected) throw new Error("no provider satisfies route");
    return selected;
  }
  recordFailure(id: string) {
    this.failures.set(id, (this.failures.get(id) ?? 0) + 1);
  }
  recordSuccess(id: string) {
    this.failures.delete(id);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "provider_routing",
    description: "Route by capability, quality, latency, cost, and circuit-breaker state",
    parameters: {
      type: "object",
      properties: { capability: { type: "string" } },
      required: ["capability"],
    },
  },
};
registerTool(definition, async (input) => {
  const router = new ProviderRouter([{
    id: "fast",
    quality: .8,
    latencyMs: 100,
    costPerCall: .02,
    capabilities: new Set(["chat"]),
  }, {
    id: "quality",
    quality: .98,
    latencyMs: 900,
    costPerCall: .2,
    capabilities: new Set(["chat", "reasoning"]),
  }]);
  return JSON.stringify(
    router.choose({
      capability: String(input.capability),
      minQuality: .7,
      maxCost: .1,
      maxLatencyMs: 500,
    }),
  );
});
registerSystemPromptSection({
  id: "s82-provider-routing",
  title: "Provider capability and cost routing",
  priority: 63,
  content:
    "Choose models by declared capability, quality, latency, and cost. Track failures per provider and open a circuit instead of retrying a broken endpoint forever.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s82 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
