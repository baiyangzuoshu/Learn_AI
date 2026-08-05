import { type AgentEvent, agentLoop as previousAgentLoop } from "./s27_handoff_guardrails.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

export type Memory = {
  id: string;
  tenant: string;
  kind: "semantic" | "episodic" | "procedural";
  text: string;
  vector: number[];
  deleted?: boolean;
  expiresAt?: number;
};
export function embedding(text: string) {
  return Array.from(
    { length: 6 },
    (_, index) =>
      [...text].reduce(
        (sum, char, position) => sum + (position % 6 === index ? char.charCodeAt(0) : 0),
        0,
      ),
  );
}
export function retrieve(records: Memory[], tenant: string, query: string) {
  const terms = new Set(query.toLowerCase().split(/\W+/));
  return records.filter((item) =>
    item.tenant === tenant && !item.deleted && (!item.expiresAt || item.expiresAt > Date.now())
  ).map((item) => ({
    item,
    score: [...terms].filter((term) => term && item.text.toLowerCase().includes(term)).length,
  })).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score);
}
const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "hybrid_memory",
    description:
      "Store typed tenant memory and retrieve grounded semantic, episodic, or procedural evidence",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
registerTool(
  definition,
  async (input) =>
    JSON.stringify(
      retrieve(
        [{
          id: "m1",
          tenant: "lesson",
          kind: "semantic",
          text: "MCP sessions require initialization",
          vector: embedding("MCP sessions require initialization"),
        }],
        "lesson",
        String(input.query),
      ),
    ),
);
registerSystemPromptSection({
  id: "s28-memory",
  title: "RAG and long-term memory",
  priority: 39,
  content:
    "Retrieve before prompting. Keep tenant-scoped semantic, episodic, and procedural memory in durable stores with hybrid ranking, citations, retention, migration, tombstones, and forgetting.",
});
export { type AgentEvent };
export async function agentLoop(...args: Parameters<typeof previousAgentLoop>) {
  return await previousAgentLoop(...args);
}
