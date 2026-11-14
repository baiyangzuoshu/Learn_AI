import { join } from "node:path";
import { readdir, rm, stat } from "node:fs/promises";
import { appDataDir } from "./config/paths.ts";
import { isNotFound, readUtf8, writeTextAtomic } from "./platform.ts";

export const MAX_TOOL_RESULT_ARCHIVE_BYTES = 2 * 1024 * 1024;
export const MAX_TOOL_RESULT_SESSION_BYTES = 10 * 1024 * 1024;
export const MAX_TOOL_RESULT_WORKSPACE_BYTES = 100 * 1024 * 1024;
export const MAX_TOOL_RESULT_ARCHIVES_PER_SESSION = 100;
export const TOOL_RESULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
export const TOOL_RESULT_PREVIEW_CHARS = 1_200;
export const TOOL_RESULT_PAGE_CHARS = 20_000;

export interface ToolResultArchive {
  stored: boolean;
  reference: string | null;
  sizeChars: number;
  sizeBytes: number;
  preview: string;
  hasMore: boolean;
  error?: string;
}

interface ArchiveFile {
  id: string;
  path: string;
  size: number;
  modifiedAt: number;
}

const locks = new Map<string, Promise<void>>();

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function resultDirectories(
  workspace: string,
  sessionId: string,
): Promise<{ workspace: string; session: string }> {
  if (!workspace.trim()) throw new Error("workspace is required for tool result storage");
  if (!sessionId.trim() || sessionId.length > 200) {
    throw new Error("session id is invalid for tool result storage");
  }
  const workspaceDirectory = join(
    appDataDir(),
    "tool-results",
    await digest(workspace),
  );
  return {
    workspace: workspaceDirectory,
    session: join(workspaceDirectory, await digest(sessionId)),
  };
}

async function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => release = resolve);
  const tail = previous.then(() => current);
  locks.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}

async function listArchives(directory: string): Promise<ArchiveFile[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  const files: ArchiveFile[] = [];
  for (const name of names) {
    if (!/^[0-9a-f-]{36}\.txt$/i.test(name)) continue;
    const path = join(directory, name);
    try {
      const info = await stat(path);
      if (info.isFile()) {
        files.push({
          id: name.slice(0, -4),
          path,
          size: info.size,
          modifiedAt: info.mtimeMs,
        });
      }
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return files;
}

async function cleanupSessionForWrite(directory: string, incomingBytes: number): Promise<void> {
  if (incomingBytes > MAX_TOOL_RESULT_SESSION_BYTES) {
    throw new Error("result exceeds the per-session storage limit");
  }
  const now = Date.now();
  let files = await listArchives(directory);
  for (const file of files) {
    if (now - file.modifiedAt > TOOL_RESULT_RETENTION_MS) {
      await rm(file.path, { force: true });
    }
  }
  files = (await listArchives(directory)).sort((a, b) => a.modifiedAt - b.modifiedAt);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  while (
    files.length >= MAX_TOOL_RESULT_ARCHIVES_PER_SESSION ||
    totalBytes + incomingBytes > MAX_TOOL_RESULT_SESSION_BYTES
  ) {
    const oldest = files.shift();
    if (!oldest) break;
    await rm(oldest.path, { force: true });
    totalBytes -= oldest.size;
  }
  if (
    files.length >= MAX_TOOL_RESULT_ARCHIVES_PER_SESSION ||
    totalBytes + incomingBytes > MAX_TOOL_RESULT_SESSION_BYTES
  ) throw new Error("session archive capacity is full");
}

async function workspaceArchives(directory: string): Promise<ArchiveFile[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  const archives: ArchiveFile[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && /^[0-9a-f]{64}$/i.test(entry.name)) {
      archives.push(...await listArchives(join(directory, entry.name)));
    }
  }
  return archives;
}

async function cleanupWorkspaceForWrite(directory: string, incomingBytes: number): Promise<void> {
  const now = Date.now();
  let files = await workspaceArchives(directory);
  for (const file of files) {
    if (now - file.modifiedAt > TOOL_RESULT_RETENTION_MS) {
      await rm(file.path, { force: true });
    }
  }
  files = (await workspaceArchives(directory)).sort((a, b) => a.modifiedAt - b.modifiedAt);
  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  while (totalBytes + incomingBytes > MAX_TOOL_RESULT_WORKSPACE_BYTES) {
    const oldest = files.shift();
    if (!oldest) break;
    await rm(oldest.path, { force: true });
    totalBytes -= oldest.size;
  }
  if (totalBytes + incomingBytes > MAX_TOOL_RESULT_WORKSPACE_BYTES) {
    throw new Error("workspace archive capacity is full");
  }
}

export async function archiveToolResult(
  workspace: string,
  sessionId: string,
  content: string,
): Promise<ToolResultArchive> {
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const fallback: ToolResultArchive = {
    stored: false,
    reference: null,
    sizeChars: content.length,
    sizeBytes,
    preview: content.slice(0, TOOL_RESULT_PREVIEW_CHARS),
    hasMore: content.length > TOOL_RESULT_PREVIEW_CHARS,
  };
  if (sizeBytes > MAX_TOOL_RESULT_ARCHIVE_BYTES) {
    return {
      ...fallback,
      error: `result exceeds ${MAX_TOOL_RESULT_ARCHIVE_BYTES} byte archive limit`,
    };
  }
  try {
    const directories = await resultDirectories(workspace, sessionId);
    const id = crypto.randomUUID();
    await withLock(directories.workspace, async () => {
      await cleanupSessionForWrite(directories.session, sizeBytes);
      await cleanupWorkspaceForWrite(directories.workspace, sizeBytes);
      await writeTextAtomic(join(directories.session, `${id}.txt`), content);
    });
    return { ...fallback, stored: true, reference: id };
  } catch (error) {
    return {
      ...fallback,
      error: error instanceof Error ? error.message.slice(0, 160) : "storage failed",
    };
  }
}

export async function readArchivedToolResult(
  workspace: string,
  sessionId: string,
  reference: string,
): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(reference)) throw new Error("tool result reference is invalid");
  const directories = await resultDirectories(workspace, sessionId);
  const path = join(directories.session, `${reference}.txt`);
  try {
    const info = await stat(path);
    if (Date.now() - info.mtimeMs > TOOL_RESULT_RETENTION_MS) {
      await rm(path, { force: true });
      throw new Error("tool result reference has expired");
    }
    if (!info.isFile() || info.size > MAX_TOOL_RESULT_ARCHIVE_BYTES) {
      throw new Error("tool result reference is unavailable");
    }
    return await readUtf8(path);
  } catch (error) {
    if (isNotFound(error)) {
      throw new Error("tool result reference is unavailable in this workspace and session");
    }
    throw error;
  }
}

export function paginateToolResult(
  content: string,
  options: {
    startLine?: number;
    lineCount?: number;
    startChar?: number;
    charCount?: number;
  },
) {
  const totalChars = content.length;
  if (options.startChar !== undefined) {
    const startChar = Math.min(totalChars, Math.max(0, Math.floor(options.startChar)));
    const charCount = Math.min(
      TOOL_RESULT_PAGE_CHARS,
      Math.max(1, Math.floor(options.charCount ?? TOOL_RESULT_PAGE_CHARS)),
    );
    const endChar = Math.min(totalChars, startChar + charCount);
    return {
      startChar,
      endChar,
      totalChars,
      content: content.slice(startChar, endChar),
      hasMore: endChar < totalChars,
      nextStartChar: endChar < totalChars ? endChar : undefined,
    };
  }

  const startLine = Math.max(1, Math.floor(options.startLine ?? 1));
  const lineCount = Math.min(200, Math.max(1, Math.floor(options.lineCount ?? 100)));
  const lines = content.split("\n");
  const selected = lines.slice(startLine - 1, startLine - 1 + lineCount);
  let page = selected.join("\n");
  const lineStartChar = lines.slice(0, startLine - 1).reduce(
    (sum, line) => sum + line.length + 1,
    0,
  );
  let clipped = false;
  if (page.length > TOOL_RESULT_PAGE_CHARS) {
    page = page.slice(0, TOOL_RESULT_PAGE_CHARS);
    clipped = true;
  }
  const startChar = Math.min(totalChars, lineStartChar);
  const endChar = Math.min(totalChars, startChar + page.length);
  const lastLine = Math.min(lines.length, startLine + selected.length - 1);
  const hasMore = clipped || lastLine < lines.length;
  return {
    startLine,
    endLine: lastLine,
    totalLines: lines.length,
    startChar,
    endChar,
    totalChars,
    content: page,
    hasMore,
    nextStartChar: clipped ? endChar : undefined,
    nextStartLine: !clipped && hasMore ? lastLine + 1 : undefined,
  };
}

export function formatToolResultArchive(archive: ToolResultArchive, maxOutput: number): string {
  const base = {
    status: archive.stored ? "complete" : "truncated",
    sizeChars: archive.sizeChars,
    preview: "",
    reference: archive.reference,
    hasMore: archive.hasMore,
    ...(archive.error && maxOutput >= 256 ? { archiveError: archive.error } : {}),
  };
  let preview = archive.preview;
  let result = JSON.stringify({ ...base, preview });
  while (preview.length && result.length > maxOutput) {
    preview = preview.slice(
      0,
      Math.max(0, preview.length - Math.max(32, result.length - maxOutput)),
    );
    result = JSON.stringify({ ...base, preview });
  }
  return result;
}
