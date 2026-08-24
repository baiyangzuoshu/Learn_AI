import { AgentRuntime } from "../src/runtime.ts";
import { ToolRegistry } from "../src/registry.ts";
import {
  authorizeToolPolicy,
  boundedToolOutput,
  createPrincipal,
  normalizeToolPolicy,
  ToolPolicyError,
} from "../src/tool_policy.ts";
import type { ToolDefinition } from "../src/core/types.ts";
import type { ChatResponse } from "../src/core/types.ts";
import type { HarnessFeature } from "../src/contracts.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "policy_test",
    description: "policy test tool",
    parameters: { type: "object", properties: {} },
  },
};

Deno.test("ToolRegistry attaches a safe default policy", () => {
  const registry = new ToolRegistry();
  registry.register(definition, async () => "ok");
  const registered = registry.get("policy_test");
  assert(registered);
  assertEquals(registered.policy.name, "policy_test");
  assertEquals(registered.policy.risk, "read-only");
  assertEquals(registered.policy.scopes[0], "read");
});

Deno.test("Tool policy denies expired or under-scoped principals", () => {
  const policy = normalizeToolPolicy(definition, {
    scopes: ["read", "project"],
    maxOutput: 128,
  });
  let denied = false;
  try {
    authorizeToolPolicy(policy, {
      id: "expired",
      scopes: new Set(["read", "project"]),
      expiresAt: Date.now() - 1,
    });
  } catch (error) {
    denied = error instanceof ToolPolicyError && error.reason === "expired";
  }
  assert(denied, "expired principal was accepted");
  denied = false;
  try {
    authorizeToolPolicy(policy, {
      id: "limited",
      scopes: new Set(["read"]),
      expiresAt: Date.now() + 60_000,
    });
  } catch (error) {
    denied = error instanceof ToolPolicyError && error.reason === "scope";
  }
  assert(denied, "under-scoped principal was accepted");
  authorizeToolPolicy(policy, {
    id: "scoped",
    scopes: new Set(["read", "project"]),
    expiresAt: createPrincipal("auto").expiresAt,
  });
});

Deno.test("boundedToolOutput keeps the declared maximum", () => {
  const policy = normalizeToolPolicy(definition, { maxOutput: 128 });
  const output = boundedToolOutput("x".repeat(500), policy);
  assertEquals(output.length, 128);
  assert(output.includes("工具输出已截断"), "truncation marker missing");
});

Deno.test("AgentRuntime enforces tool output policy before model continuation", async () => {
  const toolDefinition: ToolDefinition = {
    ...definition,
    function: { ...definition.function, name: "bounded_policy_test" },
  };
  const feature: HarnessFeature = {
    id: "policy-test-feature",
    register({ tools }) {
      tools.register(toolDefinition, async () => "x".repeat(500), { maxOutput: 128 });
    },
  };
  const config: ProviderConfig = {
    id: "policy-test",
    name: "Policy Test Provider",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://policy.invalid",
    model: "policy-model",
  };
  const responses: ChatResponse[] = [
    {
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: { name: "bounded_policy_test", arguments: "{}" },
          }],
        },
        finish_reason: "tool_calls",
      }],
    },
    { choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }] },
  ];
  const provider: ModelProvider = {
    id: "policy-test",
    async createChatCompletion() {
      const response = responses.shift();
      if (!response) throw new Error("provider called too many times");
      return response;
    },
  };
  const runtime = new AgentRuntime([feature], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const events: Array<{ type: string; name: string; output?: string }> = [];
  assertEquals(
    await runtime.run({
      query: "bounded",
      workspace: Deno.cwd(),
      permissionMode: "full",
      onEvent(event) {
        events.push({ type: event.type, name: event.name, output: event.output });
      },
    }),
    "done",
  );
  const toolEvent = events.find((event) => event.type === "tool");
  assert(toolEvent?.output);
  assertEquals(toolEvent.output.length, 128);
  assert(events.some((event) => event.name === "ToolOutputTruncated"));
});
