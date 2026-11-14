import { resolveRunBudget } from "../src/contracts.ts";
import type { HarnessFeature } from "../src/contracts.ts";
import type { ChatResponse, Message, ToolDefinition } from "../src/core/types.ts";
import { AgentRuntime } from "../src/runtime.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { setAppDataPath } from "../src/platform.ts";
import { assertToolCallPairs } from "../src/context.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("AgentRuntime compacts successive tool rounds without orphaning calls or extra requests", async () => {
  const root = await Deno.makeTempDir({ dir: "/private/tmp", prefix: "layered-context-" });
  setAppDataPath(root);
  const toolDefinition: ToolDefinition = {
    type: "function",
    function: {
      name: "large_output",
      description: "return a large result",
      parameters: { type: "object" },
    },
  };
  const feature: HarnessFeature = {
    id: "layered-context-test",
    register({ tools }) {
      tools.register(toolDefinition, async () => "large payload ".repeat(600), {
        risk: "read-only",
        maxOutput: 12_000,
      });
    },
  };
  const config: ProviderConfig = {
    id: "layered-context-test",
    name: "Layered Context Test",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://context.invalid",
    model: "context-test",
    contextWindowTokens: 4_000,
    outputTokenReserve: 300,
    safetyMarginTokens: 200,
    compactionTargetRatio: 0.75,
    tokenEstimator: "conservative-v1",
  };
  const responseForCall = (id: string): ChatResponse => ({
    choices: [{
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id,
          type: "function",
          function: { name: "large_output", arguments: "{}" },
        }],
      },
      finish_reason: "tool_calls",
    }],
  });
  const responses: ChatResponse[] = [
    responseForCall("call-1"),
    responseForCall("call-2"),
    responseForCall("call-3"),
    {
      choices: [{
        message: { role: "assistant", content: "finished" },
        finish_reason: "stop",
      }],
    },
  ];
  const sentMessages: Message[][] = [];
  const provider: ModelProvider = {
    id: "layered-context-test",
    async createChatCompletion(_config, messages) {
      assertToolCallPairs(messages);
      sentMessages.push(structuredClone(messages));
      const response = responses.shift();
      if (!response) throw new Error("unexpected extra provider request");
      return response;
    },
  };
  const runtime = new AgentRuntime([feature], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const result = await runtime.run({
    query: "inspect repeated large tool output",
    workspace: "/workspace/layered-context",
    sessionId: "layered-session-123456",
    permissionMode: "full",
    budget: resolveRunBudget({ iterations: 10, toolCalls: 10, outputChars: 50_000, cost: 10 }),
  });
  assert(result === "finished");
  assert(sentMessages.length === 4, "ordinary compaction must not create summary API calls");
  assert(sentMessages.every((messages) => {
    try {
      assertToolCallPairs(messages);
      return true;
    } catch {
      return false;
    }
  }));
  const thirdRequest = sentMessages[2].map((message) => String(message.content ?? "")).join("\n");
  assert(
    thirdRequest.includes("Earlier tool result archived; reference="),
    "a previously consumed result should be replaced by a restorable reference",
  );
});
