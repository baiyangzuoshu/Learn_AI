import { agentLoop, type AgentEvent } from "../stages/s01_agent_loop.ts";

const PORT = Number(Deno.env.get("DENO_AGENT_PORT") ?? "47831");

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "access-control-allow-origin": "*" },
  });
}

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      },
    });
  }
  if (url.pathname === "/health") return json({ ok: true, stage: "s01" });
  if (url.pathname === "/chat" && request.method === "POST") {
    try {
      const body = await request.json() as { message?: string };
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      const events: AgentEvent[] = [];
      const answer = await agentLoop(body.message, (event) => events.push(event));
      return json({ answer, events });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }
  return json({ error: "not found" }, 404);
}

console.log(`Deno Agent server listening on http://127.0.0.1:${PORT}`);
Deno.serve({ hostname: "127.0.0.1", port: PORT }, handler);
