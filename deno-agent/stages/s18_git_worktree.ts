import { type AgentEvent, agentLoop as autonomousAgentLoop } from "./s17_autonomous_agent.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import { withWorkspace } from "../src/config/settings.ts";

interface WorktreeRecord {
  id: string;
  root: string;
  path: string;
  branch: string;
  createdAt: string;
}
const records = new Map<string, WorktreeRecord>();

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await new Deno.Command("/usr/bin/git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder(),
    output = decoder.decode(result.stdout) + decoder.decode(result.stderr);
  if (!result.success) throw new Error(output.trim() || `git exited ${result.code}`);
  return output.trim();
}
async function repoRoot(workspace: string) {
  return await git(workspace, ["rev-parse", "--show-toplevel"]);
}
async function worktreeBase(root: string): Promise<string> {
  const home = Deno.env.get("HOME");
  if (!home) throw new Error("HOME is unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(root));
  const id = [...new Uint8Array(digest)].slice(0, 8).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${home}/Library/Application Support/DenoAgent/worktrees/${id}`;
}
async function createWorktree(workspace: string, requestedId: string): Promise<WorktreeRecord> {
  const id = requestedId.trim();
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(id)) throw new Error("worktree id is invalid");
  if (records.has(id)) throw new Error(`worktree already exists: ${id}`);
  const root = await repoRoot(workspace), path = `${await worktreeBase(root)}/${id}`;
  const branch = `deno-agent/${id}`;
  try {
    await Deno.stat(path);
    throw new Error(`worktree path already exists: ${path}`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await git(root, ["worktree", "add", "-b", branch, path, "HEAD"]);
  const record = { id, root, path, branch, createdAt: new Date().toISOString() };
  records.set(id, record);
  return record;
}

const createDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "worktree_create",
    description: "Create an isolated Git worktree and branch from HEAD",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
};
const listDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "worktree_list",
    description: "List worktrees created by this Deno Agent process",
    parameters: { type: "object", properties: {} },
  },
};
const agentDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "worktree_agent",
    description: "Run one focused agent task inside an isolated worktree",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, task: { type: "string" } },
      required: ["id", "task"],
    },
  },
};
const removeDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "worktree_remove",
    description: "Remove a clean isolated worktree; refuses dirty worktrees",
    parameters: {
      type: "object",
      properties: { id: { type: "string" }, delete_branch: { type: "boolean" } },
      required: ["id"],
    },
  },
};
registerTool(
  createDefinition,
  async (input, workspace) =>
    JSON.stringify(await createWorktree(workspace, String(input.id ?? ""))),
);
registerTool(listDefinition, async () => JSON.stringify([...records.values()]));
registerTool(agentDefinition, async (input) => {
  const id = String(input.id ?? ""),
    task = String(input.task ?? "").trim(),
    record = records.get(id);
  if (!record) throw new Error(`worktree not found: ${id}`);
  if (!task) throw new Error("task is required");
  const result = await withWorkspace(
    record.path,
    () =>
      autonomousAgentLoop(
        `You are working in an isolated Git worktree on branch ${record.branch}. Complete only this task, verify it, and report changed files. Do not modify the parent workspace.\n\n${task}`,
        () => {},
        undefined,
        [],
        "ask",
      ),
  );
  return JSON.stringify({
    ...record,
    result,
    status: await git(record.path, ["status", "--short"]),
  });
});
registerTool(removeDefinition, async (input) => {
  const id = String(input.id ?? ""), record = records.get(id);
  if (!record) throw new Error(`worktree not found: ${id}`);
  const status = await git(record.path, ["status", "--porcelain"]);
  if (status) {
    throw new Error(
      "worktree has uncommitted changes; commit or discard them explicitly before removal",
    );
  }
  await git(record.root, ["worktree", "remove", record.path]);
  if (input.delete_branch === true) await git(record.root, ["branch", "-d", record.branch]);
  records.delete(id);
  return JSON.stringify({ id, removed: true, branchDeleted: input.delete_branch === true });
});
registerSystemPromptSection({
  id: "s18-worktree",
  title: "Git worktree isolation",
  priority: 51,
  content:
    "Use worktree_create and worktree_agent for risky or independent code changes that should not touch the user's active checkout. Keep IDs descriptive. Inspect and report the isolated branch and changed files. Never remove a dirty worktree or delete a branch without explicit intent.",
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
    name: "WorktreeIsolationReady",
    detail: `${records.size} managed worktrees · dirty removal refused`,
  });
  return await autonomousAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name.startsWith("worktree_")) {
        onHook({
          name: "WorktreeEvent",
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
  const query = prompt("s18 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
