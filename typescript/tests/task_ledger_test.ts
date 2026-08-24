import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { checkpointTask, createTask, resumeTask, verifyTask } from "../src/task_ledger.ts";
import { setAppDataPath } from "../src/platform.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test("Task ledger resumes only from durable evidence and is idempotent", async () => {
  const root = `/private/tmp/ai-agent-task-ledger-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  setAppDataPath(root);

  const created = await createTask(workspace, "完成一个可恢复任务", "create-1");
  const repeatedCreate = await createTask(workspace, "不应创建第二条", "create-1");
  assertEquals(repeatedCreate.id, created.id);
  assertEquals(created.state, "planned");

  let blocked = false;
  try {
    await verifyTask(workspace, created.id);
  } catch {
    blocked = true;
  }
  assert(blocked, "task was verified without evidence");

  const checkpoint = await checkpointTask(
    workspace,
    created.id,
    "文件检查已完成",
    "check-files",
    "step-1",
  );
  assertEquals(checkpoint.state, "running");
  assertEquals(checkpoint.evidence.length, 1);
  const repeatedCheckpoint = await checkpointTask(
    workspace,
    created.id,
    "重复提交不应产生副作用",
    "check-files",
    "step-1",
  );
  assertEquals(repeatedCheckpoint.revision, checkpoint.revision);
  assertEquals(repeatedCheckpoint.evidence.length, 1);

  const verified = await verifyTask(workspace, created.id, "verify-1");
  assertEquals(verified.state, "verified");
  const resumed = await resumeTask(workspace, created.id);
  assertEquals(resumed.state, "verified");
  assertEquals(resumed.evidence[0]?.checkpoint, "check-files");
});
