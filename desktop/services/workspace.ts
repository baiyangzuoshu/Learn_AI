import { getWorkspace } from "../../src/config/settings.ts";
import { isWindows, runCommand } from "../../src/platform.ts";
import { readdir, realpath } from "node:fs/promises";

export type WorkspaceTreeNode = {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink";
  children?: WorkspaceTreeNode[];
  truncated?: boolean;
};

const TREE_MAX_DEPTH = 6;
const TREE_MAX_ENTRIES = 900;
const TREE_IGNORED_NAMES = new Set([
  ".git",
  ".DS_Store",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

export function joinWorkspacePath(base: string, name: string): string {
  return base.endsWith("/") || base.endsWith("\\") ? `${base}${name}` : `${base}/${name}`;
}

function childRelativePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export async function readWorkspaceTree(): Promise<{
  workspace: string;
  rootName: string;
  entries: WorkspaceTreeNode[];
  truncated: boolean;
  limit: number;
}> {
  const workspace = await realpath(await getWorkspace());
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
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = (await readdir(absolutePath, { withFileTypes: true })).filter((entry) =>
        !TREE_IGNORED_NAMES.has(entry.name)
      );
    } catch {
      return [];
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
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
        type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
      };
      if (entry.isDirectory()) {
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

export async function openWorkspaceFile(path: string): Promise<void> {
  const workspace = await getWorkspace();
  const root = await realpath(workspace);
  const target = await realpath(
    path.startsWith("/") || (isWindows && /^[A-Za-z]:[\\/]/.test(path))
      ? path
      : joinWorkspacePath(root, path),
  );
  if (target !== root && !target.startsWith(`${root}/`) && !target.startsWith(`${root}\\`)) {
    throw new Error("文件不在当前工作目录中");
  }
  const command = process.platform === "darwin" ? "open" : isWindows ? "explorer.exe" : "xdg-open";
  const result = await runCommand(command, [target]);
  if (!result.success) throw new Error(result.stderr || "无法打开文件");
}
