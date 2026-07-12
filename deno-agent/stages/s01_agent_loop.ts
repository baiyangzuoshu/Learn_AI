import { createChatCompletion } from "../src/providers/deepseek.ts";
import { resolveDeepSeekConfig } from "../src/config/settings.ts";
import { getWorkspace } from "../src/config/settings.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

function systemPrompt(workspace: string): string {
  return `You are a coding agent working in ${workspace}.
Use the bash tool to inspect and modify this workspace. Keep going until the user's task is complete.`;
}

const TOOLS: ToolDefinition[] = [{
  type: "function",
  function: {
    name: "bash",
    description: "Run a shell command in the current workspace",
    parameters: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
      additionalProperties: false,
    },
  },
}];

async function runBash(command: string, workspace: string): Promise<string> {
  const process = new Deno.Command("/bin/sh", {
    args: ["-c", command],
    cwd: workspace,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await process.output();
  const decoder = new TextDecoder();
  const output = decoder.decode(result.stdout) + decoder.decode(result.stderr);
  return (output || `(exit ${result.code})`).slice(0, 50_000);
}

export interface AgentEvent {
  type: "tool";
  name: string;
  input: string;
  output: string;
}

export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
): Promise<string> {
  const config = await resolveDeepSeekConfig(model);
  const workspace = await getWorkspace();
  const messages: Message[] = [
    { role: "system", content: systemPrompt(workspace) },
    ...history.filter((message) => message.role === "user" || message.role === "assistant"),
    { role: "user", content: query },
  ];

  while (true) {
    const response = await createChatCompletion(config, messages, TOOLS);
    const assistant = response.choices[0]?.message;
    if (!assistant) throw new Error("Model returned no message");
    messages.push(assistant);

    if (!assistant.tool_calls?.length) return assistant.content ?? "";

    for (const call of assistant.tool_calls) {
      let result: string;
      try {
        const input = JSON.parse(call.function.arguments) as { command?: string };
        result = input.command ? await runBash(input.command, workspace) : "Error: command is required";
      } catch (error) {
        result = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
      onEvent({ type: "tool", name: call.function.name, input: call.function.arguments, output: result });
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
}

if (import.meta.main) {
  const query = prompt("s01 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
