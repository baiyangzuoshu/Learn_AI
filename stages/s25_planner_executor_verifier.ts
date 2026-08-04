import { type AgentEvent, agentLoop } from "./s24_retrieval_augmented_memory.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { ToolDefinition } from "../src/core/types.ts";

interface PlanNode {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  dependsOn: string[];
}

export function analyzePlan(nodes: PlanNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) throw new Error("plan node ids must be unique");
  for (const node of nodes) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(node.id) || !node.title) {
      throw new Error("invalid plan node");
    }
    for (const dependency of node.dependsOn) {
      if (!byId.has(dependency)) throw new Error(`missing dependency: ${dependency}`);
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)!.dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) visit(node.id);
  const ready = nodes.filter((node) =>
    node.status === "pending" &&
    node.dependsOn.every((id) => byId.get(id)?.status === "completed")
  ).map((node) => node.id);
  const blocked = nodes.filter((node) =>
    node.status === "pending" && node.dependsOn.some((id) => byId.get(id)?.status === "failed")
  ).map((node) => node.id);
  return {
    valid: true,
    ready,
    blocked,
    completed: nodes.filter((node) => node.status === "completed").length,
  };
}

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "plan_analyze",
    description: "Validate a dependency plan, reject cycles, and identify ready or blocked work",
    parameters: {
      type: "object",
      properties: { nodes: { type: "array" } },
      required: ["nodes"],
    },
  },
};
registerTool(definition, async (input) => {
  if (!Array.isArray(input.nodes) || input.nodes.length > 200) {
    throw new Error("nodes must contain at most 200 items");
  }
  const allowed = new Set(["pending", "in_progress", "completed", "failed"]);
  const nodes = input.nodes.map((raw) => {
    const item = raw as Record<string, unknown>;
    const status = String(item.status ?? "pending") as PlanNode["status"];
    if (!allowed.has(status)) throw new Error("invalid plan status");
    return {
      id: String(item.id ?? ""),
      title: String(item.title ?? ""),
      status,
      dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn.map(String) : [],
    };
  });
  return JSON.stringify(analyzePlan(nodes));
});
registerSystemPromptSection({
  id: "s25-planner-executor-verifier",
  title: "Planner executor verifier",
  priority: 6,
  content:
    "Separate planning, execution, and verification. Validate dependency graphs before acting, execute only ready nodes, attach evidence to completion, and replan after verified failure rather than repeating the same action.",
});

export { type AgentEvent, agentLoop };
if (import.meta.main) {
  const query = prompt("s25 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
