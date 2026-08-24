import { AgentRuntime } from "../src/runtime.ts";
import type { ChatResponse } from "../src/core/types.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { TraceBook } from "../src/trace.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertExists<T>(value: T | undefined): asserts value is T {
  assert(value !== undefined, "expected value to exist");
}

Deno.test("TraceBook links parent spans and summarizes status", () => {
  const traces = new TraceBook();
  const root = traces.start("agent.run", "run");
  const child = traces.start("provider.chat", "provider", root);
  traces.end(child, "error");
  const summary = traces.summary(root, "error");

  assertEquals(child.traceId, root.traceId);
  assertEquals(child.parentSpanId, root.spanId);
  assertEquals(summary.spanCount, 2);
  assertEquals(summary.providerCalls, 1);
  assertEquals(summary.errorSpans, 1);
  assertEquals(summary.status, "error");
  assertEquals(summary.spans.length, 2);
  assertEquals(summary.spans[1]?.parentSpanId, root.spanId);
});

Deno.test("AgentRuntime emits a trace summary and correlates events", async () => {
  const config: ProviderConfig = {
    id: "trace-test",
    name: "Trace Test Provider",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://trace.invalid",
    model: "trace-model",
  };
  const response: ChatResponse = {
    choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
  };
  const provider: ModelProvider = {
    id: "trace-test",
    async createChatCompletion() {
      return response;
    },
  };
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const events: Array<{ type: string; name: string; traceId?: string }> = [];
  const result = await runtime.run({
    query: "trace",
    workspace: Deno.cwd(),
    permissionMode: "full",
    onEvent(event) {
      events.push({ type: event.type, name: event.name, traceId: event.traceId });
    },
  });

  assertEquals(result, "ok");
  const summaryEvent = events.find((event) => event.name === "TraceSummary");
  assertExists(summaryEvent);
  assert(summaryEvent.traceId);
  assert(events.filter((event) => event.traceId === summaryEvent.traceId).length >= 3);
});
