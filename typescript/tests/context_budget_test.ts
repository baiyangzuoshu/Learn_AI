import { estimateTokensFromText } from "../src/contracts.ts";
import {
  compactRequestContext,
  ContextBudgetExceededError,
  estimateRequestInputTokens,
  fitRequestToContextBudget,
} from "../src/context.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import type { ProviderConfig } from "../src/providers/contracts.ts";
import { setAppDataPath } from "../src/platform.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "test",
    name: "Test",
    protocol: "openai",
    apiKey: "test",
    baseUrl: "https://example.invalid",
    model: "unknown-model",
    contextWindowTokens: 2_000,
    outputTokenReserve: 200,
    safetyMarginTokens: 100,
    compactionTargetRatio: 0.7,
    tokenEstimator: "conservative-v1",
    ...overrides,
  };
}

Deno.test("short mixed-language request includes system prompt, messages, and schemas", () => {
  const messages: Message[] = [
    { role: "system", content: "system 规则" },
    { role: "user", content: "请检查 README.md" },
  ];
  const tools: ToolDefinition[] = [{
    type: "function",
    function: { name: "read_file", description: "Read a file", parameters: { type: "object" } },
  }];
  const estimated = estimateRequestInputTokens(messages, tools);
  assert(estimated > JSON.stringify(messages).length);
  const fit = fitRequestToContextBudget(messages, tools, config());
  assert(!fit.compacted);
  assert(fit.estimatedInputTokens < 1_700);
});

Deno.test("large file/tool results compact to a lower target and preserve tool-call pairs", async () => {
  setAppDataPath(await Deno.makeTempDir({ dir: "/private/tmp", prefix: "context-budget-" }));
  const assistant: Message = {
    role: "assistant",
    content: null,
    tool_calls: [{
      id: "call-1",
      type: "function",
      function: { name: "read_file", arguments: "{}" },
    }],
  };
  const result: Message = {
    role: "tool",
    tool_call_id: "call-1",
    content: "文件内容。".repeat(500),
  };
  const messages: Message[] = [
    { role: "system", content: "system" },
    { role: "user", content: "旧任务" },
    { role: "assistant", content: "旧结果".repeat(500) },
    { role: "user", content: "现在总结这个文件" },
    assistant,
    result,
  ];
  const tools: ToolDefinition[] = [];
  const testConfig = config({
    contextWindowTokens: 4_000,
    outputTokenReserve: 500,
    safetyMarginTokens: 200,
  });
  const layered = await compactRequestContext(messages, tools, testConfig, {
    workspace: "/workspace/context-budget",
    sessionId: "context-budget-session",
    consumedToolCallIds: new Set(),
  });
  const resultBudget = {
    ...fitRequestToContextBudget(
      messages,
      tools,
      testConfig,
    ),
  };
  assert(layered || resultBudget.compacted);
  assert(resultBudget.estimatedInputTokens <= resultBudget.targetTokens);
  assert(messages.includes(assistant) && messages.includes(result));
  assert(messages.indexOf(result) === messages.indexOf(assistant) + 1);
  assert(result.content?.includes('"reference"'));
});

Deno.test("an oversized schema fails preflight with component counts", () => {
  const tools: ToolDefinition[] = [{
    type: "function",
    function: {
      name: "huge_tool",
      description: "x".repeat(4_000),
      parameters: { type: "object" },
    },
  }];
  try {
    fitRequestToContextBudget(
      [{ role: "system", content: "sys" }, { role: "user", content: "短任务" }],
      tools,
      config(),
    );
    throw new Error("expected context budget error");
  } catch (error) {
    assert(error instanceof ContextBudgetExceededError);
    assert(error.toolDefinitionTokens > error.inputBudgetTokens);
  }
});

Deno.test("estimator choice is explicit for multilingual input", () => {
  const mixed = "Hello 世界";
  assert(estimateTokensFromText(mixed, "conservative-v1") >= mixed.length);
  assert(estimateTokensFromText(mixed, "multilingual-v1") < mixed.length);
});
