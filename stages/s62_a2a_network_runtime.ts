import { type AgentEvent, agentLoop as previousAgentLoop } from "./s61_mcp_interop_harness.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type NetworkTask = {
  id: string;
  status: "submitted" | "working" | "completed" | "failed" | "canceled";
  input: string;
  artifacts: string[];
  updatedAt: string;
};
type TaskStore = Map<string, NetworkTask>;
const transitions: Record<NetworkTask["status"], NetworkTask["status"][]> = {
  submitted: ["working", "canceled"],
  working: ["completed", "failed", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "cache-control": "no-store", ...extra } });
}

export function createAuthenticatedA2AServer(
  token: string,
  store: TaskStore = new Map(),
): (request: Request) => Promise<Response> {
  const idempotency = new Map<string, NetworkTask>();
  return async (request) => {
    if (request.headers.get("authorization") !== `Bearer ${token}`) {
      return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
    }
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/agent.json" && request.method === "GET") {
      return json({ name: "s62-agent", url: url.origin, version: "1.0.0", skills: ["research"] });
    }
    if (url.pathname === "/tasks" && request.method === "POST") {
      const key = request.headers.get("idempotency-key");
      if (key && idempotency.has(key)) return json(idempotency.get(key), 200);
      const body = await request.json() as Record<string, unknown>;
      const task: NetworkTask = {
        id: `task-${crypto.randomUUID().slice(0, 8)}`,
        status: "submitted",
        input: String(body.input ?? "").slice(0, 4_000),
        artifacts: [],
        updatedAt: new Date().toISOString(),
      };
      store.set(task.id, task);
      if (key) idempotency.set(key, task);
      return json(task, 202, { location: `${url.origin}/tasks/${task.id}` });
    }
    const match = url.pathname.match(/^\/tasks\/([^/]+)$/);
    if (!match) return json({ error: "not found" }, 404);
    const task = store.get(match[1]);
    if (!task) return json({ error: "task not found" }, 404);
    if (request.method === "GET") return json(task);
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    const body = await request.json() as Record<string, unknown>;
    const next = String(body.status) as NetworkTask["status"];
    if (!transitions[task.status].includes(next)) return json({ error: "invalid transition" }, 409);
    task.status = next;
    if (typeof body.artifact === "string") task.artifacts.push(body.artifact.slice(0, 10_000));
    task.updatedAt = new Date().toISOString();
    return json(task);
  };
}

export async function submitA2ATask(
  fetcher: typeof fetch,
  endpoint: string,
  input: string,
  token: string,
  idempotencyKey: string,
) {
  const response = await fetcher(`${endpoint}/tasks`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ input }),
  });
  if (!response.ok) throw new Error(`A2A submit failed: ${response.status}`);
  return await response.json() as NetworkTask;
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "a2a_network_runtime",
    description:
      "Exercise authenticated A2A discovery, idempotent task submission, and state updates",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const server = createAuthenticatedA2AServer("lesson-token");
  const response = await submitA2ATask(
    (request, init) => server(new Request(request, init)),
    "https://agent.test",
    String(input.input),
    "lesson-token",
    "demo-key",
  );
  return JSON.stringify({
    submitted: response,
    replayed: await submitA2ATask(
      (request, init) => server(new Request(request, init)),
      "https://agent.test",
      String(input.input),
      "lesson-token",
      "demo-key",
    ),
  });
});
registerSystemPromptSection({
  id: "s62-a2a-network",
  title: "Authenticated A2A network runtime",
  priority: 43,
  content:
    "A2A clients discover an Agent Card, authenticate every request, use idempotency keys, and observe explicit task and artifact state transitions.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s62 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
