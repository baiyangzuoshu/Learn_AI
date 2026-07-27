import { getWorkspace } from "../../src/config/settings.ts";

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
  ".deno",
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
        if (!TREE_IGNORED_NAMES.has(entry.name)) entries.push(entry);
      }
    } catch {
      return [];
    }
    entries.sort((a, b) => {
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

export async function openWorkspaceFile(path: string): Promise<void> {
  const workspace = await getWorkspace();
  const root = await Deno.realPath(workspace);
  const target = await Deno.realPath(path.startsWith("/") ? path : joinWorkspacePath(root, path));
  if (target !== root && !target.startsWith(`${root}/`)) {
    throw new Error("文件不在当前工作目录中");
  }
  if (Deno.build.os !== "darwin") {
    throw new Error("当前文件打开功能仅支持 macOS");
  }
  await new Deno.Command("/usr/bin/open", { args: [target] }).output();
}
