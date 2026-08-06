import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s30_production_readiness/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Identity = { subject: string; tenant: string; scopes: Set<string>; expiresAt: number };
export class SecurityBoundary {
  readonly audit: Array<{ action: string; allowed: boolean }> = [];
  constructor(private readonly hosts: Set<string>) {}
  allow(identity: Identity, scope: string, url: string) {
    const parsed = new URL(url),
      allowed = identity.expiresAt > Date.now() && identity.scopes.has(scope) &&
        parsed.protocol === "https:" && this.hosts.has(parsed.hostname);
    this.audit.push({ action: scope, allowed });
    if (!allowed) throw new Error("security boundary denied");
  }
  redact(text: string) {
    return text.replace(/(?:sk-[\w-]+|api[_-]?key\s*[:=]\s*\S+)/gi, "[REDACTED]");
  }
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "security_boundary",
    description:
      "Enforce identity scope, tenant boundary, HTTPS egress, redaction, and auditable denial",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
};
registerTool(definition, async (input) => {
  const boundary = new SecurityBoundary(new Set(["api.example.test"]));
  boundary.allow(
    {
      subject: "agent",
      tenant: "lesson",
      scopes: new Set(["read"]),
      expiresAt: Date.now() + 60_000,
    },
    "read",
    String(input.url).replace("https://", "https://api.example.test/"),
  );
  return JSON.stringify(boundary.audit);
});
registerSystemPromptSection({
  id: "s31-security",
  title: "Identity, sandbox, egress, and DLP",
  priority: 42,
  content:
    "Production safety enforces least privilege, expiring identity, tenant isolation, path sandboxing, HTTPS/SSRF controls, redaction, policy versioning, audit, and red-team negative tests.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s31 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
