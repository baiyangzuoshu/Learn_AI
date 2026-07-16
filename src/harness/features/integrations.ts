import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../../core/types.ts";
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
  process: Deno.ChildProcess;
}
const jobs = new Map<string, Job>(),
  worktrees = new Map<string, { id: string; root: string; path: string; branch: string }>();
async function git(cwd: string, args: string[]) {
  const result = await new Deno.Command(Deno.build.os === "windows" ? "git.exe" : "git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  if (!result.success) throw new Error(text);
  return text.trim();
}
async function mcpRpc(url: string, method: string, params: unknown) {
  const parsed = new URL(url), local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("MCP requires HTTPS or local HTTP");
  }
  const response = await fetch(parsed, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
  const text = await response.text(),
    data = response.headers.get("content-type")?.includes("text/event-stream")
      ? text.split("\n").find((line) => line.startsWith("data:"))?.slice(5)
      : text;
  const payload = JSON.parse(data || "{}");
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}
async function mcpServers(workspace: string) {
  for (const path of [`${workspace}/.deno-agent/mcp.json`, `${workspace}/mcp.json`]) {
    try {
      return (JSON.parse(await Deno.readTextFile(path)).servers ?? []) as any[];
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return [];
}

export const integrations: HarnessFeature = {
  id: "integrations",
  register({ tools, prompts, run }) {
    tools.register(
      def("background_start", "Start a supervised background command", {
        command: { type: "string" },
      }, ["command"]),
      async (input, context) => {
        if ([...jobs.values()].filter((job) => job.status === "running").length >= 4) {
          throw new Error("at most 4 background tasks may run");
        }
        const command = String(input.command),
          shell = Deno.build.os === "windows" ? "cmd.exe" : "/bin/sh",
          process = new Deno.Command(shell, {
            args: Deno.build.os === "windows" ? ["/d", "/s", "/c", command] : ["-c", command],
            cwd: context.workspace,
            stdout: "piped",
            stderr: "piped",
          }).spawn(),
          job = {
            id: `bg-${crypto.randomUUID().slice(0, 8)}`,
            workspace: context.workspace,
            command,
            status: "running",
            output: "",
            process,
          };
        jobs.set(job.id, job);
        process.output().then((result) => {
          job.output =
            (new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr))
              .slice(0, 50_000);
          job.status = result.success ? "completed" : "failed";
        });
        return JSON.stringify({ id: job.id, status: job.status, command });
      },
    );
    tools.register(
      def("background_status", "Get background task status", { id: { type: "string" } }),
      async (input, context) =>
        JSON.stringify(
          [...jobs.values()].filter((job) =>
            job.workspace === context.workspace && (!input.id || job.id === input.id)
          ).map(({ process: _, ...job }) => job),
        ),
    );
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
    tools.register(
      def("worktree_create", "Create an isolated Git worktree", { id: { type: "string" } }, ["id"]),
      async (input, context) => {
        const id = String(input.id),
          root = await git(context.workspace, ["rev-parse", "--show-toplevel"]),
          path = `${root}/.deno-agent-worktrees/${id}`,
          branch = `deno-agent/${id}`;
        await Deno.mkdir(`${root}/.deno-agent-worktrees`, { recursive: true });
        await git(root, ["worktree", "add", "-b", branch, path, "HEAD"]);
        const record = { id, root, path, branch };
        worktrees.set(id, record);
        return JSON.stringify(record);
      },
    );
    tools.register(
      def("worktree_list", "List managed Git worktrees", {}),
      async () => JSON.stringify([...worktrees.values()]),
    );
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
        });
      },
    );
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
    tools.register(
      def("mcp_servers", "List workspace MCP servers", {}),
      async (_input, context) => JSON.stringify(await mcpServers(context.workspace)),
    );
    tools.register(
      def("mcp_list_tools", "List tools from an MCP server", { server: { type: "string" } }, [
        "server",
      ]),
      async (input, context) => {
        const server = (await mcpServers(context.workspace)).find((item) =>
          item.name === input.server && item.enabled !== false
        );
        if (!server) throw new Error("MCP server not found");
        return JSON.stringify(await mcpRpc(server.url, "tools/list", {}));
      },
    );
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
          await mcpRpc(server.url, "tools/call", { name: input.tool, arguments: input.arguments }),
        );
      },
    );
    prompts.register({
      id: "integrations",
      title: "Background, isolation, and plugins",
      priority: 40,
      content:
        "Use background tasks for long commands, worktrees for isolated changes, and MCP only after discovering the relevant server and tool. Never bypass permissions or remove dirty worktrees.",
    });
  },
};
