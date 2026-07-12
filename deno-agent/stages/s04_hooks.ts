import {
  type AgentEvent,
  agentLoop as permissionAgentLoop,
  type PermissionMode,
} from "./s03_permission.ts";
import type { ToolHooks, ToolRequest } from "./s02_tool_use.ts";
import type { Message } from "../src/core/types.ts";
import { getWorkspace } from "../src/config/settings.ts";

type HookEvent = "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "Stop";
type Hook = (...args: unknown[]) => void | string | Promise<void | string>;
const registry = new Map<HookEvent, Hook[]>();

export function registerHook(event: HookEvent, hook: Hook): void {
  registry.set(event, [...(registry.get(event) ?? []), hook]);
}
async function trigger(event: HookEvent, ...args: unknown[]): Promise<string | undefined> {
  for (const hook of registry.get(event) ?? []) {
    const result = await hook(...args);
    if (typeof result === "string") return result;
  }
}

registerHook("PreToolUse", (value) => console.log(`[hook:pre] ${(value as ToolRequest).name}`));
registerHook("PostToolUse", (value, output) => {
  if (String(output).length > 50_000) {
    console.warn(`[hook:post] large output from ${(value as ToolRequest).name}`);
  }
});
registerHook("Stop", (count) => console.log(`[hook:stop] ${count} tool calls`));

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: HookEvent; detail: string }) => void = () => {},
): Promise<string> {
  onHook({ name: "UserPromptSubmit", detail: `工作区：${await getWorkspace()}` });
  await trigger("UserPromptSubmit", query, await getWorkspace());
  const hooks: ToolHooks = {
    before: async (request) => {
      onHook({ name: "PreToolUse", detail: request.name });
      return await trigger("PreToolUse", request);
    },
    after: async (request, output) => {
      onHook({ name: "PostToolUse", detail: `${request.name} · ${output.length} chars` });
      await trigger("PostToolUse", request, output);
    },
    stop: async (count) => {
      onHook({ name: "Stop", detail: `${count} 次工具调用` });
      await trigger("Stop", count);
    },
  };
  return await permissionAgentLoop(query, onEvent, model, history, permissionMode, signal, hooks);
}

if (import.meta.main) {
  const query = prompt("s04 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
