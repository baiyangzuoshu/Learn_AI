import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { isNotFound, isWindows, runCommand, spawnCommand } from "../platform.ts";
import { mkdir, readFile } from "node:fs/promises";
import type { ChildProcess } from "node:child_process";
import { type McpServerConfig, mcpSessionManager } from "../mcp.ts";

const def = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

interface Job {
  id: string;
  workspace: string;
  command: string;
  status: string;
  output: string;
  process: ChildProcess;
}
//
const jobs = new Map<string, Job>(),
  worktrees = new Map<string, { id: string; root: string; path: string; branch: string }>();
//
async function git(cwd: string, args: string[]) {
  const result = await runCommand(isWindows ? "git.exe" : "git", args, { cwd });
  const text = result.stdout + result.stderr;
  if (!result.success) throw new Error(text);
  return text.trim();
}
//
function asMcpServer(value: unknown): McpServerConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name || name.length > 120) return undefined;
  const transport =
    item.transport === "sse" || item.transport === "stdio" || item.transport === "http"
      ? item.transport
      : undefined;
  const args = Array.isArray(item.args)
    ? item.args.filter((arg): arg is string => typeof arg === "string").slice(0, 32)
    : undefined;
  const env = item.env && typeof item.env === "object"
    ? Object.fromEntries(
      Object.entries(item.env).filter(([key, value]) =>
        /^[A-Za-z_][A-Za-z0-9_]{0,80}$/.test(key) && typeof value === "string"
      ).slice(0, 64),
    )
    : undefined;
  return {
    name,
    enabled: item.enabled !== false,
    transport,
    url: typeof item.url === "string" ? item.url : undefined,
    command: typeof item.command === "string" ? item.command : undefined,
    args,
    env,
  };
}

async function mcpServers(workspace: string): Promise<McpServerConfig[]> {
  for (const path of [`${workspace}/.ai-agent/mcp.json`, `${workspace}/mcp.json`]) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as { servers?: unknown };
      return Array.isArray(parsed.servers)
        ? parsed.servers.map(asMcpServer).filter((item): item is McpServerConfig => Boolean(item))
        : [];
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return [];
}

function publicMcpServer(server: McpServerConfig): Record<string, unknown> {
  return {
    name: server.name,
    enabled: server.enabled !== false,
    transport: server.transport ?? (server.command ? "stdio" : "http"),
    url: server.url,
    command: server.command,
    args: server.args,
  };
}
//
export const integrations: HarnessFeature = {
  id: "integrations",

  register({ tools, prompts, run }) {
    //background_start
    tools.register(
      def("background_start", "Start a supervised background command", {
        command: { type: "string" },
      }, ["command"]),
      async (input, context) => {
        if ([...jobs.values()].filter((job) => job.status === "running").length >= 4) {
          throw new Error("at most 4 background tasks may run");
        }

        const command = String(input.command),
          shell = isWindows ? "cmd.exe" : "/bin/sh",
          process = spawnCommand(shell, isWindows ? ["/d", "/s", "/c", command] : ["-c", command], {
            cwd: context.workspace,
          }),
          job = {
            id: `bg-${crypto.randomUUID().slice(0, 8)}`,
            workspace: context.workspace,
            command,
            status: "running",
            output: "",
            process,
          };
        jobs.set(job.id, job);
        const output: Buffer[] = [], errors: Buffer[] = [];
        process.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
        process.stderr?.on("data", (chunk: Buffer) => errors.push(chunk));
        process.once("close", (code) => {
          job.output = Buffer.concat([...output, ...errors]).toString("utf8").slice(0, 50_000);
          job.status = code === 0 ? "completed" : "failed";
        });
        return JSON.stringify({ id: job.id, status: job.status, command });
      },
    );
    //background_status
    tools.register(
      def("background_status", "Get background task status", { id: { type: "string" } }),
      async (input, context) =>
        JSON.stringify(
          [...jobs.values()].filter((job) =>
            job.workspace === context.workspace && (!input.id || job.id === input.id)
          ).map(({ process: _, ...job }) => job),
        ),
    );
    //background_cancel
    tools.register(
      def("background_cancel", "Cancel a background task", { id: { type: "string" } }, ["id"]),
      async (input) => {
        const job = jobs.get(String(input.id));
        if (!job) throw new Error("background task not found");
        if (job.status === "running") {
          job.process.kill("SIGTERM");
          job.status = "cancelled";
        }
        return JSON.stringify({ id: job.id, status: job.status });
      },
    );
    //worktree_create
    tools.register(
      def("worktree_create", "Create an isolated Git worktree", { id: { type: "string" } }, ["id"]),
      async (input, context) => {
        const id = String(input.id),
          root = await git(context.workspace, ["rev-parse", "--show-toplevel"]),
          path = `${root}/.ai-agent-worktrees/${id}`,
          branch = `ai-agent/${id}`;
        await mkdir(`${root}/.ai-agent-worktrees`, { recursive: true });
        await git(root, ["worktree", "add", "-b", branch, path, "HEAD"]);
        const record = { id, root, path, branch };
        worktrees.set(id, record);
        return JSON.stringify(record);
      },
    );
    //worktree_list
    tools.register(
      def("worktree_list", "List managed Git worktrees", {}),
      async () => JSON.stringify([...worktrees.values()]),
    );
    //worktree_agent
    tools.register(
      def("worktree_agent", "Run a task inside an isolated worktree", {
        id: { type: "string" },
        task: { type: "string" },
      }, ["id", "task"]),
      async (input, context) => {
        const item = worktrees.get(String(input.id));
        if (!item) throw new Error("worktree not found");
        return await run({
          query: String(input.task),
          workspace: item.path,
          permissionMode: "ask",
          signal: context.signal,
          budget: context.budget.child({
            iterations: 16,
            toolCalls: 32,
            outputChars: 100_000,
            cost: 16,
          }),
        });
      },
    );
    //worktree_remove
    tools.register(
      def("worktree_remove", "Remove a clean worktree", { id: { type: "string" } }, ["id"]),
      async (input) => {
        const item = worktrees.get(String(input.id));
        if (!item) {
          throw new Error("worktree not found");
        }
        if (await git(item.path, ["status", "--porcelain"])) {
          throw new Error("worktree has uncommitted changes");
        }
        await git(item.root, ["worktree", "remove", item.path]);
        worktrees.delete(item.id);
        return "Worktree removed";
      },
    );
    //mcp_servers
    tools.register(
      def("mcp_servers", "List workspace MCP servers", {}),
      async (_input, context) =>
        JSON.stringify((await mcpServers(context.workspace)).map(publicMcpServer)),
    );
    //mcp_list_tools
    tools.register(
      def("mcp_list_tools", "List tools from an MCP server", { server: { type: "string" } }, [
        "server",
      ]),
      async (input, context) => {
        const server = (await mcpServers(context.workspace)).find((item) =>
          item.name === input.server && item.enabled !== false
        );
        if (!server) throw new Error("MCP server not found");
        return JSON.stringify(
          await mcpSessionManager.call(context.workspace, server, "tools/list", {}, context.signal),
        );
      },
    );
    //mcp_call
    tools.register(
      def("mcp_call", "Call an MCP tool", {
        server: { type: "string" },
        tool: { type: "string" },
        arguments: { type: "object" },
      }, ["server", "tool", "arguments"]),
      async (input, context) => {
        const server = (await mcpServers(context.workspace)).find((item) =>
          item.name === input.server && item.enabled !== false
        );
        if (!server) throw new Error("MCP server not found");
        return JSON.stringify(
          await mcpSessionManager.call(
            context.workspace,
            server,
            "tools/call",
            { name: input.tool, arguments: input.arguments },
            context.signal,
          ),
        );
      },
    );
    tools.register(
      def("mcp_status", "Read negotiated MCP sessions for the current workspace", {
        server: { type: "string" },
      }),
      async (input, context) =>
        JSON.stringify(
          mcpSessionManager.status(
            context.workspace,
            typeof input.server === "string" ? input.server : undefined,
          ),
        ),
    );
    //integrations
    prompts.register({
      id: "integrations",
      title: "Background, isolation, and plugins",
      priority: 40,
      content:
        "Use background tasks for long commands, worktrees for isolated changes, and MCP only after discovering the relevant server and tool. MCP calls reuse an initialized, negotiated Session over a bounded HTTP, SSE, or STDIO Transport; preserve AbortSignal cancellation, HTTPS/local-host policy, bounded output, and clean shutdown. Never bypass permissions or remove dirty worktrees.",
    });
  },
};
