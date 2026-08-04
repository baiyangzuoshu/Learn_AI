import { type AgentEvent, agentLoop } from "./s22_structured_tracing.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

interface Criterion {
  type: "contains" | "not_contains" | "exact";
  value: string;
  weight: number;
}

export function evaluateText(actual: string, criteria: Criterion[]) {
  const results = criteria.map((criterion) => {
    const passed = criterion.type === "contains"
      ? actual.includes(criterion.value)
      : criterion.type === "not_contains"
      ? !actual.includes(criterion.value)
      : actual.trim() === criterion.value.trim();
    return { ...criterion, passed };
  });
  const possible = results.reduce((sum, item) => sum + item.weight, 0);
  const earned = results.filter((item) => item.passed).reduce((sum, item) => sum + item.weight, 0);
  return {
    passed: results.every((item) => item.passed),
    score: possible ? earned / possible : 0,
    results,
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "evaluation_score",
    description: "Run deterministic contains, not-contains, and exact graders on an Agent answer",
    parameters: {
      type: "object",
      properties: { actual: { type: "string" }, criteria: { type: "array" } },
      required: ["actual", "criteria"],
    },
  },
};
registerTool(definition, async (input) => {
  if (!Array.isArray(input.criteria) || input.criteria.length > 100) {
    throw new Error("criteria must contain at most 100 items");
  }
  const criteria = input.criteria.map((raw) => {
    const item = raw as Record<string, unknown>;
    const type = String(item.type) as Criterion["type"];
    const value = String(item.value ?? "");
    const weight = Number(item.weight ?? 1);
    if (!(["contains", "not_contains", "exact"] as string[]).includes(type) || !value) {
      throw new Error("invalid evaluation criterion");
    }
    if (!Number.isFinite(weight) || weight <= 0) throw new Error("weight must be positive");
    return { type, value, weight };
  });
  return JSON.stringify(evaluateText(String(input.actual ?? ""), criteria));
});
registerSystemPromptSection({
  id: "s23-evaluation-feedback",
  title: "Evaluation and feedback",
  priority: 4,
  content:
    "Define measurable success criteria before execution. Prefer deterministic graders, preserve failed evidence, and use evaluation feedback to improve the next run rather than declaring success from confidence alone.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s23 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
