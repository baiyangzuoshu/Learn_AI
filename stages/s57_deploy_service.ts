import { type AgentEvent, agentLoop as previousAgentLoop } from "./s56_agent_runtime.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type QueueJob = {
  id: string;
  input: string;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  createdAt: string;
};
export class DurableLessonQueue {
  readonly jobs = new Map<string, QueueJob>();
  enqueue(input: string): QueueJob {
    const job: QueueJob = {
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
      input,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }
  claim(): QueueJob | undefined {
    const job = [...this.jobs.values()].find((item) => item.status === "queued");
    if (!job) return;
    job.status = "running";
    job.attempts++;
    return job;
  }
  complete(id: string, ok: boolean) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("job not found");
    job.status = ok ? "completed" : job.attempts >= 3 ? "failed" : "queued";
  }
}
export function eventStream(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}
export function createServiceHandler(
  queue = new DurableLessonQueue(),
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
        queueDepth: [...queue.jobs.values()].filter((job) => job.status === "queued").length,
      });
    }
    if (url.pathname === "/jobs" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      return Response.json(queue.enqueue(String(body.input ?? "")), { status: 202 });
    }
    if (url.pathname === "/jobs" && request.method === "GET") {
      return Response.json([...queue.jobs.values()]);
    }
    return Response.json({ error: "not found" }, { status: 404 });
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "deploy_service_demo",
    description: "Exercise a local API, health endpoint, durable-style queue, and SSE stream",
    parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  },
};
registerTool(definition, async (input) => {
  const queue = new DurableLessonQueue();
  const handler = createServiceHandler(queue);
  const response = await handler(
    new Request("https://lesson.test/jobs", {
      method: "POST",
      body: JSON.stringify({ input: input.input }),
      headers: { "content-type": "application/json" },
    }),
  );
  const job = await response.json();
  return JSON.stringify({
    status: response.status,
    job,
    health: await (await handler(new Request("https://lesson.test/health"))).json(),
    stream: await new Response(eventStream([{ type: "accepted", job }])).text(),
  });
});
registerSystemPromptSection({
  id: "s57-deploy-service",
  title: "Deployable Agent service",
  priority: 38,
  content:
    "Separate API admission, queue durability, Worker claim/lease, retry/dead-letter, health checks, and streaming progress. Bind network servers deliberately and keep request IDs, auth, and backpressure visible.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  const query = prompt("s57 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
