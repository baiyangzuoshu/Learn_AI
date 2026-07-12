import { type AgentEvent, agentLoop as hooksAgentLoop } from "./s04_hooks.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerTool, setSystemGuidance } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "todo_write",
    description: "Create or update the task list for the current multi-step task",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
      required: ["todos"],
    },
  },
};
registerTool(definition, async (input) => {
  if (!Array.isArray(input.todos)) throw new Error("todos must be an array");
  const statuses = new Set(["pending", "in_progress", "completed"]);
  for (const [index, todo] of input.todos.entries()) {
    if (
      !todo || typeof todo !== "object" || typeof todo.content !== "string" ||
      !statuses.has(todo.status)
    ) throw new Error(`todos[${index}] is invalid`);
  }
  const completed = input.todos.filter((todo) => todo.status === "completed").length;
  return `Updated ${input.todos.length} tasks (${completed} completed)`;
});
setSystemGuidance(
  "Before any multi-step task, call todo_write to plan concise steps. Keep exactly one task in_progress and update the list as work progresses.",
);

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
  return await hooksAgentLoop(query, onEvent, model, history, permissionMode, signal, onHook);
}
if (import.meta.main) {
  const query = prompt("s05 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
