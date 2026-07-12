import { type AgentEvent, agentLoop as subagentLoop } from "./s06_subagent.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerTool, setSystemGuidance } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import { getWorkspace } from "../src/config/settings.ts";

const roots = (
  workspace: string,
) => [`${workspace}/skills`, `${workspace}/.agents/skills`, `${workspace}/.codex/skills`];
async function skillFiles(workspace: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const root of roots(workspace)) {
    try {
      for await (const entry of Deno.readDir(root)) {
        if (!entry.isDirectory || !/^[A-Za-z0-9._-]+$/.test(entry.name)) continue;
        const path = `${root}/${entry.name}/SKILL.md`;
        try {
          if ((await Deno.stat(path)).isFile) found.set(entry.name, path);
        } catch { /* no SKILL.md */ }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return found;
}

const listDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "list_skills",
    description:
      "List the skills available in the current workspace without loading their full instructions",
    parameters: { type: "object", properties: {} },
  },
};
const loadDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "load_skill",
    description: "Load one skill's SKILL.md instructions on demand",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
};

registerTool(listDefinition, async () => {
  const files = await skillFiles(await getWorkspace());
  return files.size ? [...files.keys()].sort().join("\n") : "(no workspace skills found)";
});
registerTool(loadDefinition, async (input) => {
  const name = String(input.name ?? "");
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("invalid skill name");
  const path = (await skillFiles(await getWorkspace())).get(name);
  if (!path) throw new Error(`skill not found: ${name}`);
  return (await Deno.readTextFile(path)).slice(0, 50_000);
});
setSystemGuidance(
  "Skills are workspace-specific instructions. Use list_skills to discover them, then load_skill only when a relevant skill is needed. Never load every skill preemptively; follow loaded instructions for the current task.",
);

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
  return await subagentLoop(query, onEvent, model, history, permissionMode, signal, onHook);
}
if (import.meta.main) {
  const query = prompt("s07 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
