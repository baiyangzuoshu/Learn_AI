import { AsyncLocalStorage } from "node:async_hooks";
import { type AgentEvent, agentLoop as teamsAgentLoop } from "./s15_agent_teams.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
interface Member {
  id: string;
  role: string;
  task: string;
}
interface ProtocolContext {
  teamId: string;
  memberId: string;
}
interface TeamMessage {
  from: string;
  to: string;
  kind: string;
  content: string;
  timestamp: string;
}
const context = new AsyncLocalStorage<ProtocolContext>();
const boards = new Map<string, TeamMessage[]>();
let protocolTeamActive = false;
const sendDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "team_send",
    description: "Send a finding, question, risk, or handoff to the active team",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        kind: { type: "string", enum: ["finding", "question", "answer", "risk", "handoff"] },
        content: { type: "string" },
      },
      required: ["to", "kind", "content"],
    },
  },
};
const inboxDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "team_inbox",
    description: "Read messages addressed to this member or broadcast to all",
    parameters: { type: "object", properties: {} },
  },
};
registerTool(sendDefinition, async (input) => {
  const active = context.getStore();
  if (!active) throw new Error("team_send is only available inside a protocol team");
  const content = String(input.content ?? "").trim(),
    to = String(input.to ?? "all").trim(),
    kind = String(input.kind ?? "finding");
  if (!content || content.length > 4_000) throw new Error("message content is invalid");
  const message = { from: active.memberId, to, kind, content, timestamp: new Date().toISOString() };
  boards.get(active.teamId)!.push(message);
  return JSON.stringify(message);
});
registerTool(inboxDefinition, async () => {
  const active = context.getStore();
  if (!active) throw new Error("team_inbox is only available inside a protocol team");
  return JSON.stringify(
    (boards.get(active.teamId) ?? []).filter((message) =>
      message.to === "all" || message.to === active.memberId || message.from === active.memberId
    ),
  );
});
const runDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "team_protocol_run",
    description: "Run 2 to 4 specialists with an isolated shared message protocol",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
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
function membersFrom(value: unknown): Member[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new Error("protocol team requires 2 to 4 members");
  }
  const members = value.map((raw, index) => {
    const item = raw as Record<string, unknown>;
    const id = String(item?.id ?? "").trim(),
      role = String(item?.role ?? "").trim(),
      task = String(item?.task ?? "").trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(id) || !role || !task) {
      throw new Error(`members[${index}] is invalid`);
    }
    return { id, role, task };
  });
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new Error("member ids must be unique");
  }
  return members;
}
registerTool(runDefinition, async (input) => {
  if (protocolTeamActive) throw new Error("Nested protocol teams are disabled");
  const objective = String(input.objective ?? "").trim(), members = membersFrom(input.members);
  if (!objective) throw new Error("objective is required");
  const teamId = `team-${crypto.randomUUID().slice(0, 8)}`;
  boards.set(teamId, []);
  protocolTeamActive = true;
  try {
    const settled = await Promise.allSettled(
      members.map((member) =>
        context.run({ teamId, memberId: member.id }, () =>
          teamsAgentLoop(
            `You are ${member.id}, the team's ${member.role}. Complete only your assignment. Use team_send to broadcast important findings or risks. Use team_inbox once before your final response. Do not create another team.\n\nObjective: ${objective}\n\nAssignment: ${member.task}`,
            () => {},
            undefined,
            [],
            "ask",
          ))
      ),
    );
    return JSON.stringify({
      teamId,
      objective,
      messages: boards.get(teamId),
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
    protocolTeamActive = false;
  }
});
registerSystemPromptSection({
  id: "s16-protocol",
  title: "Team protocol",
  priority: 49,
  content:
    "Use team_protocol_run when parallel specialists must exchange findings or risks. Members broadcast only decision-relevant information and read their inbox before finalizing. The main agent owns conflict resolution and the final answer.",
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
  onHook({
    name: "TeamProtocolReady",
    detail: "isolated boards · broadcast/direct messages · main-agent arbitration",
  });
  return await teamsAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name === "team_protocol_run") {
        onHook({
          name: "TeamProtocolCompleted",
          detail: `${event.output.length} chars`,
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
  const query = prompt("s16 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
