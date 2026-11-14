import { AgentRuntime } from "../src/runtime.ts";
import type { ChatResponse } from "../src/core/types.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { TraceBook } from "../src/trace.ts";
import { resolveRunBudget, RuntimeBudget, RunTokenUsage } from "../src/contracts.ts";
import { ProviderError } from "../src/providers/openai_compatible.ts";

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
  const summary = traces.summary(root, "error", new RunTokenUsage().snapshot());

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
    usage: {
      prompt_tokens: 120,
      completion_tokens: 3,
      total_tokens: 123,
      prompt_cache_hit_tokens: 20,
      prompt_cache_miss_tokens: 100,
    },
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
  const events: Array<{ type: string; name: string; traceId?: string; detail?: string }> = [];
  const result = await runtime.run({
    query: "trace",
    workspace: Deno.cwd(),
    permissionMode: "full",
    onEvent(event) {
      events.push({
        type: event.type,
        name: event.name,
        traceId: event.traceId,
        detail: event.detail,
      });
    },
  });

  assertEquals(result, "ok");
  const summaryEvent = events.find((event) => event.name === "TraceSummary");
  assertExists(summaryEvent);
  assert(summaryEvent.traceId);
  assert(events.filter((event) => event.traceId === summaryEvent.traceId).length >= 3);
  const summary = JSON.parse(summaryEvent.detail ?? "") as {
    providerCalls: number;
    tokenUsage: {
      requests: number;
      estimatedInput: {
        chars: number;
        tokens: number;
        largestComponent: string;
      };
      actual: {
        available: boolean;
        inputTokens: number;
        outputTokens: number;
        cacheHitTokens: number;
      };
    };
  };
  assertEquals(summary.providerCalls, 1);
  assertEquals(summary.tokenUsage.requests, 1);
  assert(summary.tokenUsage.estimatedInput.chars > 0);
  assert(summary.tokenUsage.estimatedInput.tokens > 0);
  assert(typeof summary.tokenUsage.estimatedInput.largestComponent === "string");
  assertEquals(summary.tokenUsage.actual.available, true);
  assertEquals(summary.tokenUsage.actual.inputTokens, 120);
  assertEquals(summary.tokenUsage.actual.outputTokens, 3);
  assertEquals(summary.tokenUsage.actual.cacheHitTokens, 20);
});

Deno.test("AgentRuntime accounts for provider retries and shares child token usage", async () => {
  const config: ProviderConfig = {
    id: "retry-test",
    name: "Retry Test Provider",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://retry.invalid",
    model: "retry-model",
  };
  let attempts = 0;
  const provider: ModelProvider = {
    id: "retry-test",
    async createChatCompletion() {
      attempts++;
      if (attempts === 1) throw new ProviderError("temporary", 503, true, 1);
      return {
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      };
    },
  };
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const parentBudget = new RuntimeBudget(resolveRunBudget());
  const childBudget = parentBudget.child();
  let summaryDetail = "";
  await runtime.run({
    query: "retry",
    workspace: Deno.cwd(),
    permissionMode: "full",
    budget: childBudget,
    onEvent(event) {
      if (event.name === "TraceSummary") summaryDetail = event.detail ?? "";
    },
  });

  const summary = JSON.parse(summaryDetail) as {
    tokenUsage: {
      requests: number;
      failedRequests: number;
      actual: { inputTokens: number; outputTokens: number };
    };
  };
  assertEquals(summary.tokenUsage.requests, 2);
  assertEquals(summary.tokenUsage.failedRequests, 1);
  assertEquals(summary.tokenUsage.actual.inputTokens, 10);
  assertEquals(summary.tokenUsage.actual.outputTokens, 2);
  assertEquals(parentBudget.tokenUsage.snapshot().requests, 2);
});
