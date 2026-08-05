import { type AgentEvent, agentLoop as previousAgentLoop } from "./s22_structured_tracing.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ToolPolicy = { name: string; mutation: boolean; scopes: string[]; maxOutput: number };
export type Principal = { id: string; scopes: Set<string>; expiresAt: number };
export function authorize(policy: ToolPolicy, principal: Principal) {
  if (
    principal.expiresAt <= Date.now() || policy.scopes.some((scope) => !principal.scopes.has(scope))
  ) throw new Error("tool policy denied");
  return policy;
}
export function boundedOutput(value: string, policy: ToolPolicy) {
  return value.slice(0, policy.maxOutput);
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "tool_policy",
    description: "Apply typed tool scope, expiration, mutation classification, and bounded output",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify({
      output: boundedOutput(
        String(input.text),
        authorize({ name: "lookup", mutation: false, scopes: ["read"], maxOutput: 200 }, {
          id: "lesson",
          scopes: new Set(["read"]),
          expiresAt: Date.now() + 60_000,
        }),
      ),
    }),
);
registerSystemPromptSection({
  id: "s23-tool-safety",
  title: "Tool contracts and permission",
  priority: 34,
  content:
    "Tools are single-purpose contracts with schema, scope, mutation class, bounded output, explicit approval, and auditable failure. Never let a model grant its own permission.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
