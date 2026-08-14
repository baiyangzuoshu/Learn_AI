import type { PermissionMode, Principal, ToolPolicy, ToolRisk } from "./contracts.ts";
import type { ToolDefinition } from "./core/types.ts";

export const DEFAULT_TOOL_OUTPUT = 50_000;
export const PRINCIPAL_TTL_MS = 60 * 60 * 1_000;

const mutatingTools = new Set([
  "write_file",
  "edit_file",
  "memory_append",
  "memory_replace",
  "task_graph_write",
  "todo_write",
  "background_start",
  "background_cancel",
  "cron_write",
  "worktree_create",
  "worktree_remove",
  "mcp_call",
  "generate_image",
  "task_create",
  "task_checkpoint",
  "task_verify",
]);
const externalTools = new Set([
  "bash",
  "background_start",
  "worktree_agent",
  "mcp_servers",
  "mcp_list_tools",
  "mcp_call",
  "generate_image",
]);
const dangerousTools = new Set(["bash"]);

export class ToolPolicyError extends Error {
  constructor(readonly reason: "expired" | "scope" | "invalid", message: string) {
    super(message);
    this.name = "ToolPolicyError";
  }
}

function inferRisk(name: string): ToolRisk {
  if (dangerousTools.has(name)) return "dangerous";
  if (externalTools.has(name)) return "external";
  if (mutatingTools.has(name)) return "mutating";
  return "read-only";
}

function inferredScopes(risk: ToolRisk): string[] {
  return [risk === "read-only" ? "read" : risk];
}

function validateMaxOutput(maxOutput: number): number {
  if (!Number.isFinite(maxOutput) || !Number.isInteger(maxOutput) || maxOutput < 128) {
    throw new ToolPolicyError("invalid", "tool maxOutput must be an integer of at least 128");
  }
  return maxOutput;
}

export function normalizeToolPolicy(
  definition: ToolDefinition,
  policy: Partial<ToolPolicy> = {},
): ToolPolicy {
  const name = definition.function.name.trim();
  if (!name) throw new ToolPolicyError("invalid", "tool policy requires a tool name");
  const risk = policy.risk ?? inferRisk(name);
  const scopes = [...(policy.scopes ?? inferredScopes(risk))].map((scope) => scope.trim()).filter(
    Boolean,
  );
  if (!scopes.length) throw new ToolPolicyError("invalid", `${name} tool policy requires scopes`);
  return {
    name,
    mutation: policy.mutation ?? risk !== "read-only",
    risk,
    scopes,
    maxOutput: validateMaxOutput(policy.maxOutput ?? DEFAULT_TOOL_OUTPUT),
  };
}

export function createPrincipal(mode: PermissionMode, supplied?: Principal): Principal {
  if (supplied) return supplied;
  const scopes = mode === "full"
    ? ["read", "mutating", "external", "dangerous"]
    : ["read", "mutating", "external", "dangerous"];
  return {
    id: `local-${mode}`,
    scopes: new Set(scopes),
    expiresAt: Date.now() + PRINCIPAL_TTL_MS,
  };
}

export function authorizeToolPolicy(policy: ToolPolicy, principal: Principal): ToolPolicy {
  if (!principal.id.trim() || !Number.isFinite(principal.expiresAt)) {
    throw new ToolPolicyError("invalid", "tool principal is invalid");
  }
  if (principal.expiresAt <= Date.now()) {
    throw new ToolPolicyError("expired", `tool policy denied: principal ${principal.id} expired`);
  }
  const missing = policy.scopes.filter((scope) => !principal.scopes.has(scope));
  if (missing.length) {
    throw new ToolPolicyError(
      "scope",
      `tool policy denied: ${policy.name} requires scope ${missing.join(", ")}`,
    );
  }
  return policy;
}

export function boundedToolOutput(value: string, policy: ToolPolicy): string {
  if (value.length <= policy.maxOutput) return value;
  const marker = `…（工具输出已截断，原始 ${value.length.toLocaleString()} 字符）`;
  const keep = Math.max(0, policy.maxOutput - marker.length);
  return `${value.slice(0, keep)}${marker.slice(0, policy.maxOutput - keep)}`;
}
