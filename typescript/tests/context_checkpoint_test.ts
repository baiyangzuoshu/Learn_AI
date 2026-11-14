import type { Message } from "../src/core/types.ts";
import { loadSummaryCheckpoint, saveSummaryCheckpoint } from "../src/context_checkpoint.ts";
import { setAppDataPath } from "../src/platform.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("summary checkpoint reuses exact history prefixes and invalidates changes", async () => {
  setAppDataPath(await Deno.makeTempDir({ dir: "/private/tmp", prefix: "context-checkpoint-" }));
  const history: Message[] = [
    { role: "user", content: "Review the implementation" },
    { role: "assistant", content: "Reviewed and fixed the implementation" },
  ];
  await saveSummaryCheckpoint("session-12345678", "/workspace/a", history, 2, "[summary]");

  const appended = [...history, { role: "user" as const, content: "Continue" }];
  const resumed = await loadSummaryCheckpoint("session-12345678", "/workspace/a", appended);
  assert(resumed?.historyCount === 2, "appended messages should reuse the matching prefix");

  const edited = [{ ...history[0], content: "Different request" }, history[1]];
  assert(
    await loadSummaryCheckpoint("session-12345678", "/workspace/a", edited) === undefined,
    "edited history should invalidate the checkpoint",
  );
  assert(
    await loadSummaryCheckpoint("session-12345678", "/workspace/b", history) === undefined,
    "workspace changes should invalidate the checkpoint",
  );
});
