import { AgentRuntime } from "../../src/runtime.ts";
import {
  BudgetExceededError,
  type BudgetKind,
  type HarnessFeature,
  RuntimeBudget,
} from "../../src/contracts.ts";
import type { ChatResponse, ToolDefinition } from "../../src/core/types.ts";
import type { ModelProvider, ProviderConfig } from "../../src/providers/contracts.ts";

export interface AcceptanceCase {
  id: string;
  title: string;
  run: () => Promise<void> | void;
}

export interface AcceptanceCaseResult {
  id: string;
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  detail?: string;
}

export interface AcceptanceReport {
  suite: "21test-runtime-budget";
  ok: boolean;
  passed: number;
  failed: number;
  results: AcceptanceCaseResult[];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = "values differ"): void {
  if (Object.is(actual, expected)) return;
  throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

async function expectBudgetError(action: () => Promise<unknown>, kind: BudgetKind): Promise<void> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof BudgetExceededError, `expected ${kind} budget error`);
  assertEquals(thrown.kind, kind);
}

const fakeConfig: ProviderConfig = {
  id: "fake",
  name: "Fake Provider",
  protocol: "openai",
  apiKey: "test-only",
  baseUrl: "https://fake.invalid",
  model: "fake-model",
};

const echoDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "test_echo",
    description: "Return a small test value",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

const echoFeature: HarnessFeature = {
  id: "test-echo",
  register({ tools }) {
    tools.register(echoDefinition, async (input, context) => {
      assert(context.budget instanceof RuntimeBudget, "tool context must receive a budget");
      return `echo:${String(input.value ?? "ok")}`;
    });
  },
};

function toolResponse(id = "call-1"): ChatResponse {
  return {
    choices: [{
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id,
          type: "function",
          function: { name: "test_echo", arguments: '{"value":"ok"}' },
        }],
      },
      finish_reason: "tool_calls",
    }],
  };
}

function textResponse(content: string): ChatResponse {
  return { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] };
}

function createRuntime(factory: (call: number) => ChatResponse): {
  runtime: AgentRuntime;
  calls: () => number;
} {
  let callCount = 0;
  const provider: ModelProvider = {
    id: "fake",
    async createChatCompletion(
      _config,
      _messages,
      _tools,
      _signal,
    ): Promise<ChatResponse> {
      const response = factory(callCount);
      callCount++;
      return response;
    },
  };
  return {
    runtime: new AgentRuntime([echoFeature], {
      resolveProviderConfig: async () => fakeConfig,
      getModelProvider: () => provider,
    }),
    calls: () => callCount,
  };
}

function runOptions(budget: Partial<RuntimeBudget["limit"]>) {
  return {
    query: "test bounded runtime",
    workspace: process.cwd(),
    permissionMode: "full" as const,
    budget,
  };
}

export const runtimeBudgetAcceptanceCases: readonly AcceptanceCase[] = [
  {
    id: "21test-budget-child",
    title: "子预算传播与记账",
    run() {
      const parent = new RuntimeBudget({ iterations: 3, toolCalls: 3, outputChars: 20, cost: 2 });
      const child = parent.child({ iterations: 1, toolCalls: 2, outputChars: 10, cost: 1 });
      child.consume("iterations");
      child.consume("toolCalls", 2);
      assertEquals(parent.used.iterations, 1);
      assertEquals(parent.used.toolCalls, 2);
      assertEquals(child.remaining().toolCalls, 0);
    },
  },
  {
    id: "21test-agent-loop",
    title: "Agent Loop 正常完成并发出预算证据",
    async run() {
      const { runtime, calls } = createRuntime((call) =>
        call === 0 ? toolResponse() : textResponse("done")
      );
      const hooks: string[] = [];
      let toolRuns = 0;
      const result = await runtime.run({
        ...runOptions({ iterations: 2, toolCalls: 1, outputChars: 100, cost: 2 }),
        onEvent(event) {
          if (event.type === "hook") hooks.push(event.name);
          if (event.type === "tool") toolRuns++;
        },
      });
      assertEquals(result, "done");
      assertEquals(calls(), 2);
      assertEquals(toolRuns, 1);
      assert(hooks.includes("RunBudget"), "RunBudget hook missing");
      assert(hooks.includes("RunUsage"), "RunUsage hook missing");
      assert(hooks.includes("Stop"), "Stop hook missing");
    },
  },
  {
    id: "21test-tool-limit",
    title: "工具调用预算超限前停止",
    async run() {
      const { runtime, calls } = createRuntime((call) => toolResponse(`call-${call}`));
      const hooks: string[] = [];
      let toolRuns = 0;
      await expectBudgetError(
        () =>
          runtime.run({
            ...runOptions({ iterations: 10, toolCalls: 1, outputChars: 100, cost: 10 }),
            onEvent(event) {
              if (event.type === "hook") hooks.push(event.name);
              if (event.type === "tool") toolRuns++;
            },
          }),
        "toolCalls",
      );
      assertEquals(calls(), 2);
      assertEquals(toolRuns, 1);
      assert(hooks.includes("BudgetExceeded"), "BudgetExceeded hook missing");
    },
  },
  {
    id: "21test-output-cost",
    title: "输出量和 Provider 成本预算",
    async run() {
      const outputRuntime = createRuntime(() => textResponse("1234"));
      await expectBudgetError(
        () =>
          outputRuntime.runtime.run(runOptions({
            iterations: 1,
            toolCalls: 1,
            outputChars: 3,
            cost: 1,
          })),
        "outputChars",
      );
      assertEquals(outputRuntime.calls(), 1);

      const costRuntime = createRuntime(() => textResponse("never reached"));
      await expectBudgetError(
        () =>
          costRuntime.runtime.run(runOptions({
            iterations: 1,
            toolCalls: 1,
            outputChars: 100,
            cost: 0,
          })),
        "cost",
      );
      assertEquals(costRuntime.calls(), 0);
    },
  },
  {
    id: "21test-iteration-cancel",
    title: "迭代预算和 AbortSignal 取消",
    async run() {
      const { runtime, calls } = createRuntime((call) => toolResponse(`call-${call}`));
      await expectBudgetError(
        () => runtime.run(runOptions({ iterations: 1, toolCalls: 10, outputChars: 100, cost: 10 })),
        "iterations",
      );
      assertEquals(calls(), 1);

      const cancelled = new AbortController();
      cancelled.abort();
      const cancelledRuntime = createRuntime(() => textResponse("never reached"));
      let thrown: unknown;
      try {
        await cancelledRuntime.runtime.run({ ...runOptions({}), signal: cancelled.signal });
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof DOMException && thrown.name === "AbortError", "cancel must abort");
      assertEquals(cancelledRuntime.calls(), 0);
    },
  },
];

export async function runRuntimeBudgetAcceptance(): Promise<AcceptanceReport> {
  const results: AcceptanceCaseResult[] = [];
  for (const acceptanceCase of runtimeBudgetAcceptanceCases) {
    const startedAt = performance.now();
    try {
      await acceptanceCase.run();
      results.push({
        id: acceptanceCase.id,
        title: acceptanceCase.title,
        status: "passed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      results.push({
        id: acceptanceCase.id,
        title: acceptanceCase.title,
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const passed = results.filter((result) => result.status === "passed").length;
  return {
    suite: "21test-runtime-budget",
    ok: passed === results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
