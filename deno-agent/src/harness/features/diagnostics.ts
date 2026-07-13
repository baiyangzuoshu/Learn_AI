import type { HarnessFeature } from "../contracts.ts";
export const diagnostics: HarnessFeature = {
  id: "diagnostics",
  register({ tools, prompts }) {
    tools.register({
      type: "function",
      function: {
        name: "harness_status",
        description: "Return formal harness capabilities",
        parameters: { type: "object", properties: {} },
      },
    }, async (_input, context) =>
      JSON.stringify({
        version: "1.0.0",
        workspace: context.workspace,
        runtime: Deno.version.deno,
        capabilities: [
          "tools",
          "permissions",
          "hooks",
          "todo",
          "subagent",
          "skills",
          "compaction",
          "memory",
          "recovery",
          "task-graph",
          "background",
          "scheduling",
          "teams",
          "protocol",
          "autonomy",
          "worktree",
          "mcp",
          "desktop",
        ],
      }));
    prompts.register({
      id: "contract",
      title: "Complete harness contract",
      priority: 1,
      content:
        "Select the smallest sufficient capability, keep actions observable, protect secrets, preserve durable state intentionally, and never claim success when verification fails.",
    });
  },
};
