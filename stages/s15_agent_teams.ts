import { type AgentEvent, agentLoop as cronAgentLoop } from "./s14_cron_scheduling.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";

interface TeamMember {
  id: string;
  role: string;
  task: string;
}
let teamActive = false;

const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "team_run",
    description: "Run 2 to 4 independent specialist agents in parallel and collect their results",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string", description: "Shared team objective and context" },
        members: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              role: { type: "string" },
              task: { type: "string" },
            },
            required: ["id", "role", "task"],
          },
        },
      },
      required: ["objective", "members"],
    },
  },
};

function validateMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new Error("team requires 2 to 4 members");
  }
  const members = value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`members[${index}] is invalid`);
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "").trim(), role = String(item.role ?? "").trim();
    const task = String(item.task ?? "").trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(id)) throw new Error(`members[${index}].id is invalid`);
    if (!role || role.length > 100) throw new Error(`members[${index}].role is invalid`);
    if (!task || task.length > 10_000) throw new Error(`members[${index}].task is invalid`);
    return { id, role, task };
  });
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new Error("team member ids must be unique");
  }
  return members;
}

registerTool(definition, async (input) => {
  if (teamActive) throw new Error("Nested agent teams are disabled");
  const objective = String(input.objective ?? "").trim();
  if (!objective) throw new Error("objective is required");
  const members = validateMembers(input.members);
  teamActive = true;
  try {
    const settled = await Promise.allSettled(members.map((member) =>
      cronAgentLoop(
        `You are team member ${member.id}, acting as ${member.role}. Work independently on only your assigned task. Prefer read-only inspection unless the task explicitly requires changes. Do not create subagents or another team. Return evidence, conclusions, risks, and recommendations concisely.\n\nShared objective:\n${objective}\n\nYour assigned task:\n${member.task}`,
        () => {},
        undefined,
        [],
        "ask",
      )
    ));
    return JSON.stringify({
      objective,
      members: members.map((member, index) => {
        const result = settled[index];
        return result.status === "fulfilled"
          ? { ...member, status: "completed", result: result.value }
          : {
            ...member,
            status: "failed",
            result: result.reason instanceof Error ? result.reason.message : String(result.reason),
          };
      }),
    });
  } finally {
    teamActive = false;
  }
});
registerSystemPromptSection({
  id: "s15-teams",
  title: "Agent teams",
  priority: 48,
  content:
    "Use team_run when a task has 2 to 4 genuinely independent specialist perspectives that benefit from parallel work. Give each member a distinct non-overlapping assignment and enough shared context. Do not use a team for sequential steps or trivial work. After the team returns, reconcile disagreements and synthesize one answer with evidence.",
});

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
  onHook({ name: "AgentTeamsReady", detail: "2–4 parallel specialists · nested teams disabled" });
  return await cronAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name === "team_run") {
        onHook({
          name: "AgentTeamCompleted",
          detail: `${event.output.length} chars of team evidence`,
        });
      }
    },
    model,
    history,
    permissionMode,
    signal,
    onHook,
  );
}
if (import.meta.main) {
  const query = prompt("s15 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
