import {
  type AgentEvent,
  agentLoop as previousAgentLoop,
} from "../s32_reasoning_strategies/code.ts";
import { registerSystemPromptSection, registerTool } from "../s02_tool_use/code.ts";
import type { ToolDefinition } from "../../src/core/types.ts";

export type Delivery = {
  mode: "embedded" | "api" | "worker";
  latency: "realtime" | "interactive" | "async";
  protocol: "websocket" | "http-sse" | "queue";
};
export function chooseDelivery(latency: Delivery["latency"]): Delivery {
  return latency === "realtime"
    ? { mode: "embedded", latency, protocol: "websocket" }
    : latency === "interactive"
    ? { mode: "api", latency, protocol: "http-sse" }
    : { mode: "worker", latency, protocol: "queue" };
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "deployment_topology",
    description: "Choose embedded, API, or worker topology and the matching communication wire",
    parameters: {
      type: "object",
      properties: { latency: { type: "string" } },
      required: ["latency"],
    },
  },
};
registerTool(
  definition,
  async (input) => JSON.stringify(chooseDelivery(String(input.latency) as Delivery["latency"])),
);
registerSystemPromptSection({
  id: "s33-deployment",
  title: "Deployment topology and streaming",
  priority: 44,
  content:
    "Choose embedded/WebSocket for realtime UX, API/SSE for streamed request-response, and durable queues for long work. Keep a light front door and typed workers behind it.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
if (import.meta.main) {
  const query = prompt("s33 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
