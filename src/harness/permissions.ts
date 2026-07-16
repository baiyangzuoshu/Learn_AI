import type { PermissionMode, ToolRequest } from "./contracts.ts";

const hardDenied = [
  /rm\s+-[^\n]*r[^\n]*f[^\n]*\s+\/(?:\s|$)/i,
  /\bsudo\b/i,
  /\b(?:shutdown|reboot|mkfs)\b/i,
  /\bdd\s+if=/i,
];
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
    `Deno Agent 请求权限\n\n${request.name}\n${
      JSON.stringify(request.input, null, 2)
    }\n\n是否允许？`,
  );
  if (!allowed) throw new Error("Permission denied by user");
}
