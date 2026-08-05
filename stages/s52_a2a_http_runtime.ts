import { type AgentEvent, agentLoop as previousAgentLoop } from "./s51_mcp_stdio_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

type TaskStatus = "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled";
export type A2ATask = {
  id: string;
  status: TaskStatus;
  input: string;
  artifacts: string[];
  updatedAt: string;
};
export type A2AHandler = (request: Request) => Promise<Response>;

const transitions: Record<TaskStatus, TaskStatus[]> = {
  submitted: ["working", "canceled"],
  working: ["input-required", "completed", "failed", "canceled"],
  "input-required": ["working", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

export function createA2AHandler(): A2AHandler {
  const tasks = new Map<string, A2ATask>();
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "cache-control": "no-store" } });
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agent.json" && request.method === "GET") {
      return json({
        id: "lesson-agent",
        name: "Lesson Agent",
        url: url.origin,
        skills: ["research"],
        auth: ["bearer"],
      });
    }
    if (url.pathname === "/tasks" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const task: A2ATask = {
        id: `task-${crypto.randomUUID().slice(0, 8)}`,
        status: "submitted",
        input: String(body.input ?? ""),
        artifacts: [],
        updatedAt: new Date().toISOString(),
      };
      tasks.set(task.id, task);
      return json(task, 202);
    }
    const match = url.pathname.match(/^\/tasks\/([^/]+)$/);
    if (!match) return json({ error: "not found" }, 404);
    const task = tasks.get(match[1]);
    if (!task) return json({ error: "task not found" }, 404);
    if (request.method === "GET") return json(task);
    if (request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const next = String(body.status) as TaskStatus;
      if (!transitions[task.status].includes(next)) {
        return json({ error: `${task.status} -> ${next} is invalid` }, 409);
      }
      task.status = next;
      if (typeof body.artifact === "string") task.artifacts.push(body.artifact.slice(0, 10_000));
      task.updatedAt = new Date().toISOString();
      return json(task);
    }
    return json({ error: "method not allowed" }, 405);
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "a2a_http_runtime_demo",
    description: "Exercise an in-memory A2A HTTP handler with Agent Card and task lifecycle",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const handler = createA2AHandler();
  const origin = "https://agent.example.test";
  const created = await handler(
    new Request(`${origin}/tasks`, {
      method: "POST",
      body: JSON.stringify({ input: input.input }),
      headers: { "content-type": "application/json" },
    }),
  );
  const task = await created.json() as A2ATask;
  const accepted = await handler(
    new Request(`${origin}/tasks/${task.id}`, {
      method: "POST",
      body: JSON.stringify({ status: "working" }),
      headers: { "content-type": "application/json" },
    }),
  );
  return JSON.stringify({ created: task, accepted: await accepted.json() });
});
registerSystemPromptSection({
  id: "s52-a2a-http-runtime",
  title: "A2A HTTP runtime",
  priority: 33,
  content:
    "Expose Agent Card discovery and task lifecycle through a typed HTTP boundary. Validate bodies, return 202 for accepted work, enforce state transitions, prevent stale writes, and carry auth, idempotency, and trace IDs in real deployments.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s52 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
