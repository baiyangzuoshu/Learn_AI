import { isAbsolute, relative, resolve } from "node:path";
import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../../core/types.ts";
//根据模型提供相对路径，防止工具越权读取工作区外的文件
function safePath(workspace: string, requested: string) {
  const root = resolve(workspace), path = resolve(root, requested), rel = relative(root, path);
  if (
    rel === ".." || rel.startsWith(`..${Deno.build.os === "windows" ? "\\" : "/"}`) ||
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

export const coreTools: HarnessFeature = {
  id: "core-tools",
  register({ tools, prompts }) {
    //bash工具
    tools.register(
      definition("bash", "Run a shell command in the workspace", { command: { type: "string" } }, [
        "command",
      ]),
      async (input, context) => {
        const command = String(input.command ?? ""),
          shell = Deno.build.os === "windows" ? "cmd.exe" : "/bin/sh";
        const result = await new Deno.Command(shell, {
          args: Deno.build.os === "windows" ? ["/d", "/s", "/c", command] : ["-c", command],
          cwd: context.workspace,
          stdout: "piped",
          stderr: "piped",
        }).output();
        return (new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr) ||
          `(exit ${result.code})`).slice(0, 50_000);
      },
    );
    //读取工具
    tools.register(
      definition("read_file", "Read a UTF-8 workspace file", {
        path: { type: "string" },
        limit: { type: "number" },
      }, ["path"]),
      async (input, context) => {
        const text = await Deno.readTextFile(safePath(context.workspace, String(input.path ?? "")));
        return (typeof input.limit === "number"
          ? text.split("\n").slice(0, input.limit).join("\n")
          : text).slice(0, 50_000);
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
        await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
        await Deno.writeTextFile(path, String(input.content ?? ""));
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
          text = await Deno.readTextFile(path),
          oldText = String(input.old_text ?? "");
        if (!oldText || text.split(oldText).length !== 2) {
          throw new Error(
            "old_text must match exactly once",
          );
        }
        await Deno.writeTextFile(path, text.replace(oldText, String(input.new_text ?? "")));
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
