import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveRunBudget, RuntimeBudget, RunTokenUsage } from "../src/contracts.ts";
import type { HarnessFeature } from "../src/contracts.ts";
import type { ChatResponse, Message, ToolDefinition } from "../src/core/types.ts";
import { coreTools } from "../src/features/core_tools.ts";
import { toolResults } from "../src/features/tool_results.ts";
import { ToolRegistry } from "../src/registry.ts";
import { AgentRuntime } from "../src/runtime.ts";
import type { ModelProvider, ProviderConfig } from "../src/providers/contracts.ts";
import { setAppDataPath } from "../src/platform.ts";
import {
  archiveToolResult,
  formatToolResultArchive,
  paginateToolResult,
  readArchivedToolResult,
} from "../src/tool_result_store.ts";

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("large tool results archive, paginate, and stay isolated by workspace and session", async () => {
  const root = await Deno.makeTempDir({ dir: "/private/tmp", prefix: "tool-result-store-" });
  setAppDataPath(root);
  const content = Array.from({ length: 400 }, (_, index) => `line-${index + 1}: value`).join("\n");
  const archive = await archiveToolResult("/workspace/one", "session-12345678", content);
  assert(archive.stored && archive.reference);
  const restored = await readArchivedToolResult(
    "/workspace/one",
    "session-12345678",
    archive.reference,
  );
  assert(restored === content);
  const page = paginateToolResult(restored, { startLine: 220, lineCount: 3 });
  assert(page.content.includes("line-220: value"));
  assert(page.content.includes("line-222: value"));
  assert(page.hasMore);
  const charPage = paginateToolResult(restored, { startChar: 0, charCount: 10 });
  assert(charPage.content === content.slice(0, 10));

  for (
    const [workspace, sessionId] of [
      ["/workspace/two", "session-12345678"],
      ["/workspace/one", "session-87654321"],
    ]
  ) {
    let denied = false;
    try {
      await readArchivedToolResult(workspace, sessionId, archive.reference);
    } catch (error) {
      denied = error instanceof Error && error.message.includes("unavailable");
    }
    assert(denied, "reference should not cross its workspace or session");
  }

  const registry = new ToolRegistry();
  toolResults.register({ tools: registry, prompts: { register() {} }, run: async () => "" });
  assert(registry.names().includes("read_tool_result"));
  const context = {
    workspace: "/workspace/one",
    sessionId: "session-12345678",
    budget: new RuntimeBudget(resolveRunBudget()),
    tokenUsage: new RunTokenUsage(),
  };
  const read = await registry.get("read_tool_result")!.handler({
    reference: archive.reference,
    start_line: 220,
    line_count: 3,
  }, context);
  assert(read.includes("line-220: value"));
  assert(read.includes("line-222: value"));

  const longOutput = Array.from({ length: 500 }, (_, index) => `log-${index + 1}`).join("\n");
  const toolDefinition: ToolDefinition = {
    type: "function",
    function: {
      name: "large_output",
      description: "return a long log",
      parameters: { type: "object" },
    },
  };
  const feature: HarnessFeature = {
    id: "archive-runtime-test",
    register({ tools }) {
      tools.register(toolDefinition, async () => longOutput, { risk: "read-only", maxOutput: 128 });
    },
  };
  const config: ProviderConfig = {
    id: "archive-test",
    name: "Archive Test",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://archive.invalid",
    model: "archive-test",
  };
  const responses: ChatResponse[] = [
    {
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "archive-call",
            type: "function",
            function: { name: "large_output", arguments: "{}" },
          }],
        },
        finish_reason: "tool_calls",
      }],
    },
    { choices: [{ message: { role: "assistant", content: "done" }, finish_reason: "stop" }] },
  ];
  const provider: ModelProvider = {
    id: "archive-test",
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
  let toolOutput = "";
  await runtime.run({
    query: "inspect the complete log",
    workspace: "/workspace/one",
    sessionId: "session-12345678",
    permissionMode: "full",
    onEvent(event) {
      if (event.type === "tool" && event.name === "large_output") toolOutput = event.output ?? "";
    },
  });
  const resultEnvelope = JSON.parse(toolOutput) as { status: string; reference: string | null };
  assert(resultEnvelope.status === "complete");
  assert(resultEnvelope.reference);
  assert(
    await readArchivedToolResult("/workspace/one", "session-12345678", resultEnvelope.reference) ===
      longOutput,
  );

  const file = join(root, "not-a-directory");
  await writeFile(file, "file");
  setAppDataPath(file);
  const failedArchive = await archiveToolResult(
    "/workspace",
    "session-12345678",
    "large result".repeat(110),
  );
  assert(!failedArchive.stored);
  assert(failedArchive.reference === null);
  const envelope = JSON.parse(formatToolResultArchive(failedArchive, 512)) as {
    status: string;
    reference: string | null;
    hasMore: boolean;
    preview: string;
  };
  assert(envelope.status === "truncated");
  assert(envelope.status === "truncated");
  assert(envelope.reference === null);
  assert(envelope.hasMore);
  assert(envelope.preview.length > 0);
});

Deno.test("read_file accepts a line range and reports remaining lines", async () => {
  const workspace = await Deno.makeTempDir({
    dir: "/private/tmp",
    prefix: "tool-result-file-range-",
  });
  await mkdir(workspace, { recursive: true });
  await Deno.writeTextFile(join(workspace, "app.log"), "one\ntwo\nthree\nfour\n");
  const registry = new ToolRegistry();
  coreTools.register({ tools: registry, prompts: { register() {} }, run: async () => "" });
  const output = await registry.get("read_file")!.handler({
    path: "app.log",
    start_line: 3,
    line_count: 1,
  }, {
    workspace,
    sessionId: "session-12345678",
    budget: new RuntimeBudget(resolveRunBudget()),
    tokenUsage: new RunTokenUsage(),
  });
  assert(output.includes("lines=3-3 hasMore=true"));
  assert(output.endsWith("three"));
});

Deno.test("large log requests one targeted supplemental read, not a whole-log reread", async () => {
  setAppDataPath(
    await Deno.makeTempDir({ dir: "/private/tmp", prefix: "log-readback-benchmark-" }),
  );
  const longLog = Array.from({ length: 500 }, (_, index) => `build-line-${index + 1}`).join("\n");
  const feature: HarnessFeature = {
    id: "build-log-benchmark",
    register({ tools }) {
      tools.register(
        {
          type: "function",
          function: {
            name: "run_build",
            description: "Run the fixed build log fixture",
            parameters: { type: "object" },
          },
        },
        async () => longLog,
        { risk: "read-only", maxOutput: 1_200 },
      );
    },
  };
  const config: ProviderConfig = {
    id: "log-readback-benchmark",
    name: "Log Readback Benchmark",
    protocol: "openai",
    apiKey: "test-only",
    baseUrl: "https://log.invalid",
    model: "log-benchmark",
    contextWindowTokens: 8_000,
    outputTokenReserve: 400,
    safetyMarginTokens: 200,
    tokenEstimator: "conservative-v1",
  };
  const providerInputs: Message[][] = [];
  const extraReadOutputs: string[] = [];
  let calls = 0;
  const provider: ModelProvider = {
    id: config.id,
    async createChatCompletion(_config, messages) {
      providerInputs.push(structuredClone(messages));
      calls++;
      if (calls === 1) {
        return {
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "build-1",
                type: "function",
                function: { name: "run_build", arguments: "{}" },
              }],
            },
            finish_reason: "tool_calls",
          }],
        };
      }
      if (calls === 2) {
        const archived = JSON.parse(
          String(messages.findLast((item) => item.role === "tool")?.content),
        ) as {
          reference: string;
        };
        return {
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "read-page-1",
                type: "function",
                function: {
                  name: "read_tool_result",
                  arguments: JSON.stringify({
                    reference: archived.reference,
                    start_line: 220,
                    line_count: 3,
                  }),
                },
              }],
            },
            finish_reason: "tool_calls",
          }],
        };
      }
      if (calls === 3) {
        const page = String(messages.findLast((item) => item.role === "tool")?.content);
        extraReadOutputs.push(page);
        return {
          choices: [{
            message: {
              role: "assistant",
              content: "Build issue is at line 220; lines 220–222 were inspected.",
            },
            finish_reason: "stop",
          }],
        };
      }
      throw new Error("Unexpected provider request; repeated full reads are not expected");
    },
  };
  const runtime = new AgentRuntime([feature, toolResults], {
    resolveProviderConfig: async () => config,
    getModelProvider: () => provider,
  });
  const result = await runtime.run({
    query: "Inspect the build log and check the area around line 220",
    workspace: "/workspace/build-log-benchmark",
    sessionId: "build-log-session-123456",
    permissionMode: "full",
  });
  assert(result.includes("line 220"));
  assert(calls === 3, "one build call, one targeted read call, and one final answer are expected");
  assert(extraReadOutputs.length === 1, "only one supplemental page should be fetched");
  const page = JSON.parse(extraReadOutputs[0]) as { content: string };
  assert(page.content.includes("build-line-220"));
  assert(page.content.includes("build-line-222"));
  assert(!page.content.includes("build-line-1\n"), "the supplementary read must remain ranged");
  assert(providerInputs.length === 3);
});
