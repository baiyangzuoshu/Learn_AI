import { type AgentEvent, agentLoop as previousAgentLoop } from "./s37_security_governance.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ModelOption = {
  id: string;
  inputPerMillion: number;
  outputPerMillion: number;
  latencyMs: number;
  quality: number;
};
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelOption,
): number {
  return (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1_000_000;
}
export function routeModel(
  options: ModelOption[],
  requirement: { quality: number; latencyMs: number },
) {
  return [...options].filter((item) =>
    item.quality >= requirement.quality && item.latencyMs <= requirement.latencyMs
  )
    .sort((a, b) => estimateCost(1000, 500, a) - estimateCost(1000, 500, b))[0] ?? null;
}
export function cacheKey(model: string, prompt: string) {
  let hash = 2166136261;
  for (const char of `${model}:${prompt}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "cost_latency_route",
    description: "Select a model under quality and latency constraints",
    parameters: {
      type: "object",
      properties: { quality: { type: "number" }, latencyMs: { type: "number" } },
      required: ["quality", "latencyMs"],
    },
  },
};
registerTool(definition, async (input) => {
  const models: ModelOption[] = [
    { id: "fast", inputPerMillion: 0.2, outputPerMillion: 0.4, latencyMs: 300, quality: 0.7 },
    { id: "accurate", inputPerMillion: 2, outputPerMillion: 8, latencyMs: 1600, quality: 0.95 },
  ];
  const selected = routeModel(models, {
    quality: Number(input.quality),
    latencyMs: Number(input.latencyMs),
  });
  return JSON.stringify({
    selected,
    cacheKey: cacheKey(selected?.id ?? "none", "teaching prompt"),
  });
});
registerSystemPromptSection({
  id: "s38-cost-latency-routing",
  title: "Cost, latency, and routing",
  priority: 19,
  content:
    "Treat model choice as a policy: estimate token cost, enforce latency and quality SLOs, cache deterministic work, and record the decision for later evaluation.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(routeModel([
    { id: "fast", inputPerMillion: 0.2, outputPerMillion: 0.4, latencyMs: 300, quality: 0.7 },
  ], { quality: 0.6, latencyMs: 500 }));
  const query = prompt("s38 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
