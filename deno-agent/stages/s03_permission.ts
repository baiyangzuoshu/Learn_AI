import {
  type AgentEvent,
  agentLoop as toolAgentLoop,
  type ToolHooks,
  type ToolRequest,
} from "./s02_tool_use.ts";
import type { Message } from "../src/core/types.ts";

const denyPatterns = [
  { pattern: /rm\s+-[^\n]*r[^\n]*f[^\n]*\s+\/(?:\s|$)/i, reason: "禁止递归删除系统根目录" },
  { pattern: /\bsudo\b/i, reason: "禁止提升系统权限" },
  { pattern: /\b(?:shutdown|reboot|mkfs)\b/i, reason: "禁止影响系统运行状态" },
  { pattern: /\bdd\s+if=/i, reason: "禁止直接覆写块设备" },
  { pattern: />\s*\/dev\/(?:disk|sd)/i, reason: "禁止写入系统设备" },
];

function permissionReason(request: ToolRequest): string | undefined {
  if (request.name === "write_file") return `写入文件：${String(request.input.path ?? "")}`;
  if (request.name === "edit_file") return `修改文件：${String(request.input.path ?? "")}`;
  if (request.name !== "bash") return undefined;
  const command = String(request.input.command ?? "");
  if (/\brm\s|>\s*\/etc\/|\bchmod\s+777\b|\bchown\b|\bgit\s+(?:reset|clean)\b/i.test(command)) {
    return `执行潜在破坏性命令：\n${command}`;
  }
  return undefined;
}

export type PermissionMode = "ask" | "auto" | "full";

function createAuthorize(mode: PermissionMode) {
  return async (request: ToolRequest): Promise<{ allowed: boolean; reason?: string }> => {
    if (mode === "full") return { allowed: true };
    if (request.name === "bash") {
      const command = String(request.input.command ?? "");
      const denied = denyPatterns.find(({ pattern }) => pattern.test(command));
      if (denied) return { allowed: false, reason: denied.reason };
    }
    const reason = permissionReason(request);
    if (!reason) return { allowed: true };
    if (mode === "auto") return { allowed: true };
    const allowed = confirm(`Deno Agent 请求权限\n\n${reason}\n\n是否允许本次操作？`);
    return { allowed, reason: allowed ? undefined : "用户拒绝了操作" };
  };
}

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  hooks: ToolHooks = {},
): Promise<string> {
  return await toolAgentLoop(
    query,
    onEvent,
    model,
    history,
    createAuthorize(permissionMode),
    signal,
    hooks,
  );
}

if (import.meta.main) {
  const query = prompt("s03 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
