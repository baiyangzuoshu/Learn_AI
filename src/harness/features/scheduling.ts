import type { HarnessFeature } from "../contracts.ts";
import {
  configureScheduler,
  listCronSchedules,
  runCronSchedule,
  saveCronSchedules,
} from "../scheduler.ts";
import type { ToolDefinition } from "../../core/types.ts";

function definition(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolDefinition {
  return {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

export const scheduling: HarnessFeature = {
  id: "scheduling",
  register({ tools, prompts, run }) {
    configureScheduler(run);
    tools.register(
      definition("cron_list", "List recurring AI conversation tasks", {}),
      async () => JSON.stringify(await listCronSchedules()),
    );
    //cron_write
    tools.register(
      definition("cron_write", "Replace recurring AI conversation tasks", {
        schedules: { type: "array" },
      }, ["schedules"]),
      async (input) => JSON.stringify(await saveCronSchedules(input.schedules)),
    );
    //cron_run_now
    tools.register(
      definition("cron_run_now", "Run one recurring AI conversation task immediately", {
        id: { type: "string" },
      }, ["id"]),
      async (input) => JSON.stringify(await runCronSchedule(String(input.id ?? ""))),
    );
    //scheduling
    prompts.register({
      id: "scheduling",
      title: "Scheduled conversations",
      priority: 47,
      content:
        "Recurring tasks send an AI prompt and save the answer as a conversation in their bound project. A null workspace uses the default project. Modify schedules only when explicitly requested.",
    });
  },
};
