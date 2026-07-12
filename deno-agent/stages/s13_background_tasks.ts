import { type AgentEvent, agentLoop as graphAgentLoop } from "./s12_persistent_task_graph.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

type JobStatus = "running" | "completed" | "failed" | "cancelled" | "timed_out";
export interface BackgroundJob {
  id: string;
  command: string;
  workspace: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  output: string;
  process: Deno.ChildProcess;
  timeout?: ReturnType<typeof setTimeout>;
}
const jobs = new Map<string, BackgroundJob>();
const MAX_RUNNING = 4, OUTPUT_LIMIT = 50_000;

function jobView(job: BackgroundJob) {
  return {
    id: job.id,
    command: job.command,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    output: job.output,
  };
}
export async function startBackgroundJob(command: string, workspace: string, maxSeconds: number) {
  if ([...jobs.values()].filter((job) => job.status === "running").length >= MAX_RUNNING) {
    throw new Error(`at most ${MAX_RUNNING} background tasks may run`);
  }
  const process = new Deno.Command("/bin/sh", {
    args: ["-c", command],
    cwd: workspace,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const job: BackgroundJob = {
    id: `bg-${crypto.randomUUID().slice(0, 8)}`,
    command,
    workspace,
    status: "running",
    startedAt: new Date().toISOString(),
    output: "",
    process,
  };
  jobs.set(job.id, job);
  job.timeout = setTimeout(() => {
    if (job.status !== "running") return;
    job.status = "timed_out";
    job.finishedAt = new Date().toISOString();
    try {
      process.kill("SIGTERM");
    } catch { /* already exited */ }
  }, maxSeconds * 1_000);
  process.output().then((result) => {
    clearTimeout(job.timeout);
    const decoder = new TextDecoder();
    job.output = (decoder.decode(result.stdout) + decoder.decode(result.stderr)).slice(
      0,
      OUTPUT_LIMIT,
    );
    job.exitCode = result.code;
    if (job.status === "running") job.status = result.success ? "completed" : "failed";
    job.finishedAt ??= new Date().toISOString();
  }).catch((error) => {
    clearTimeout(job.timeout);
    job.output = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (job.status === "running") job.status = "failed";
    job.finishedAt ??= new Date().toISOString();
  });
  return job;
}

const startDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "background_start",
    description: "Start a long-running shell command in the workspace without blocking the agent",
    parameters: {
      type: "object",
      properties: { command: { type: "string" }, max_seconds: { type: "number" } },
      required: ["command"],
    },
  },
};
const statusDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "background_status",
    description: "Get one background task or list all tasks for this workspace",
    parameters: { type: "object", properties: { id: { type: "string" } } },
  },
};
const cancelDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "background_cancel",
    description: "Cancel a running background task",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
};
registerTool(startDefinition, async (input, workspace) => {
  const command = String(input.command ?? "").trim();
  if (!command) throw new Error("command is required");
  const requested = Number(input.max_seconds ?? 300);
  if (!Number.isFinite(requested)) throw new Error("max_seconds must be a number");
  const maxSeconds = Math.min(3_600, Math.max(1, Math.floor(requested)));
  return JSON.stringify({
    ...jobView(await startBackgroundJob(command, workspace, maxSeconds)),
    maxSeconds,
  });
});
registerTool(statusDefinition, async (input, workspace) => {
  const id = String(input.id ?? "").trim();
  if (id) {
    const job = jobs.get(id);
    if (!job || job.workspace !== workspace) throw new Error(`background task not found: ${id}`);
    return JSON.stringify(jobView(job));
  }
  return JSON.stringify(
    [...jobs.values()].filter((job) => job.workspace === workspace).map(jobView),
  );
});
registerTool(cancelDefinition, async (input, workspace) => {
  const id = String(input.id ?? "").trim(), job = jobs.get(id);
  if (!job || job.workspace !== workspace) throw new Error(`background task not found: ${id}`);
  if (job.status === "running") {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    clearTimeout(job.timeout);
    try {
      job.process.kill("SIGTERM");
    } catch { /* already exited */ }
  }
  return JSON.stringify(jobView(job));
});
registerSystemPromptSection({
  id: "s13-background",
  title: "Background tasks",
  priority: 46,
  content:
    "Use background_start only for genuinely long-running commands that can safely continue while you do other work. Keep the returned job ID, inspect it with background_status, and cancel it when no longer needed. Never start duplicate jobs blindly. Jobs are scoped to the workspace and current application lifetime.",
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
    name: "BackgroundTasksReady",
    detail: `${jobs.size} known · ${
      [...jobs.values()].filter((job) => job.status === "running").length
    }/${MAX_RUNNING} running`,
  });
  return await graphAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name.startsWith("background_")) {
        onHook({
          name: "BackgroundTaskEvent",
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
  const query = prompt("s13 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
