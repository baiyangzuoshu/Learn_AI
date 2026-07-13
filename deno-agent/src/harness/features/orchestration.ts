import { AsyncLocalStorage } from "node:async_hooks";
import type { HarnessFeature } from "../contracts.ts";
import type { ToolDefinition } from "../../core/types.ts";
const def = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const nested = new AsyncLocalStorage<boolean>();
interface TeamContext {
  id: string;
  member: string;
}
const teamContext = new AsyncLocalStorage<TeamContext>(), boards = new Map<string, unknown[]>();

export const orchestration: HarnessFeature = {
  id: "orchestration",
  register({ tools, prompts, run }) {
    tools.register(
      def("subagent", "Delegate one focused isolated task", { task: { type: "string" } }, ["task"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested delegation is disabled");
        const task = String(input.task ?? "").trim();
        if (!task) throw new Error("task is required");
        return await nested.run(true, () =>
          run({
            query: `Complete only this focused task and return concise evidence.\n\n${task}`,
            workspace: context.workspace,
            permissionMode: "ask",
            signal: context.signal,
          }));
      },
    );
    tools.register(
      def("team_send", "Send a message inside an active team", {
        to: { type: "string" },
        kind: { type: "string" },
        content: { type: "string" },
      }, ["to", "kind", "content"]),
      async (input) => {
        const active = teamContext.getStore();
        if (!active) throw new Error("team_send is only available inside a team");
        const message = {
          from: active.member,
          to: String(input.to),
          kind: String(input.kind),
          content: String(input.content),
          timestamp: new Date().toISOString(),
        };
        boards.get(active.id)!.push(message);
        return JSON.stringify(message);
      },
    );
    tools.register(
      def("team_inbox", "Read messages for the active team member", {}, []),
      async () => {
        const active = teamContext.getStore();
        if (!active) throw new Error("team_inbox is only available inside a team");
        return JSON.stringify(
          (boards.get(active.id) ?? []).filter((item: any) =>
            item.to === "all" || item.to === active.member || item.from === active.member
          ),
        );
      },
    );
    tools.register(
      def("team_run", "Run 2 to 4 specialists in parallel", {
        objective: { type: "string" },
        members: { type: "array" },
      }, ["objective", "members"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested teams are disabled");
        if (!Array.isArray(input.members) || input.members.length < 2 || input.members.length > 4) {
          throw new Error("team requires 2 to 4 members");
        }
        const members = input.members;
        const id = `team-${crypto.randomUUID().slice(0, 8)}`,
          objective = String(input.objective ?? "");
        boards.set(id, []);
        const settled = await nested.run(
          true,
          () =>
            Promise.allSettled(
              members.map((raw: any) =>
                teamContext.run(
                  { id, member: String(raw.id) },
                  () =>
                    run({
                      query:
                        `You are ${raw.role}. Work only on: ${raw.task}\nShared objective: ${objective}\nBroadcast important findings with team_send and read team_inbox before finalizing.`,
                      workspace: context.workspace,
                      permissionMode: "ask",
                      signal: context.signal,
                    }),
                )
              ),
            ),
        );
        return JSON.stringify({
          id,
          objective,
          messages: boards.get(id),
          members: members.map((member: any, index) =>
            settled[index].status === "fulfilled"
              ? {
                ...member,
                status: "completed",
                result: (settled[index] as PromiseFulfilledResult<string>).value,
              }
              : {
                ...member,
                status: "failed",
                result: String((settled[index] as PromiseRejectedResult).reason),
              }
          ),
        });
      },
    );
    tools.register(
      def("autonomous_run", "Run a bounded observe-act-verify loop", {
        objective: { type: "string" },
        success_criteria: { type: "array" },
        max_iterations: { type: "number" },
      }, ["objective", "success_criteria"]),
      async (input, context) => {
        if (nested.getStore()) throw new Error("Nested autonomy is disabled");
        const max = Math.min(6, Math.max(1, Number(input.max_iterations ?? 4))),
          results: string[] = [];
        await nested.run(true, async () => {
          for (let iteration = 1; iteration <= max; iteration++) {
            const output = await run({
              query:
                `Autonomous iteration ${iteration}/${max}. Objective: ${input.objective}\nSuccess criteria: ${
                  JSON.stringify(input.success_criteria)
                }\nPrevious evidence: ${
                  results.join("\n")
                }\nAct, verify, then emit [AUTONOMY_COMPLETE] only when every criterion is proven.`,
              workspace: context.workspace,
              permissionMode: "ask",
              signal: context.signal,
            });
            results.push(output);
            if (output.includes("[AUTONOMY_COMPLETE]")) {
              break;
            }
          }
        });
        return JSON.stringify({
          status: results.at(-1)?.includes("[AUTONOMY_COMPLETE]") ? "completed" : "iteration_limit",
          iterations: results,
        });
      },
    );
    prompts.register({
      id: "orchestration",
      title: "Delegation and autonomy",
      priority: 30,
      content:
        "Use direct tools first. Delegate only independent focused work. Teams have 2–4 non-overlapping members. Autonomy requires measurable success criteria and strict limits. Nested orchestration is disabled.",
    });
  },
};
