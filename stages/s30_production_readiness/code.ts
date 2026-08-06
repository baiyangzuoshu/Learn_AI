import { type AgentEvent, agentLoop as previousAgentLoop } from "../s29_cognitive_monitor/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type EvalCase = { id: string; input: string; expected: string; citation?: string };
export type EvalReport = {
  passRate: number;
  groundingRate: number;
  review: string[];
  passed: boolean;
};
export async function evaluate(cases: EvalCase[], run: (input: string) => Promise<string>) {
  const results = await Promise.all(cases.map(async (item) => {
    const output = await run(item.input);
    return {
      pass: output === item.expected,
      grounded: !item.citation || output.includes(item.citation),
      id: item.id,
    };
  }));
  const passRate = results.filter((result) => result.pass).length / Math.max(1, results.length),
    groundingRate = results.filter((result) => result.grounded).length /
      Math.max(1, results.length);
  return {
    passRate,
    groundingRate,
    review: results.filter((result) => !result.pass || !result.grounded).map((result) => result.id),
    passed: passRate >= .95 && groundingRate >= .95,
  };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "evaluation_gate",
    description:
      "Evaluate quality and grounding, queue uncertain cases for review, and block regression",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      await evaluate(
        [{ id: "lesson", input: String(input.input), expected: String(input.input) }],
        async (value) => value,
      ),
    ),
);
registerSystemPromptSection({
  id: "s30-evaluation",
  title: "Evaluation, feedback, and CI",
  priority: 41,
  content:
    "Release gates combine datasets, negative cases, grounding, critic/judge results, trace evidence, latency, cost, safety, and human review. Regressions block promotion.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s30 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
