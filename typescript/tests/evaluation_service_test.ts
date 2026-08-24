import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { setAppDataPath } from "../src/platform.ts";
import { readEvaluations, runEvaluation } from "../src/evaluation_service.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function workspace(): Promise<string> {
  const root = `/private/tmp/ai-agent-evaluation-${crypto.randomUUID()}`;
  const path = join(root, "workspace");
  await mkdir(path, { recursive: true });
  setAppDataPath(join(root, "app-data"));
  return path;
}

Deno.test("evaluation gate passes grounded candidates and is idempotent", async () => {
  const path = await workspace();
  const cases = [
    { id: "case-1", input: "q1", expected: "answer [source-a]", citation: "source-a" },
    { id: "case-2", input: "q2", expected: "answer 2" },
  ];
  const first = await runEvaluation(path, {
    tenant: "tenant-eval",
    datasetVersion: "v1",
    cases,
    outputs: { "case-1": "answer [source-a]", "case-2": "answer 2" },
    idempotencyKey: "run-1",
  });
  assertEquals(first.state, "passed");
  assertEquals(first.passRate, 1);
  assertEquals(first.groundingRate, 1);
  const duplicate = await runEvaluation(path, {
    tenant: "tenant-eval",
    datasetVersion: "v1",
    cases,
    outputs: { "case-1": "wrong", "case-2": "wrong" },
    idempotencyKey: "run-1",
  });
  assertEquals(duplicate.id, first.id);
});

Deno.test("evaluation gate blocks regressions and records review cases", async () => {
  const path = await workspace();
  const record = await runEvaluation(path, {
    tenant: "tenant-review",
    datasetVersion: "v2",
    passThreshold: 0.95,
    groundingThreshold: 0.95,
    cases: [
      { id: "good", input: "q", expected: "ok cite", citation: "cite" },
      { id: "bad", input: "q", expected: "expected", citation: "missing-cite" },
    ],
    outputs: { good: "ok cite", bad: "wrong" },
  });
  assertEquals(record.state, "blocked");
  assertEquals(record.review.sort().join(","), "bad");
  assertEquals(record.passRate, 0.5);
  assertEquals(record.groundingRate, 0.5);
});

Deno.test("evaluation records remain tenant-scoped", async () => {
  const path = await workspace();
  await runEvaluation(path, {
    tenant: "tenant-a",
    datasetVersion: "v1",
    cases: [{ id: "a", input: "a", expected: "a" }],
    outputs: { a: "a" },
  });
  assertEquals((await readEvaluations(path, { tenant: "tenant-b" })).length, 0);
  assert((await readEvaluations(path, { tenant: "tenant-a" })).length === 1);
});
