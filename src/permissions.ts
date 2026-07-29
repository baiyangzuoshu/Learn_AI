import type { PermissionMode, ToolRequest } from "./contracts.ts";

const hardDenied = [
  /rm\s+-[^\n]*r[^\n]*f[^\n]*\s+\/(?:\s|$)/i,
  /\bsudo\b/i,
  /\b(?:shutdown|reboot|mkfs)\b/i,
  /\bdd\s+if=/i,
];

const MAX_FIELD_PREVIEW = 360;

function truncate(value: string, max = MAX_FIELD_PREVIEW): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…（已截断，共 ${normalized.length} 字符）`;
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) return `数组，${value.length} 项`;
  if (typeof value === "object" && value) return `对象，${Object.keys(value).length} 个字段`;
  return String(value);
}

function summarizePermissionInput(request: ToolRequest): string {
  const input = request.input;
  if (request.name === "write_file") {
    const content = String(input.content ?? "");
    return [
      `path: ${String(input.path ?? "未提供")}`,
      `content: ${content.length.toLocaleString()} 字符`,
      `preview: ${truncate(content)}`,
    ].join("\n");
  }
  if (request.name === "edit_file") {
    return [
      `path: ${String(input.path ?? "未提供")}`,
      input.oldText !== undefined ? `oldText: ${describeValue(input.oldText)}` : undefined,
      input.newText !== undefined ? `newText: ${describeValue(input.newText)}` : undefined,
    ].filter(Boolean).join("\n");
  }
  if (request.name === "bash" || request.name === "background_start") {
    return `command: ${truncate(String(input.command ?? ""))}`;
  }
  if (request.name === "mcp_call") {
    return [
      `server: ${String(input.server ?? "未提供")}`,
      `tool: ${String(input.tool ?? "未提供")}`,
      input.arguments !== undefined ? `arguments: ${describeValue(input.arguments)}` : undefined,
    ].filter(Boolean).join("\n");
  }
  return Object.entries(input).map(([key, value]) => `${key}: ${describeValue(value)}`).join("\n");
}

export async function authorize(request: ToolRequest, mode: PermissionMode): Promise<void> {
  const command = String(request.input.command ?? "");
  if (
    mode !== "full" && ["bash", "background_start"].includes(request.name) &&
    hardDenied.some((pattern) => pattern.test(command))
  ) throw new Error("Permission denied: system-level dangerous command");
  const mutating = [
    "write_file",
    "edit_file",
    "background_start",
    "cron_write",
    "worktree_create",
    "worktree_remove",
    "mcp_call",
  ].includes(request.name);
  if (mode !== "ask" || !mutating) return;
  const allowed = confirm(
    `Deno Agent 请求权限\n\n${request.name}\n${summarizePermissionInput(request)}\n\n是否允许？`,
  );
  if (!allowed) throw new Error("Permission denied by user");
}
