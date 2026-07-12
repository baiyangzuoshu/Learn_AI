import { createChatCompletion } from "../src/providers/deepseek.ts";
import { getWorkspace, resolveDeepSeekConfig } from "../src/config/settings.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import { isAbsolute, relative, resolve } from "node:path";

export interface AgentEvent {
  type: "tool";
  name: string;
  input: string;
  output: string;
}
export interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
}
export type AuthorizeTool = (
  request: ToolRequest,
) => Promise<{ allowed: boolean; reason?: string }>;
export interface ToolHooks {
  before?: (request: ToolRequest) => Promise<string | void>;
  after?: (request: ToolRequest, output: string) => Promise<void>;
  stop?: (toolCount: number) => Promise<void>;
}
type ToolHandler = (input: Record<string, unknown>, workspace: string) => Promise<string>;

function safePath(workspace: string, requested: string): string {
  const root = resolve(workspace), path = resolve(root, requested);
  const rel = relative(root, path);
  if (
    rel === ".." || rel.startsWith(`..${Deno.build.os === "windows" ? "\\" : "/"}`) ||
    isAbsolute(rel)
  ) throw new Error(`Path escapes workspace: ${requested}`);
  return path;
}

const handlers: Record<string, ToolHandler> = {
  bash: async (input, workspace) => {
    const command = String(input.command ?? "");
    if (!command) throw new Error("command is required");
    const result = await new Deno.Command("/bin/sh", {
      args: ["-c", command],
      cwd: workspace,
      stdout: "piped",
      stderr: "piped",
    }).output();
    return (new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr) ||
      `(exit ${result.code})`).slice(0, 50_000);
  },
  read_file: async (input, workspace) => {
    const text = await Deno.readTextFile(safePath(workspace, String(input.path ?? "")));
    const limit = typeof input.limit === "number" ? input.limit : undefined;
    return (limit ? text.split("\n").slice(0, limit).join("\n") : text).slice(0, 50_000);
  },
  write_file: async (input, workspace) => {
    const path = safePath(workspace, String(input.path ?? ""));
    await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await Deno.writeTextFile(path, String(input.content ?? ""));
    return `Wrote ${String(input.content ?? "").length} characters to ${String(input.path)}`;
  },
  edit_file: async (input, workspace) => {
    const path = safePath(workspace, String(input.path ?? ""));
    const text = await Deno.readTextFile(path);
    const oldText = String(input.old_text ?? ""), newText = String(input.new_text ?? "");
    if (!oldText) throw new Error("old_text is required");
    const occurrences = text.split(oldText).length - 1;
    if (occurrences === 0) throw new Error("old_text not found");
    if (occurrences > 1) throw new Error(`old_text is not unique (${occurrences} matches)`);
    await Deno.writeTextFile(path, text.replace(oldText, newText));
    return `Edited ${String(input.path)}`;
  },
};

const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the workspace",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file inside the workspace",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, limit: { type: "number" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write a UTF-8 text file inside the workspace",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace one unique text fragment in a workspace file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_text: { type: "string" },
          new_text: { type: "string" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
];
let systemGuidance = "";
export function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  if (!tools.some((tool) => tool.function.name === definition.function.name)) {
    tools.push(definition);
  }
  handlers[definition.function.name] = handler;
}
export function setSystemGuidance(guidance: string): void {
  systemGuidance = `${systemGuidance} ${guidance}`.trim();
}

export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  authorize: AuthorizeTool = async () => ({ allowed: true }),
  signal?: AbortSignal,
  hooks: ToolHooks = {},
): Promise<string> {
  let toolCount = 0;
  const config = await resolveDeepSeekConfig(model), workspace = await getWorkspace();
  const messages: Message[] = [
    {
      role: "system",
      content:
        `You are a coding agent working in ${workspace}. Use dedicated file tools for precise file operations and bash for commands. Continue until the task is complete. ${systemGuidance}`,
    },
    ...history.filter((m) => m.role === "user" || m.role === "assistant"),
    { role: "user", content: query },
  ];
  while (true) {
    if (signal?.aborted) throw new DOMException("Generation stopped", "AbortError");
    const response = await createChatCompletion(config, messages, tools, signal);
    const assistant = response.choices[0]?.message;
    if (!assistant) throw new Error("Model returned no message");
    messages.push(assistant);
    if (!assistant.tool_calls?.length) {
      await hooks.stop?.(toolCount);
      return assistant.content ?? "";
    }
    for (const call of assistant.tool_calls) {
      let output: string;
      try {
        const handler = handlers[call.function.name];
        if (!handler) throw new Error(`Unknown tool: ${call.function.name}`);
        const input = JSON.parse(call.function.arguments);
        const blocked = await hooks.before?.({ name: call.function.name, input });
        if (blocked) throw new Error(blocked);
        const decision = await authorize({ name: call.function.name, input });
        if (!decision.allowed) {
          throw new Error(`Permission denied${decision.reason ? `: ${decision.reason}` : ""}`);
        }
        output = await handler(input, workspace);
        toolCount++;
        await hooks.after?.({ name: call.function.name, input }, output);
      } catch (error) {
        output = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
      onEvent({ type: "tool", name: call.function.name, input: call.function.arguments, output });
      messages.push({ role: "tool", tool_call_id: call.id, content: output });
    }
  }
}

if (import.meta.main) {
  const query = prompt("s02 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
