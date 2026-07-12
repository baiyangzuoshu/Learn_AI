import { type AgentEvent, agentLoop as todoAgentLoop } from "./s05_todo_write.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerTool, setSystemGuidance } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

let subagentActive = false;
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "subagent",
    description:
      "Delegate one focused task to an isolated agent context and return only its final result",
    parameters: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
  },
};
registerTool(definition, async (input) => {
  const task = String(input.task ?? "").trim();
  if (!task) throw new Error("task is required");
  if (subagentActive) throw new Error("Nested subagents are disabled");
  subagentActive = true;
  try {
    return await todoAgentLoop(
      `You are an isolated subagent. Complete only this focused task and return a concise result.\n\n${task}`,
      () => {},
      undefined,
      [],
      "ask",
    );
  } finally {
    subagentActive = false;
  }
});
setSystemGuidance(
  "Delegate focused independent subtasks to subagent when isolation reduces context noise. Give it a self-contained task. Do not delegate trivial work.",
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
  return await todoAgentLoop(query, onEvent, model, history, permissionMode, signal, onHook);
}
if (import.meta.main) {
  const query = prompt("s06 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
