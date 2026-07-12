import { type AgentEvent, agentLoop as promptAgentLoop } from "./s10_system_prompt.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection } from "./s02_tool_use.ts";
import type { Message } from "../src/core/types.ts";

registerSystemPromptSection({
  id: "s11-recovery",
  title: "Error recovery",
  priority: 25,
  content:
    "When a tool returns an error, diagnose it from the exact output and try a safe alternative when one exists. Do not repeat the same failing or state-changing operation blindly. Preserve completed work, report unrecoverable errors precisely, and never interpret cancellation as a failure to retry.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
): Promise<string> {
  onHook({
    name: "RecoveryReady",
    detail: "网络/408/429/5xx 最多重试 3 次 · 取消与认证错误不重试",
  });
  return await promptAgentLoop(
    query,
    onEvent,
    model,
    history,
    permissionMode,
    signal,
    onHook,
  );
}

if (import.meta.main) {
  const query = prompt("s11 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
