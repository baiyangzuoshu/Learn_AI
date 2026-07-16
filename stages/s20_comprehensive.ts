import { type AgentEvent, agentLoop as mcpAgentLoop } from "./s19_mcp_plugins.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool, systemPromptSnapshot } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import { getPublicSettings } from "../src/config/settings.ts";

const capabilities = [
  "Agent Loop",
  "Tool Use",
  "Permission Approval",
  "Hooks",
  "Todo",
  "Subagent",
  "Skill Loading",
  "Context Compact",
  "Memory",
  "System Prompt",
  "Error Recovery",
  "Persistent Task Graph",
  "Background Tasks",
  "Cron Scheduling",
  "Agent Teams",
  "Team Protocol",
  "Autonomous Agent",
  "Git Worktree",
  "MCP Plugins",
  "Desktop Harness",
];
const statusDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "harness_status",
    description: "Return the complete Deno Agent harness capability manifest",
    parameters: { type: "object", properties: {} },
  },
};
const checkDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "harness_self_check",
    description:
      "Run a read-only self-check of workspace, settings, persistence, and prompt assembly",
    parameters: { type: "object", properties: {} },
  },
};
registerTool(statusDefinition, async (_input, workspace) =>
  JSON.stringify({
    stage: "s20",
    version: "1.0.0",
    runtime: Deno.version.deno,
    platform: `${Deno.build.os}-${Deno.build.arch}`,
    workspace,
    capabilities: capabilities.map((name, index) => ({
      stage: `s${String(index + 1).padStart(2, "0")}`,
      name,
    })),
  }));
registerTool(checkDefinition, async (_input, workspace) => {
  const settings = await getPublicSettings(),
    checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  try {
    checks.push({
      name: "workspace",
      ok: (await Deno.stat(workspace)).isDirectory,
      detail: workspace,
    });
  } catch (error) {
    checks.push({
      name: "workspace",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  checks.push({
    name: "api-key",
    ok: settings.hasApiKey,
    detail: settings.hasApiKey ? "configured in environment or Keychain" : "missing",
  });
  checks.push({
    name: "models",
    ok: settings.models.length > 0 && settings.models.includes(settings.defaultModel),
    detail: `${settings.models.length} configured · default ${settings.defaultModel}`,
  });
  const prompt = systemPromptSnapshot(workspace);
  checks.push({
    name: "system-prompt",
    ok: prompt.sections.length >= 10,
    detail: `${prompt.sections.length} sections · ${prompt.prompt.length} chars`,
  });
  const home = Deno.env.get("HOME");
  if (home) {
    const path = `${home}/Library/Application Support/DenoAgent`;
    try {
      checks.push({ name: "persistence", ok: (await Deno.stat(path)).isDirectory, detail: path });
    } catch {
      checks.push({
        name: "persistence",
        ok: false,
        detail: "application data directory not created",
      });
    }
  }
  return JSON.stringify({ ok: checks.every((check) => check.ok), checks });
});
registerSystemPromptSection({
  id: "s20-comprehensive",
  title: "Complete harness contract",
  priority: 1,
  content:
    "You are the complete Deno Agent desktop coding harness. Select the smallest sufficient capability for each task, keep actions observable, respect workspace and permission boundaries, verify outcomes, preserve durable state intentionally, and never claim success when a required check fails. Prefer direct tools before delegation, teams, autonomy, worktrees, or MCP; escalate capability only when complexity justifies it.",
});

export { type AgentEvent };
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",
  signal?: AbortSignal,
  onHook: (event: { name: string; detail: string }) => void = () => {},
): Promise<string> {
  onHook({
    name: "ComprehensiveHarnessReady",
    detail: "s01–s20 · 20 capabilities · Desktop Harness 1.0.0",
  });
  return await mcpAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name.startsWith("harness_")) {
        onHook({
          name: "HarnessCheck",
          detail: `${event.name} · ${event.output.length} chars`,
        });
      }
    },
    model,
    history,
    permissionMode,
    signal,
    onHook,
  );
}
if (import.meta.main) {
  const query = prompt("s20 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
