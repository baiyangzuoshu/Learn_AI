import { BudgetExceededError, resolveRunBudget } from "../src/contracts.ts";
import type { ChatResponse, Message } from "../src/core/types.ts";
import { AgentRuntime } from "../src/runtime.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { ProviderError } from "../src/providers/openai_compatible.ts";
import { setAppDataPath } from "../src/platform.ts";
import { buildStructuredSummaryMessages } from "../src/context.ts";
import { loadSummaryCheckpoint } from "../src/context_checkpoint.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

const summaryResponse: ChatResponse = {
  choices: [{
    message: {
      role: "assistant",
      content: JSON.stringify({
        currentGoal: "Finish the requested operation",
        constraintsAndDecisions: ["Keep the original request intact"],
        completedWork: ["Completed the prior operation; do not repeat it"],
        evidence: ["/workspace/output.txt", "archive-ref-123"],
        pending: ["Report the result"],
      }),
    },
    finish_reason: "stop",
  }],
};

function fixtureConfig(): ProviderConfig {
  return {
    id: "summary-test",
    name: "Summary Test",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://summary.invalid",
    model: "summary-test",
    contextWindowTokens: 20_000,
    outputTokenReserve: 256,
    safetyMarginTokens: 128,
    compactionTargetRatio: 0.75,
    contextSummaryInputTokens: 3_000,
    contextSummaryOutputTokens: 512,
    contextSummaryCallBudget: 1,
    tokenEstimator: "conservative-v1",
  };
}

function history(): Message[] {
  return Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    content: `${index % 2 === 0 ? "request" : "completed response"} ${index} ${
      "detail ".repeat(200)
    }`,
  }));
}

Deno.test("context overflow uses one bounded structured-summary recovery and accounts for it", async () => {
  setAppDataPath(await Deno.makeTempDir({ dir: "/private/tmp", prefix: "context-summary-" }));
  const config = fixtureConfig();
  const controller = new AbortController();
  const calls: {
    messages: Message[];
    tools: unknown[];
    signal?: AbortSignal;
    outputReserve?: number;
    outputCap?: number;
  }[] = [];
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(requestConfig, messages, tools, signal, requestOptions) {
      calls.push({
        messages: structuredClone(messages),
        tools,
        signal,
        outputReserve: requestConfig.outputTokenReserve,
        outputCap: requestOptions?.maxOutputTokens,
      });
      if (calls.length === 1) {
        throw new ProviderError(
          "context_length_exceeded",
          400,
          false,
          undefined,
          "context_length_exceeded",
        );
      }
      if (calls.length === 2) return summaryResponse;
      return {
        choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "length" }],
        usage: { prompt_tokens: 70, completion_tokens: 2, total_tokens: 72 },
      };
    },
  };
  let traceSummary: Record<string, unknown> | undefined;
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const result = await runtime.run({
    query: "Keep this exact current request and finish the operation",
    history: history(),
    workspace: "/workspace/summary-test",
    sessionId: "summary-session-123456",
    permissionMode: "full",
    signal: controller.signal,
    budget: resolveRunBudget({ iterations: 5, toolCalls: 5, outputChars: 10_000, cost: 5 }),
    onEvent(event) {
      if (event.type === "hook" && event.name === "TraceSummary") {
        traceSummary = JSON.parse(event.detail ?? "{}") as Record<string, unknown>;
      }
    },
  });
  assert(result === "done");
  assert(
    calls.length === 3,
    "one failed request, one summary request, and one recovery request expected",
  );
  assert(calls[1].tools.length === 0, "summary requests must not expose tools");
  assert(calls[1].signal === controller.signal, "summary request must receive the run AbortSignal");
  assert(
    calls[1].outputReserve === config.contextSummaryOutputTokens,
    "summary output budget must be applied",
  );
  assert(
    calls[1].outputCap === config.contextSummaryOutputTokens,
    "summary call must pass output cap",
  );
  assert(calls[2].outputCap === config.outputTokenReserve, "answer call must pass output cap");
  assert(
    calls[1].messages.some((message) =>
      String(message.content).includes("Current request, preserved separately")
    ) &&
      calls[1].messages.some((message) =>
        String(message.content).includes("Keep this exact current request")
      ),
    "summary call must preserve the original query as a separate input",
  );
  assert(
    calls[2].messages.some((message) => String(message.content).includes("已完成工作")) &&
      calls[2].messages.some((message) =>
        String(message.content).includes("Keep this exact current request")
      ),
    "recovery request must retain the structured summary and original query",
  );
  const usage = traceSummary?.tokenUsage as Record<string, unknown> | undefined;
  assert(usage, "trace summary should expose run token accounting");
  const contextSummary = usage.contextSummary as Record<string, unknown>;
  assert(contextSummary.calls === 1, "summary API call must be counted");
  assert(Number(contextSummary.estimatedInputTokens) > 0, "summary input estimate must be counted");
  assert(
    Number(contextSummary.estimatedOutputTokens) > 0,
    "summary output estimate must be counted",
  );
  assert(usage.contextOverflowRecoveries === 1, "overflow recovery count must be visible");
  assert((usage.requests as number) === 3, "summary call must count toward total API requests");
  const output = usage.output as Record<string, unknown>;
  assert(output.truncatedResponses === 1, "provider output truncation must be observable");

  const savedCheckpoint = await loadSummaryCheckpoint(
    "summary-session-123456",
    "/workspace/summary-test",
    history(),
  );
  assert(
    Number(savedCheckpoint?.historyCount) > 0,
    "summarized historical prefix should be persisted",
  );
  assert(
    savedCheckpoint?.summary.includes("current request is supplied separately"),
    "a persisted checkpoint must leave the next current request independent",
  );
  const resumed = await runtime.run({
    query: "Follow up on the operation",
    history: history(),
    workspace: "/workspace/summary-test",
    sessionId: "summary-session-123456",
    permissionMode: "full",
    budget: resolveRunBudget({ iterations: 5, toolCalls: 5, outputChars: 10_000, cost: 5 }),
  });
  assert(resumed === "done");
  assert(
    Number(calls.length) === 4,
    "resuming with a checkpoint should not call the summary API again",
  );
  assert(
    calls[3].messages.some((message) =>
      message.role === "system" && String(message.content).includes("已完成工作")
    ),
    "the resumed request should receive the persisted summary",
  );
  assert(
    !calls[3].messages.some((message) => message.content === history()[0].content),
    "messages covered by the checkpoint must not be injected again",
  );
});

Deno.test("a second explicit context overflow is not retried", async () => {
  setAppDataPath(
    await Deno.makeTempDir({ dir: "/private/tmp", prefix: "context-summary-overflow-" }),
  );
  const config = fixtureConfig();
  let calls = 0;
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(_config, _messages, _tools) {
      calls++;
      if (calls === 2) return summaryResponse;
      throw new ProviderError(
        "context_length_exceeded",
        400,
        false,
        undefined,
        "context_length_exceeded",
      );
    },
  };
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  let error: unknown;
  try {
    await runtime.run({
      query: "Complete this request",
      history: history(),
      workspace: "/workspace/summary-test",
      sessionId: "overflow-session-123456",
      permissionMode: "full",
      budget: resolveRunBudget({ iterations: 5, toolCalls: 5, outputChars: 10_000, cost: 5 }),
    });
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof ProviderError, "second overflow should propagate to the caller");
  assert(calls === 3, "initial request, summary, and one recovery request are the hard limit");
});

Deno.test("structured summary input keeps completed tool actions and their results together", () => {
  const summaryInput = buildStructuredSummaryMessages(
    [[
      { role: "user", content: "Create the report" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "write-report-1",
          type: "function",
          function: { name: "write_file", arguments: '{"path":"/workspace/report.txt"}' },
        }],
      },
      { role: "tool", tool_call_id: "write-report-1", content: "created /workspace/report.txt" },
      { role: "assistant", content: "The report is ready." },
    ]],
    "Review the report",
    ["ref-123"],
    6_000,
  );
  const history = String(summaryInput.at(-1)?.content);
  assert(history.includes("write_file"));
  assert(history.includes("created /workspace/report.txt"));
  assert(history.includes("ref-123"));
  assert(
    String(summaryInput[0].content).includes(
      "Never mark it pending or recommend repeating a completed side effect",
    ),
    "summary prompt must tell the model not to repeat completed side effects",
  );
});

Deno.test("an exhausted request budget stops before the summary API call", async () => {
  setAppDataPath(
    await Deno.makeTempDir({ dir: "/private/tmp", prefix: "context-summary-budget-" }),
  );
  const config = fixtureConfig();
  let calls = 0;
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion() {
      calls++;
      throw new ProviderError(
        "context_length_exceeded",
        400,
        false,
        undefined,
        "context_length_exceeded",
      );
    },
  };
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  let error: unknown;
  try {
    await runtime.run({
      query: "Complete this request",
      history: history(),
      workspace: "/workspace/summary-test",
      sessionId: "summary-budget-123456",
      permissionMode: "full",
      budget: resolveRunBudget({ iterations: 5, toolCalls: 5, outputChars: 10_000, cost: 1 }),
    });
  } catch (caught) {
    error = caught;
  }
  assert(
    error instanceof BudgetExceededError,
    "budget exhaustion should terminate the run directly",
  );
  assert(calls === 1, "summary provider call must not occur after the request budget is exhausted");
});

Deno.test("cancellation stops the provider request without retry or extra summary calls", async () => {
  const config = fixtureConfig();
  const controller = new AbortController();
  let calls = 0;
  let signalSeen: AbortSignal | undefined;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => markStarted = resolve);
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(_config, _messages, _tools, signal) {
      calls++;
      signalSeen = signal;
      markStarted();
      return await new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Generation stopped", "AbortError"));
        }, { once: true });
      });
    },
  };
  const runtime = new AgentRuntime([], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const run = runtime.run({
    query: "Check the build result and preserve the requested output path",
    workspace: "/workspace/cancel-test",
    sessionId: "cancel-session-123456",
    permissionMode: "full",
    signal: controller.signal,
  });
  await started;
  controller.abort();
  let error: unknown;
  try {
    await run;
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof DOMException && error.name === "AbortError");
  assert(signalSeen === controller.signal, "provider should receive the run cancellation signal");
  assert(calls === 1, "cancellation should not start a retry or summary request");
});
