import { isAbsolute, relative, resolve } from "node:path";
import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../core/types.ts";
import { isWindows, runCommand } from "../platform.ts";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
//根据模型提供相对路径，防止工具越权读取工作区外的文件
function safePath(workspace: string, requested: string) {
  const root = resolve(workspace), path = resolve(root, requested), rel = relative(root, path);
  if (
    rel === ".." || rel.startsWith(`..${isWindows ? "\\" : "/"}`) ||
    isAbsolute(rel)
  ) throw new Error(`Path escapes workspace: ${requested}`);
  return path;
}
const definition = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

const MAX_COMMAND_CAPTURE_BYTES = 512 * 1024;
const MAX_FILE_RANGE_CHARS = 500_000;

async function readFileLineRange(
  path: string,
  startLine: number,
  lineCount: number,
): Promise<{ content: string; endLine: number; hasMore: boolean; truncated: boolean }> {
  const input = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const selected: string[] = [];
  let currentLine = 0, chars = 0, hasMore = false, truncated = false;
  try {
    for await (const line of lines) {
      currentLine++;
      if (currentLine < startLine) continue;
      if (selected.length >= lineCount) {
        hasMore = true;
        break;
      }
      const separator = selected.length ? 1 : 0;
      const remaining = MAX_FILE_RANGE_CHARS - chars - separator;
      if (line.length > remaining) {
        selected.push(line.slice(0, Math.max(0, remaining)));
        chars = MAX_FILE_RANGE_CHARS;
        hasMore = true;
        truncated = true;
        break;
      }
      selected.push(line);
      chars += line.length + separator;
    }
  } finally {
    lines.close();
    input.destroy();
  }
  return {
    content: selected.join("\n"),
    endLine: selected.length ? startLine + selected.length - 1 : startLine - 1,
    hasMore,
    truncated,
  };
}

export const coreTools: HarnessFeature = {
  id: "core-tools",
  capability: {
    id: "core",
    title: "Core",
    description: "Essential workspace and safety tools.",
    alwaysAvailable: true,
  },
  register({ tools, prompts }) {
    //bash工具
    tools.register(
      definition("bash", "Run a shell command in the workspace", { command: { type: "string" } }, [
        "command",
      ]),
      async (input, context) => {
        const command = String(input.command ?? ""),
          shell = isWindows ? "cmd.exe" : "/bin/sh";
        const result = await runCommand(
          shell,
          isWindows ? ["/d", "/s", "/c", command] : ["-c", command],
          { cwd: context.workspace },
          MAX_COMMAND_CAPTURE_BYTES,
        );
        const output = result.stdout + result.stderr || `(exit ${result.code})`;
        const captureNotice = result.stdoutTruncated || result.stderrTruncated
          ? `\n[command output capture capped at ${MAX_COMMAND_CAPTURE_BYTES} bytes per stream]`
          : "";
        return `${output}${captureNotice}`;
      },
    );
    //读取工具
    tools.register(
      definition("read_file", "Read a UTF-8 workspace file", {
        path: { type: "string" },
        limit: { type: "number" },
        start_line: { type: "integer", minimum: 1 },
        line_count: { type: "integer", minimum: 1, maximum: 2_000 },
      }, ["path"]),
      async (input, context) => {
        const path = safePath(context.workspace, String(input.path ?? ""));
        const startLine = typeof input.start_line === "number"
          ? Math.max(1, Math.floor(input.start_line))
          : 1;
        const requestedCount = typeof input.line_count === "number"
          ? input.line_count
          : typeof input.limit === "number"
          ? input.limit
          : 200;
        const lineCount = Math.min(2_000, Math.max(1, Math.floor(requestedCount)));
        const [range, info] = await Promise.all([
          readFileLineRange(path, startLine, lineCount),
          stat(path),
        ]);
        const footer =
          `[read_file status=ok sizeBytes=${info.size} lines=${startLine}-${range.endLine} hasMore=${range.hasMore}` +
          `${range.truncated ? " rangeCharsCapped=true" : ""}]`;
        return `${footer}\n${range.content}`;
      },
    );
    //写入工具
    tools.register(
      definition("write_file", "Write a UTF-8 workspace file", {
        path: { type: "string" },
        content: { type: "string" },
      }, ["path", "content"]),
      async (input, context) => {
        const path = safePath(context.workspace, String(input.path ?? ""));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, String(input.content ?? ""), "utf8");
        return `Wrote ${String(input.content ?? "").length} characters to ${input.path}`;
      },
    );
    //编辑工具
    tools.register(
      definition("edit_file", "Replace one unique text fragment", {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      }, ["path", "old_text", "new_text"]),
      async (input, context) => {
        const path = safePath(context.workspace, String(input.path ?? "")),
          text = await readFile(path, "utf8"),
          oldText = String(input.old_text ?? "");
        if (!oldText || text.split(oldText).length !== 2) {
          throw new Error(
            "old_text must match exactly once",
          );
        }
        await writeFile(path, text.replace(oldText, String(input.new_text ?? "")), "utf8");
        return `Edited ${input.path}`;
      },
    );
    //指导模型完成任务
    prompts.register({
      id: "workflow",
      title: "Execution workflow",
      priority: 10,
      content:
        "Inspect relevant context, use precise tools, make the smallest coherent change, verify in proportion to risk, and report concrete outcomes.",
    });
  },
};
