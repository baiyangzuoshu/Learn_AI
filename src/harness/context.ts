import type { Message } from "../core/types.ts";
const BUDGET = 24_000, KEEP = 10, SUMMARY = 8_000;
export function compactHistory(history: Message[]) {
  const before = history.reduce((sum, item) => sum + String(item.content ?? "").length, 0);
  if (before <= BUDGET) return { history, compacted: false, before, after: before };
  const older = history.slice(0, -KEEP), recent = history.slice(-KEEP);
  let summary = `[Earlier conversation compacted]\n${
    older.map((item, index) =>
      `${index + 1}. ${item.role}: ${String(item.content ?? "").replace(/\s+/g, " ").slice(0, 600)}`
    ).join("\n")
  }`;
  if (summary.length > SUMMARY) summary = `${summary.slice(0, SUMMARY)}\n[summary truncated]`;
  const compacted: Message[] = [{ role: "user", content: summary }, ...recent];
  return {
    history: compacted,
    compacted: true,
    before,
    after: compacted.reduce((sum, item) => sum + String(item.content ?? "").length, 0),
  };
}
