import { type AgentEvent, agentLoop as previousAgentLoop } from "./s73_mcp_transport_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type ServiceTask = {
  id: string;
  status: "submitted" | "working" | "completed" | "failed";
  input: string;
  artifacts: string[];
  events: string[];
};
export interface TaskRepository {
  get(id: string): Promise<ServiceTask | undefined>;
  save(task: ServiceTask): Promise<void>;
}
class MapTaskRepository implements TaskRepository {
  private readonly values = new Map<string, ServiceTask>();
  async get(id: string) {
    return this.values.get(id);
  }
  async save(task: ServiceTask) {
    this.values.set(task.id, structuredClone(task));
  }
}

export class A2AService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly verify: (request: Request) => boolean,
  ) {}
  async handle(request: Request) {
    if (!this.verify(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agent.json") {
      return Response.json({
        name: "s74-service",
        skills: ["research"],
        capabilities: { streaming: true, artifacts: true },
      });
    }
    if (url.pathname === "/tasks" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>,
        task: ServiceTask = {
          id: `a2a-${crypto.randomUUID().slice(0, 8)}`,
          status: "submitted",
          input: String(body.input ?? "").slice(0, 8_000),
          artifacts: [],
          events: ["submitted"],
        };
      await this.repository.save(task);
      return Response.json(task, {
        status: 202,
        headers: { location: `${url.origin}/tasks/${task.id}` },
      });
    }
    const id = url.pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
    if (!id) return Response.json({ error: "not found" }, { status: 404 });
    const task = await this.repository.get(id);
    if (!task) return Response.json({ error: "task not found" }, { status: 404 });
    if (request.method === "GET") return Response.json(task);
    if (request.method === "POST") {
      const body = await request.json() as Record<string, unknown>,
        next = String(body.status) as ServiceTask["status"];
      if (task.status === "completed" || task.status === "failed") {
        return Response.json({ error: "terminal task" }, { status: 409 });
      }
      task.status = next;
      task.events.push(next);
      if (typeof body.artifact === "string") task.artifacts.push(body.artifact.slice(0, 20_000));
      await this.repository.save(task);
      return Response.json(task);
    }
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "a2a_service_runtime",
    description:
      "Expose an authenticated A2A Agent Card and repository-backed task/artifact lifecycle",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const service = new A2AService(
    new MapTaskRepository(),
    (request) => request.headers.get("authorization") === "Bearer lesson",
  );
  const response = await service.handle(
    new Request("https://agent.test/tasks", {
      method: "POST",
      headers: { authorization: "Bearer lesson", "content-type": "application/json" },
      body: JSON.stringify({ input: input.input }),
    }),
  );
  return JSON.stringify(await response.json());
});
registerSystemPromptSection({
  id: "s74-a2a-service",
  title: "Repository-backed A2A service",
  priority: 55,
  content:
    "A2A service boundaries authenticate callers, persist task state, expose an Agent Card, and retain artifacts/events so clients can recover after disconnects.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s74 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
