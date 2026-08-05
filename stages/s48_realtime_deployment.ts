import { type AgentEvent, agentLoop as previousAgentLoop } from "./s47_multi_agent_patterns.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Wire = "http" | "sse" | "websocket" | "webrtc" | "queue";
export type Deployment = "embedded" | "api" | "event-driven" | "mcp" | "a2a";
export function chooseWire(latencyMs: number, streaming: boolean, background: boolean): Wire {
  if (background) return "queue";
  if (latencyMs < 100 && streaming) return "webrtc";
  if (streaming) return "sse";
  return "http";
}
export function chooseDeployment(
  longRunning: boolean,
  reusable: boolean,
  agentToAgent: boolean,
): Deployment {
  if (agentToAgent) return "a2a";
  if (reusable) return "api";
  if (longRunning) return "event-driven";
  return "embedded";
}
export function sseEvent(type: string, payload: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
export function healthSnapshot(
  version: string,
  dependencies: Record<string, "ok" | "degraded" | "down">,
) {
  const values = Object.values(dependencies);
  return {
    version,
    status: values.includes("down") ? "down" : values.includes("degraded") ? "degraded" : "ok",
    dependencies,
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "realtime_deployment_demo",
    description: "Select an agent deployment style and communication wire",
    parameters: {
      type: "object",
      properties: {
        latency_ms: { type: "number" },
        streaming: { type: "boolean" },
        background: { type: "boolean" },
        reusable: { type: "boolean" },
        agent_to_agent: { type: "boolean" },
      },
      required: ["latency_ms", "streaming", "background", "reusable", "agent_to_agent"],
    },
  },
};
registerTool(definition, async (input) => {
  const wire = chooseWire(
    Number(input.latency_ms),
    Boolean(input.streaming),
    Boolean(input.background),
  );
  const deployment = chooseDeployment(
    Boolean(input.background),
    Boolean(input.reusable),
    Boolean(input.agent_to_agent),
  );
  return JSON.stringify({
    wire,
    deployment,
    event: sseEvent("status", { wire, deployment }),
    health: healthSnapshot("s48", {
      model: "ok",
      queue: deployment === "event-driven" ? "ok" : "degraded",
    }),
  });
});
registerSystemPromptSection({
  id: "s48-realtime-deployment",
  title: "Deployment wires and runtime choices",
  priority: 29,
  content:
    "Match consumption to deployment: embedded for low-latency local work, API for reusable request/response, event-driven workers for long jobs, MCP/A2A for agent composition. Choose HTTP, SSE, WebSocket/WebRTC, or queues by latency and streaming needs.",
});

export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}

if (import.meta.main) {
  console.log(chooseWire(200, true, false));
  const query = prompt("s48 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
