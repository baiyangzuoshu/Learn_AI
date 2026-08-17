import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setAppDataPath } from "../src/platform.ts";
import {
  completeHandoff,
  failHandoff,
  readHandoffs,
  submitHandoff,
  transferHandoff,
} from "../src/handoff.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test("A2A handoff is tenant-scoped, idempotent, evidence-bound, and durable", async () => {
  const root = `/private/tmp/ai-agent-handoff-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  setAppDataPath(join(root, "app-data"));

  const submitted = await submitHandoff(workspace, {
    tenant: "tenant-a",
    role: "reviewer",
    objective: "审核发布证据",
    traceId: "trace-27",
    idempotencyKey: "submit-1",
  });
  const duplicate = await submitHandoff(workspace, {
    tenant: "tenant-a",
    role: "different-role",
    objective: "不应创建第二条",
    idempotencyKey: "submit-1",
  });
  assertEquals(duplicate.id, submitted.id);
  assertEquals(submitted.state, "submitted");

  const transferred = await transferHandoff(
    workspace,
    submitted.id,
    "tenant-a",
    "发布检查通过",
    "CI 和签名证据已保存",
    "ci-check",
    "transfer-1",
  );
  assertEquals(transferred.state, "running");
  assertEquals(transferred.artifacts.length, 1);
  const repeatedTransfer = await transferHandoff(
    workspace,
    submitted.id,
    "tenant-a",
    "不应重复",
    "不应重复",
    "duplicate",
    "transfer-1",
  );
  assertEquals(repeatedTransfer.revision, transferred.revision);
  assertEquals(repeatedTransfer.artifacts.length, 1);

  let tenantDenied = false;
  try {
    await completeHandoff(workspace, submitted.id, "tenant-b");
  } catch {
    tenantDenied = true;
  }
  assert(tenantDenied, "cross-tenant handoff mutation was accepted");

  const completed = await completeHandoff(workspace, submitted.id, "tenant-a", "complete-1");
  assertEquals(completed.state, "complete");
  assertEquals((await readHandoffs(workspace, { tenant: "tenant-a" })).at(0)?.state, "complete");

  let terminalDenied = false;
  try {
    await transferHandoff(
      workspace,
      submitted.id,
      "tenant-a",
      "late artifact",
      "late evidence",
      "late",
    );
  } catch {
    terminalDenied = true;
  }
  assert(terminalDenied, "completed handoff accepted another transfer");
});

Deno.test("A2A handoff failure is terminal and idempotent", async () => {
  const root = `/private/tmp/ai-agent-handoff-failure-${crypto.randomUUID()}`;
  const workspace = join(root, "workspace");
  await mkdir(workspace, { recursive: true });
  setAppDataPath(join(root, "app-data"));

  const submitted = await submitHandoff(workspace, {
    tenant: "tenant-f",
    role: "worker",
    objective: "执行失败路径",
    idempotencyKey: "submit-f",
  });
  const failed = await failHandoff(
    workspace,
    submitted.id,
    "tenant-f",
    "receiver unavailable",
    "fail-1",
  );
  assertEquals(failed.state, "failed");
  const repeated = await failHandoff(
    workspace,
    submitted.id,
    "tenant-f",
    "different reason",
    "fail-1",
  );
  assertEquals(repeated.revision, failed.revision);
  assertEquals(repeated.failureReason, "receiver unavailable");
});
