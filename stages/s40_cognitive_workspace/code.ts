import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s39_loop_control_replay/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type CapstoneCheck = {
  layer: "runtime" | "protocol" | "knowledge" | "evaluation" | "security" | "operations";
  passed: boolean;
  evidence: string;
};
export function capstone(checks: CapstoneCheck[]) {
  const failed = checks.filter((check) => !check.passed);
  return {
    ready: !failed.length,
    failed,
    next: failed.length
      ? "fix evidence before promotion"
      : "migrate one capability through HarnessFeature",
  };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "agent_system_capstone",
    description:
      "Validate the integrated runtime, protocol, memory, evaluation, security, and operations architecture",
    parameters: { type: "object", properties: { fail: { type: "string" } } },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      capstone(
        ["runtime", "protocol", "knowledge", "evaluation", "security", "operations"].map(
          (layer) => ({
            layer: layer as CapstoneCheck["layer"],
            passed: layer !== input.fail,
            evidence: layer === input.fail ? "missing" : "verified",
          }),
        ),
      ),
    ),
);
registerSystemPromptSection({
  id: "s40-capstone",
  title: "Production Agent Architecture capstone",
  priority: 51,
  content:
    "A complete agent system is one bounded runtime plus removable features for protocols, knowledge, evaluation, safety, cognition, deployment, and operations. Migrate only evidence-backed capabilities into production.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s40 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
