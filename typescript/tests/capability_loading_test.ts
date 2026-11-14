import { resolveRunBudget, RuntimeBudget, RunTokenUsage } from "../src/contracts.ts";
import type { HarnessFeature } from "../src/contracts.ts";
import type { ChatResponse, Message, ToolDefinition } from "../src/core/types.ts";
import { AgentRuntime } from "../src/runtime.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { productivity } from "../src/features/productivity.ts";
import { PromptRegistry } from "../src/prompt.ts";
import { ToolRegistry } from "../src/registry.ts";
import { harness } from "../src/mod.ts";
import { setAppDataPath } from "../src/platform.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function tool(name: string, description: string): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties: {} } },
  };
}

const config: ProviderConfig = {
  id: "capability-test",
  name: "Capability Test",
  protocol: "openai",
  apiKey: "test-only",
  baseUrl: "https://capability.invalid",
  model: "capability-test",
};

function call(id: string, name: string, arguments_ = "{}"): ChatResponse {
  return {
    choices: [{
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id,
          type: "function",
          function: { name, arguments: arguments_ },
        }],
      },
      finish_reason: "tool_calls",
    }],
  };
}

const coreFeature: HarnessFeature = {
  id: "test-core",
  capability: { id: "core", title: "Core", description: "Essential tools.", alwaysAvailable: true },
  register({ tools, prompts }) {
    tools.register(tool("read_file", "Read a workspace file"), async () => "contents");
    prompts.register({
      id: "core-rules",
      title: "Core rules",
      content: "Always obey workspace safety.",
      priority: 1,
    });
  },
};

const researchFeature: HarnessFeature = {
  id: "test-research",
  capability: {
    id: "research",
    title: "Research",
    description: "Find and synthesize cited sources.",
  },
  register({ tools, prompts }) {
    tools.register(tool("research_search", "Search cited sources"), async () => "research result");
    prompts.register({
      id: "research-instructions",
      title: "Research instructions",
      content: "Check source quality and include citations.",
      priority: 10,
    });
  },
};

Deno.test("optional capability schemas and prompts load on demand in stable order", async () => {
  const providerRequests: Array<{ tools: string[]; system: string; toolOutput: string }> = [];
  const responses: ChatResponse[] = [
    call("hidden-call", "research_search"),
    call("load-call", "load_capability", '{"capability":"research"}'),
    call("research-call", "research_search"),
    { choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }] },
  ];
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(_config, messages, tools) {
      providerRequests.push({
        tools: tools.map((item) => item.function.name),
        system: String(messages.find((message) => message.role === "system")?.content),
        toolOutput: messages.filter((message) => message.role === "tool")
          .map((message) => String(message.content)).join("\n"),
      });
      const response = responses.shift();
      if (!response) throw new Error("unexpected provider request");
      return response;
    },
  };
  const runtime = new AgentRuntime([coreFeature, researchFeature], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  assert(runtime.tools.namesInGroup("research").includes("research_search"));
  const result = await runtime.run({
    query: "Find a source",
    workspace: "/workspace/capabilities",
    sessionId: "capability-session-123456",
    permissionMode: "full",
    budget: resolveRunBudget({ iterations: 6, toolCalls: 6, outputChars: 10_000, cost: 6 }),
  });
  assert(result === "done");
  assert(providerRequests.length === 4);
  assert(providerRequests[0].tools.join(",") === "read_file,load_capability");
  assert(!providerRequests[0].tools.includes("research_search"));
  assert(providerRequests[0].system.includes("research: Find and synthesize cited sources."));
  assert(!providerRequests[0].system.includes("Check source quality"));
  assert(!providerRequests[1].tools.includes("research_search"));
  assert(
    providerRequests[2].tools.join(",") === "read_file,research_search,load_capability",
    providerRequests.map((request) => `${request.tools.join(",")}: ${request.toolOutput}`).join(
      " / ",
    ),
  );
  assert(providerRequests[2].system.includes("Check source quality and include citations."));
});

Deno.test("production core request sends substantially fewer schemas and prompt text", () => {
  const active = new Set(["core", "security"]);
  const coreTools = harness.tools.visibleDefinitions(active);
  const allTools = harness.tools.definitions();
  const corePrompt = harness.prompts.build("/workspace/example", active).prompt;
  const fullPrompt = harness.prompts.build("/workspace/example").prompt;
  assert(
    coreTools.length < allTools.length * 0.5,
    `${coreTools.length}/${allTools.length} tools remain visible`,
  );
  assert(
    corePrompt.length < fullPrompt.length * 0.75,
    `${corePrompt.length}/${fullPrompt.length} prompt chars remain visible`,
  );
  assert(coreTools.some((item) => item.function.name === "read_file"));
  assert(coreTools.some((item) => item.function.name === "load_capability"));
  const productivityTools = harness.tools.visibleDefinitions(
    new Set(["core", "security", "productivity"]),
  ).map((item) => item.function.name);
  assert(productivityTools.includes("memory_search"));
  assert(
    !productivityTools.some((name) =>
      ["memory_read", "memory_append", "memory_replace"].includes(name)
    ),
  );
});

Deno.test("skill listing shows descriptions and repeat loads are deduplicated per session", async () => {
  const workspace = await Deno.makeTempDir({ dir: "/private/tmp", prefix: "skill-catalog-" });
  await Deno.mkdir(`${workspace}/skills/review`, { recursive: true });
  await Deno.writeTextFile(
    `${workspace}/skills/review/SKILL.md`,
    "---\nname: review\ndescription: Review a patch for correctness and regressions.\n---\n# Review\n\nDetailed instruction body.",
  );
  const registry = new ToolRegistry();
  const prompts = new PromptRegistry();
  productivity.register({ tools: registry, prompts, run: async () => "" });
  const context = {
    workspace,
    sessionId: "skill-session-123456",
    budget: new RuntimeBudget(resolveRunBudget()),
    tokenUsage: new RunTokenUsage(),
  };
  const listing = await registry.get("list_skills")!.handler({}, context);
  assert(listing.includes("review — Review a patch for correctness and regressions."));
  const first = await registry.get("load_skill")!.handler({ name: "review" }, context);
  const second = await registry.get("load_skill")!.handler({ name: "review" }, context);
  assert(first.includes("Detailed instruction body."));
  assert(second.includes("already loaded in this session"));
  assert(second.length < first.length);
});

Deno.test("multi-file retrieval uses core read_file without a capability-loading round trip", async () => {
  setAppDataPath(await Deno.makeTempDir({ dir: "/private/tmp", prefix: "multi-file-benchmark-" }));
  const contents: Record<string, string> = {
    "src/api.ts": "The API validates workspace containment before file access.",
    "src/runtime.ts": "The runtime honors the user's no-network constraint.",
  };
  const feature: HarnessFeature = {
    id: "multi-file-benchmark",
    capability: {
      id: "core",
      title: "Core",
      description: "Essential workspace tools.",
      alwaysAvailable: true,
    },
    register({ tools }) {
      tools.register(tool("read_file", "Read one workspace file"), async (input) => {
        const path = String(input.path ?? "");
        if (!(path in contents)) throw new Error("not found");
        return contents[path];
      }, { risk: "read-only", scopes: ["read"], maxOutput: 2_000 });
    },
  };
  const requests: Array<{ tools: string[]; messages: Message[] }> = [];
  const responses = [
    call("read-api", "read_file", '{"path":"src/api.ts"}'),
    call("read-runtime", "read_file", '{"path":"src/runtime.ts"}'),
    {
      choices: [{
        message: {
          role: "assistant" as const,
          content:
            "Both files enforce workspace containment and preserve the no-network constraint.",
        },
        finish_reason: "stop",
      }],
    },
  ];
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(_config, messages, tools) {
      requests.push({
        tools: tools.map((item) => item.function.name),
        messages: structuredClone(messages),
      });
      const response = responses.shift();
      if (!response) throw new Error("unexpected provider request");
      return response;
    },
  };
  const runtime = new AgentRuntime([feature], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const result = await runtime.run({
    query:
      "Read src/api.ts and src/runtime.ts; preserve the workspace containment and no-network constraints.",
    workspace: "/workspace/multi-file",
    sessionId: "multi-file-session-123456",
    permissionMode: "full",
  });
  assert(result.includes("workspace containment") && result.includes("no-network"));
  assert(requests.length === 3, "two targeted file reads and one final answer are expected");
  assert(requests.every((request) => request.tools.includes("read_file")));
  assert(
    requests.every((request) => !request.tools.includes("load_capability")),
    "core file retrieval must not pay an optional-capability loading round trip",
  );
  const toolResults = requests[2].messages.filter((message) => message.role === "tool");
  assert(toolResults.length === 2, "both file results should be available to the final answer");
  assert(toolResults.some((message) => message.content === contents["src/api.ts"]));
  assert(toolResults.some((message) => message.content === contents["src/runtime.ts"]));
});
