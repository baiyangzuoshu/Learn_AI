import { type AgentEvent, agentLoop as skillAgentLoop } from "./s07_skill_loading.ts";
import type { PermissionMode } from "./s03_permission.ts";
import type { Message } from "../src/core/types.ts";

const CONTEXT_CHAR_BUDGET = 24_000;
const KEEP_RECENT_MESSAGES = 10;
const SUMMARY_BUDGET = 8_000;

function compactHistory(
  history: Message[],
): { messages: Message[]; compacted: boolean; before: number; after: number } {
  const before = history.reduce((sum, message) => sum + String(message.content ?? "").length, 0);
  if (before <= CONTEXT_CHAR_BUDGET) {
    return { messages: history, compacted: false, before, after: before };
  }
  const split = Math.max(0, history.length - KEEP_RECENT_MESSAGES);
  const older = history.slice(0, split), recent = history.slice(split);
  const lines = older.map((message, index) => {
    const content = String(message.content ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    return `${index + 1}. ${message.role}: ${content}`;
  });
  let summary = `[Earlier conversation compacted]\n${lines.join("\n")}`;
  if (summary.length > SUMMARY_BUDGET) {
    summary = `${summary.slice(0, SUMMARY_BUDGET)}\n[summary truncated]`;
  }
  const messages: Message[] = [{ role: "user", content: summary }, ...recent];
  const after = messages.reduce((sum, message) => sum + String(message.content ?? "").length, 0);
  return { messages, compacted: true, before, after };
}

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
  const compacted = compactHistory(history);
  if (compacted.compacted) {
    onHook({
      name: "ContextCompact",
      detail:
        `${compacted.before.toLocaleString()} → ${compacted.after.toLocaleString()} chars，保留最近 ${KEEP_RECENT_MESSAGES} 条消息`,
    });
  }
  return await skillAgentLoop(
    query,
    onEvent,
    model,
    compacted.messages,
    permissionMode,
    signal,
    onHook,
  );
}

if (import.meta.main) {
  const query = prompt("s08 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
