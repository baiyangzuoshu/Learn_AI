import {
  type AgentEvent,
  agentLoop,
  listCronSchedules,
  type PermissionMode,
  runCronSchedule,
  saveCronSchedules,
} from "../src/harness/mod.ts";
import { providerTelemetry } from "../src/providers/deepseek.ts";
import { readConversations, saveConversations } from "../src/config/conversations.ts";
import {
  chooseWorkspace,
  getPublicSettings,
  getWorkspace,
  removeWorkspace,
  revealApiKey,
  saveSettings,
  selectWorkspace,
} from "../src/config/settings.ts";

const assets = new Map<string, { body: string; contentType: string }>([
  ["/", {
    body: await Deno.readTextFile(new URL("./renderer/index.html", import.meta.url)),
    contentType: "text/html; charset=utf-8",
  }],
  ["/styles.css", {
    body: await Deno.readTextFile(new URL("./renderer/styles.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/settings.css", {
    body: await Deno.readTextFile(new URL("./renderer/settings.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/stream.css", {
    body: await Deno.readTextFile(new URL("./renderer/stream.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/developer.css", {
    body: await Deno.readTextFile(new URL("./renderer/developer.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/todo.css", {
    body: await Deno.readTextFile(new URL("./renderer/todo.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/subagent.css", {
    body: await Deno.readTextFile(new URL("./renderer/subagent.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/skill.css", {
    body: await Deno.readTextFile(new URL("./renderer/skill.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/layout.css", {
    body: await Deno.readTextFile(new URL("./renderer/layout.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/app.js", {
    body: await Deno.readTextFile(new URL("./renderer/app.js", import.meta.url)),
    contentType: "text/javascript; charset=utf-8",
  }],
]);

// Adopt the implicit startup window so closing the native window also stops
// Deno.serve() and the agent runtime. Without this, the HTTP server keeps the
// process alive after macOS requests that the window close.
// @ts-ignore BrowserWindow types are injected only by `deno desktop`.
const mainWindow = new Deno.BrowserWindow({
  title: "Deno Agent",
  width: 1280,
  height: 820,
});
mainWindow.addEventListener("close", () => Deno.exit(0));
listCronSchedules().catch((error) => console.error("Unable to initialize AI schedules", error));

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

type WorkspaceTreeNode = {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink";
  children?: WorkspaceTreeNode[];
  truncated?: boolean;
};
type GitStatusItem = {
  code: string;
  path: string;
  displayPath: string;
  kind: "added" | "modified" | "deleted" | "renamed" | "untracked" | "changed";
};
type GitCommit = {
  hash: string;
  relativeDate: string;
  author: string;
  subject: string;
};
type GitDiffStats = {
  changedFiles: number;
  additions: number;
  deletions: number;
};

const TREE_MAX_DEPTH = 6;
const TREE_MAX_ENTRIES = 900;
const TREE_IGNORED_NAMES = new Set([
  ".git",
  ".deno",
  ".DS_Store",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

function joinWorkspacePath(base: string, name: string): string {
  return base.endsWith("/") || base.endsWith("\\") ? `${base}${name}` : `${base}/${name}`;
}

function childRelativePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

async function readWorkspaceTree(): Promise<{
  workspace: string;
  rootName: string;
  entries: WorkspaceTreeNode[];
  truncated: boolean;
  limit: number;
}> {
  const workspace = await Deno.realPath(await getWorkspace());
  const counter = { count: 0, truncated: false };
  const readDirectory = async (
    absolutePath: string,
    relativePath: string,
    depth: number,
  ): Promise<WorkspaceTreeNode[]> => {
    if (depth >= TREE_MAX_DEPTH || counter.count >= TREE_MAX_ENTRIES) {
      counter.truncated = true;
      return [];
    }
    let entries: Deno.DirEntry[] = [];
    try {
      for await (const entry of Deno.readDir(absolutePath)) {
        if (TREE_IGNORED_NAMES.has(entry.name)) continue;
        entries.push(entry);
      }
    } catch {
      return [];
    }
    entries = entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });
    const nodes: WorkspaceTreeNode[] = [];
    for (const entry of entries) {
      if (counter.count >= TREE_MAX_ENTRIES) {
        counter.truncated = true;
        break;
      }
      counter.count++;
      const path = childRelativePath(relativePath, entry.name);
      const node: WorkspaceTreeNode = {
        name: entry.name,
        path,
        type: entry.isDirectory ? "directory" : entry.isSymlink ? "symlink" : "file",
      };
      if (entry.isDirectory) {
        node.children = await readDirectory(
          joinWorkspacePath(absolutePath, entry.name),
          path,
          depth + 1,
        );
        node.truncated = counter.truncated && depth + 1 >= TREE_MAX_DEPTH;
      }
      nodes.push(node);
    }
    return nodes;
  };
  return {
    workspace,
    rootName: workspace.split(/[\\/]/).filter(Boolean).pop() || workspace,
    entries: await readDirectory(workspace, "", 0),
    truncated: counter.truncated,
    limit: TREE_MAX_ENTRIES,
  };
}

function classifyGitStatus(code: string): GitStatusItem["kind"] {
  if (code.includes("?")) return "untracked";
  if (code.includes("R")) return "renamed";
  if (code.includes("D")) return "deleted";
  if (code.includes("A")) return "added";
  if (code.includes("M")) return "modified";
  return "changed";
}

async function runGit(
  workspace: string,
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const result = await new Deno.Command("/usr/bin/git", {
    args,
    cwd: workspace,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  return {
    success: result.success,
    stdout: decoder.decode(result.stdout).trim(),
    stderr: decoder.decode(result.stderr).trim(),
  };
}

async function countSmallTextFileLines(path: string): Promise<number> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isFile || stat.size > 300_000) return 0;
    const content = await Deno.readTextFile(path);
    if (content.includes("\u0000")) return 0;
    if (!content) return 0;
    return content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
  } catch {
    return 0;
  }
}

async function includeUntrackedFileStats(
  workspace: string,
  changes: GitStatusItem[],
  stats: GitDiffStats,
): Promise<GitDiffStats> {
  for (const item of changes) {
    if (item.kind !== "untracked") continue;
    stats.additions += await countSmallTextFileLines(joinWorkspacePath(workspace, item.path));
  }
  return stats;
}

async function readWorkspaceGit(): Promise<{
  workspace: string;
  isRepo: boolean;
  root?: string;
  branch?: string;
  branchDetail?: string;
  shortHead?: string;
  aheadBehind?: string;
  stats: GitDiffStats;
  changes: GitStatusItem[];
  commits: GitCommit[];
}> {
  const workspace = await Deno.realPath(await getWorkspace());
  const root = await runGit(workspace, ["rev-parse", "--show-toplevel"]);
  if (!root.success) {
    return {
      workspace,
      isRepo: false,
      stats: { changedFiles: 0, additions: 0, deletions: 0 },
      changes: [],
      commits: [],
    };
  }
  const status = await runGit(workspace, ["status", "--short", "--branch", "-uall"]);
  const lines = status.stdout.split("\n").filter(Boolean);
  const branchDetail = lines[0]?.replace(/^##\s*/, "") || "detached";
  const branch = branchDetail.split("...")[0].replace(/\s+\[.*\]$/, "");
  const aheadBehind = branchDetail.match(/\[(.+)\]/)?.[1];
  const changes = lines.slice(1).map((line) => {
    const code = line.slice(0, 2).trim() || "??";
    const displayPath = line.slice(3).trim();
    const path = displayPath.includes(" -> ")
      ? displayPath.split(" -> ").pop() || displayPath
      : displayPath;
    return { code, path, displayPath, kind: classifyGitStatus(code) };
  });
  const numstat = await runGit(workspace, ["diff", "--numstat", "HEAD", "--"]);
  const stats = numstat.stdout.split("\n").filter(Boolean).reduce<GitDiffStats>(
    (summary, line) => {
      const [additions, deletions] = line.split(/\s+/);
      const add = Number(additions), del = Number(deletions);
      summary.additions += Number.isFinite(add) ? add : 0;
      summary.deletions += Number.isFinite(del) ? del : 0;
      return summary;
    },
    { changedFiles: changes.length, additions: 0, deletions: 0 },
  );
  await includeUntrackedFileStats(workspace, changes, stats);
  const head = await runGit(workspace, ["rev-parse", "--short", "HEAD"]);
  const log = await runGit(workspace, [
    "log",
    "-n",
    "8",
    "--pretty=format:%h%x09%cr%x09%an%x09%s",
  ]);
  const commits = log.success
    ? log.stdout.split("\n").filter(Boolean).map((line) => {
      const [hash = "", relativeDate = "", author = "", ...subject] = line.split("\t");
      return { hash, relativeDate, author, subject: subject.join("\t") };
    })
    : [];
  return {
    workspace,
    isRepo: true,
    root: root.stdout,
    branch,
    branchDetail,
    shortHead: head.success ? head.stdout : undefined,
    aheadBehind,
    stats,
    changes,
    commits,
  };
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    return json({ ok: true, stage: "s20", version: "1.0.0", capabilities: 20 });
  }
  if (url.pathname === "/api/telemetry") return json(providerTelemetry());
  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json(await getPublicSettings());
  }
  if (url.pathname === "/api/settings/key" && request.method === "GET") {
    return json({ apiKey: await revealApiKey() });
  }
  if (url.pathname === "/api/conversations" && request.method === "GET") {
    try {
      return json({ sessions: await readConversations() });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }
  if (url.pathname === "/api/conversations" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ sessions: await saveConversations(body.sessions) });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "GET") {
    try {
      return json({ schedules: await listCronSchedules() });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ schedules: await saveCronSchedules(body.schedules) });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/cron/run" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await runCronSchedule(String(body.id ?? "")));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/select" && request.method === "POST") {
    try {
      return json(await chooseWorkspace());
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/activate" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await selectWorkspace(body.workspace));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/remove" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await removeWorkspace(body.workspace));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/tree" && request.method === "GET") {
    try {
      return json(await readWorkspaceTree());
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/git" && request.method === "GET") {
    try {
      return json(await readWorkspaceGit());
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/file/open" && request.method === "POST") {
    try {
      const { path } = await request.json();
      const workspace = await getWorkspace();
      const target = await Deno.realPath(path.startsWith("/") ? path : `${workspace}/${path}`);
      const root = await Deno.realPath(workspace);
      if (target !== root && !target.startsWith(`${root}/`)) {
        throw new Error("文件不在当前工作目录中");
      }
      await new Deno.Command("/usr/bin/open", { args: [target] }).output();
      return json({ ok: true });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "POST") {
    try {
      return json(await saveSettings(await request.json()));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  if (url.pathname === "/api/chat" && request.method === "POST") {
    try {
      const body = await request.json() as {
        message?: string;
        model?: string;
        permissionMode?: PermissionMode;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      const events: AgentEvent[] = [];
      const answer = await agentLoop(
        body.message,
        (event) => events.push(event),
        body.model,
        body.history ?? [],
        body.permissionMode ?? "ask",
      );
      return json({ answer, events });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (url.pathname === "/api/chat/stream" && request.method === "POST") {
    const body = await request.json() as {
      message?: string;
      model?: string;
      permissionMode?: PermissionMode;
      developerMode?: boolean;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    let streamClosed = false;
    return new Response(
      new ReadableStream({
        start(controller) {
          const emit = (data: unknown) => {
            if (streamClosed) return;
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
            } catch {
              streamClosed = true;
              abortController.abort();
            }
          };
          const close = () => {
            if (streamClosed) return;
            streamClosed = true;
            try {
              controller.close();
            } catch { /* consumer already disconnected */ }
          };
          emit({ type: "status", message: "正在分析任务…" });
          agentLoop(
            body.message ?? "",
            (event) => emit({ type: "tool", event }),
            body.model,
            body.history ?? [],
            body.permissionMode ?? "ask",
            abortController.signal,
            (event) => {
              if (body.developerMode) emit({ type: "hook", event });
            },
          )
            .then((answer) => {
              emit({ type: "status", message: "正在组织答案…" });
              emit({ type: "answer", answer });
              emit({ type: "done" });
              close();
            })
            .catch((error) => {
              emit({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
              });
              close();
            });
        },
        cancel() {
          streamClosed = true;
          abortController.abort();
        },
      }),
      {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache",
        },
      },
    );
  }

  const asset = assets.get(url.pathname);
  if (asset) {
    return new Response(asset.body, {
      headers: {
        "content-type": asset.contentType,
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.deepseek.com",
      },
    });
  }
  return new Response("Not found", { status: 404 });
});
