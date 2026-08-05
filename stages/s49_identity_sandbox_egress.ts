import { type AgentEvent, agentLoop as previousAgentLoop } from "./s48_realtime_deployment.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Identity = { subject: string; roles: string[]; tenant: string; expiresAt: number };
export type EgressPolicy = { hosts: string[]; methods: string[]; maxBytes: number };
export function authorizeIdentity(
  identity: Identity,
  requiredRole: string,
  now = Date.now(),
): boolean {
  return identity.expiresAt > now && identity.roles.includes(requiredRole) &&
    Boolean(identity.tenant);
}
export function safeWorkspacePath(workspace: string, requested: string): string {
  const root = `${workspace.replace(/[\\/]$/, "")}/`;
  const candidate = requested.startsWith("/") ? requested : `${workspace}/${requested}`;
  const normalized = candidate.replaceAll("\\", "/");
  if (!normalized.startsWith(root) || normalized.includes("/../") || normalized.endsWith("/..")) {
    throw new Error("path escapes workspace");
  }
  return normalized;
}
export function allowEgress(
  urlText: string,
  method: string,
  bytes: number,
  policy: EgressPolicy,
): boolean {
  const url = new URL(urlText);
  return policy.hosts.includes(url.hostname) && policy.methods.includes(method.toUpperCase()) &&
    bytes <= policy.maxBytes;
}
export function redactData(text: string): string {
  return text.replace(/(sk-[A-Za-z0-9_-]{8,}|password\s*[:=]\s*\S+)/gi, "[REDACTED]");
}
export function detectInjection(text: string): boolean {
  return /ignore (all|previous) instructions|exfiltrate|reveal secrets/i.test(text);
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "identity_sandbox_egress_demo",
    description: "Apply identity, path sandbox, egress allowlist, and DLP checks",
    parameters: {
      type: "object",
      properties: { text: { type: "string" }, role: { type: "string" }, url: { type: "string" } },
      required: ["text", "role", "url"],
    },
  },
};
registerTool(definition, async (input) => {
  const identity = {
    subject: "student",
    roles: ["reader"],
    tenant: "lesson",
    expiresAt: Date.now() + 60_000,
  };
  const policy = { hosts: ["api.example.test"], methods: ["GET"], maxBytes: 10_000 };
  return JSON.stringify({
    authorized: authorizeIdentity(identity, String(input.role)),
    egress: allowEgress(String(input.url), "GET", String(input.text).length, policy),
    injection: detectInjection(String(input.text)),
    safeText: redactData(String(input.text)),
  });
});
registerSystemPromptSection({
  id: "s49-identity-sandbox-egress",
  title: "Identity, sandbox, and egress control",
  priority: 30,
  content:
    "Authenticate people, services, and agents before actions. Enforce tenant and role boundaries, normalize paths at execution time, allowlist network egress, cap payloads, detect injection, and redact sensitive data before telemetry.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    allowEgress("https://api.example.test/data", "GET", 100, {
      hosts: ["api.example.test"],
      methods: ["GET"],
      maxBytes: 1_000,
    }),
  );
  const query = prompt("s49 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
