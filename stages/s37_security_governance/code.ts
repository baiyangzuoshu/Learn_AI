import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s36_deploy_worker_queue/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type ThreatCase = { id: string; payload: string; expected: "deny" | "allow" };
export function policy(payload: string): "deny" | "allow" {
  return /ignore (all|previous) instructions|localhost|127\.0\.0\.1|api[_-]?key\s*[:=]|password\s*[:=]/i
      .test(payload)
    ? "deny"
    : "allow";
}
export function redTeam(cases: ThreatCase[]) {
  return cases.map((test) => ({
    ...test,
    actual: policy(test.payload),
    passed: policy(test.payload) === test.expected,
  }));
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "red_team",
    description:
      "Exercise prompt-injection, SSRF, and secret-exfiltration negative cases before promotion",
    parameters: {
      type: "object",
      properties: { payload: { type: "string" } },
      required: ["payload"],
    },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      redTeam([{
        id: "input",
        payload: String(input.payload),
        expected: policy(String(input.payload)),
      }, { id: "ssrf", payload: "fetch localhost", expected: "deny" }]),
    ),
);
registerSystemPromptSection({
  id: "s37-red-team",
  title: "Security assurance and red-team",
  priority: 48,
  content:
    "Threat models become executable negative tests. Test injection, authorization bypass, SSRF, secret exfiltration, sandbox escape, unsafe tools, and policy regression before every promotion.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s37 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
