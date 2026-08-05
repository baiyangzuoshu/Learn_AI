import { type AgentEvent, agentLoop as previousAgentLoop } from "./s57_deploy_service.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Principal = { sub: string; tenant: string; scopes: string[]; exp: number };
export type SecurityDecision = {
  allowed: boolean;
  reason: string;
  audit: { principal: string; action: string; tenant: string };
};

export function authorize(principal: Principal, scope: string, now = Date.now()): SecurityDecision {
  const allowed = principal.exp > now && principal.tenant.length > 0 &&
    principal.scopes.includes(scope);
  return {
    allowed,
    reason: allowed ? "scope-granted" : principal.exp <= now ? "expired" : "missing-scope",
    audit: { principal: principal.sub, action: scope, tenant: principal.tenant },
  };
}
export function resolveWorkspace(root: string, requested: string): string {
  const normalizedRoot = root.replaceAll("\\", "/").replace(/\/$/, "");
  const candidate = `${normalizedRoot}/${requested}`.replaceAll("\\", "/");
  const parts: string[] = [];
  for (const part of candidate.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  const resolved = `/${parts.join("/")}`;
  if (!resolved.startsWith(`${normalizedRoot}/`) && resolved !== normalizedRoot) {
    throw new Error("workspace escape");
  }
  return resolved;
}
export function egressAllowed(
  urlText: string,
  allowHosts: string[],
  maxBytes: number,
  bytes: number,
): boolean {
  const url = new URL(urlText);
  return url.protocol === "https:" && allowHosts.includes(url.hostname) && bytes <= maxBytes;
}
export function redact(text: string): string {
  return text.replace(/(Bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|password\s*[:=]\s*\S+)/gi, "[REDACTED]");
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "security_runtime_demo",
    description: "Apply runtime scope, tenant, path, egress, and DLP checks",
    parameters: {
      type: "object",
      properties: { scope: { type: "string" }, path: { type: "string" }, text: { type: "string" } },
      required: ["scope", "path", "text"],
    },
  },
};
registerTool(definition, async (input) => {
  const principal = {
    sub: "student",
    tenant: "lesson",
    scopes: ["memory:read"],
    exp: Date.now() + 60_000,
  };
  let safePath = "";
  try {
    safePath = resolveWorkspace("/lesson/workspace", String(input.path));
  } catch (error) {
    safePath = error instanceof Error ? error.message : String(error);
  }
  return JSON.stringify({
    decision: authorize(principal, String(input.scope)),
    safePath,
    egress: egressAllowed(
      "https://api.lesson.test",
      ["api.lesson.test"],
      1000,
      String(input.text).length,
    ),
    text: redact(String(input.text)),
  });
});
registerSystemPromptSection({
  id: "s58-security-runtime",
  title: "Security enforcement runtime",
  priority: 39,
  content:
    "Security decisions happen at execution time: verify principal, tenant, scope, expiry, normalized workspace path, HTTPS egress allowlist, payload limits, and DLP redaction. Emit auditable reason codes without leaking secrets.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(
    authorize({ sub: "s", tenant: "t", scopes: ["read"], exp: Date.now() + 1_000 }, "read"),
  );
  const query = prompt("s58 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
