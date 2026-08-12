import { getWorkspace } from "../../src/config/settings.ts";
import { joinWorkspacePath } from "./workspace.ts";
import { isWindows, runCommand } from "../../src/platform.ts";
import { readFile, realpath, stat } from "node:fs/promises";

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
  const command = isWindows ? "git" : "/usr/bin/git";
  const result = await runCommand(command, args, { cwd: workspace });
  return {
    success: result.success,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function countSmallTextFileLines(path: string): Promise<number> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > 300_000) return 0;
    const content = await readFile(path, "utf8");
    if (!content || content.includes("\u0000")) return 0;
    return content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
  } catch {
    return 0;
  }
}

async function includeUntrackedFileStats(
  workspace: string,
  changes: GitStatusItem[],
  stats: GitDiffStats,
): Promise<void> {
  for (const item of changes) {
    if (item.kind === "untracked") {
      stats.additions += await countSmallTextFileLines(joinWorkspacePath(workspace, item.path));
    }
  }
}

export async function readWorkspaceGit(): Promise<{
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
  const workspace = await realpath(await getWorkspace());
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
      const add = Number(additions);
      const del = Number(deletions);
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
