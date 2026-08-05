import { type AgentEvent, agentLoop as previousAgentLoop } from "./s67_durable_deploy_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Principal = { id: string; tenant: string; scopes: Set<string>; expiresAt: number };
export type AuditEvent = {
  principal: string;
  action: string;
  allowed: boolean;
  reason: string;
  at: string;
};
export class SecurityPolicy {
  readonly audit: AuditEvent[] = [];
  constructor(
    private readonly allowedHosts: Set<string>,
    private readonly now = () => Date.now(),
  ) {}
  authorize(principal: Principal, scope: string, action: string) {
    const allowed = principal.expiresAt > this.now() && principal.scopes.has(scope);
    this.audit.push({
      principal: principal.id,
      action,
      allowed,
      reason: allowed ? "scope granted" : "scope/expiry denied",
      at: new Date(this.now()).toISOString(),
    });
    if (!allowed) throw new Error("policy denied");
  }
  egress(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !this.allowedHosts.has(parsed.hostname)) {
      throw new Error("egress denied");
    }
    return parsed;
  }
  sandboxPath(root: string, requested: string) {
    const base = root.endsWith("/") ? root : `${root}/`;
    const path = new URL(requested.replaceAll("\\", "/"), `file://${base}`).pathname;
    if (!path.startsWith(base)) throw new Error("sandbox escape");
    return path;
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "security_policy_runtime",
    description:
      "Enforce principal scope and expiry, HTTPS egress allowlists, path sandboxing, and audit events",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
};
registerTool(definition, async (input) => {
  const policy = new SecurityPolicy(new Set(["api.example.test"]));
  const principal = {
    id: "agent-1",
    tenant: "tenant-a",
    scopes: new Set(["research:read"]),
    expiresAt: Date.now() + 60_000,
  };
  policy.authorize(principal, "research:read", "search");
  const url = policy.egress(String(input.url).replace("https://", "https://api.example.test/"));
  return JSON.stringify({ host: url.hostname, audit: policy.audit });
});
registerSystemPromptSection({
  id: "s68-security-policy",
  title: "Identity, sandbox, and egress policy",
  priority: 49,
  content:
    "Security is enforced at execution time: principals have expiring scopes, egress is HTTPS and allowlisted, paths stay inside a sandbox, and every decision is auditable.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s68 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
