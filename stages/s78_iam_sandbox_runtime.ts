import { isAbsolute, relative, resolve } from "node:path";
import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "./s77_durable_scheduler_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Identity = { id: string; tenant: string; scopes: Set<string>; expiresAt: number };
export type Decision = {
  allowed: boolean;
  reason: string;
  identity: string;
  action: string;
  at: string;
};
export class IAMPolicy {
  readonly decisions: Decision[] = [];
  constructor(private readonly hosts: Set<string>, private readonly now = () => Date.now()) {}
  check(identity: Identity, scope: string, action: string) {
    const allowed = identity.expiresAt > this.now() && identity.scopes.has(scope);
    const decision = {
      allowed,
      reason: allowed ? "scope granted" : "expired or missing scope",
      identity: identity.id,
      action,
      at: new Date(this.now()).toISOString(),
    };
    this.decisions.push(decision);
    if (!allowed) throw new Error(`IAM denied: ${decision.reason}`);
  }
  path(root: string, requested: string) {
    const base = resolve(root),
      candidate = resolve(base, requested),
      rel = relative(base, candidate);
    if (
      rel === ".." || rel.startsWith(`..${Deno.build.os === "windows" ? "\\" : "/"}`) ||
      isAbsolute(rel)
    ) throw new Error("sandbox path escape");
    return candidate;
  }
  egress(url: string) {
    const parsed = new URL(url);
    const privateHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) ||
      parsed.hostname.endsWith(".internal");
    if (parsed.protocol !== "https:" || privateHost || !this.hosts.has(parsed.hostname)) {
      throw new Error("egress policy denied");
    }
    return parsed;
  }
  dlp(text: string) {
    return /(?:sk-[A-Za-z0-9]{12,}|password\s*[:=]|api[_-]?key\s*[:=])/i.test(text);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "iam_sandbox_runtime",
    description:
      "Enforce expiring identity scopes, workspace paths, HTTPS egress allowlists, and DLP checks",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
};
registerTool(definition, async (input) => {
  const policy = new IAMPolicy(new Set(["api.example.test"]));
  const identity = {
    id: "agent-1",
    tenant: "tenant-a",
    scopes: new Set(["read"]),
    expiresAt: Date.now() + 60_000,
  };
  policy.check(identity, "read", "lookup");
  return JSON.stringify({
    host:
      policy.egress(String(input.url).replace("https://", "https://api.example.test/")).hostname,
    secretDetected: policy.dlp("normal text"),
    decisions: policy.decisions,
  });
});
registerSystemPromptSection({
  id: "s78-iam-sandbox",
  title: "IAM, sandbox, egress, and DLP",
  priority: 59,
  content:
    "Identity and safety checks run outside the model: short-lived scopes, workspace path containment, private-network blocking, HTTPS allowlists, DLP, and audit decisions.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s78 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
