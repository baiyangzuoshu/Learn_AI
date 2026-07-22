import { AgentRuntime } from "./runtime.ts";
import { coreTools } from "./features/core_tools.ts";
import { productivity } from "./features/productivity.ts";
import { orchestration } from "./features/orchestration.ts";
import { integrations } from "./features/integrations.ts";
import { diagnostics } from "./features/diagnostics.ts";
import { scheduling } from "./features/scheduling.ts";
import type { Message } from "../core/types.ts";
import type { HarnessEvent, PermissionMode } from "./contracts.ts";

export const harness = new AgentRuntime([
  diagnostics,
  coreTools,
  productivity,
  orchestration,
  integrations,
  scheduling,
]);
export const runAgent = harness.run.bind(harness);
export interface AgentEvent {
  type: "tool";
  name: string;
  input: string;
  output: string;
}
//主循环
export async function agentLoop(
  query: string,
  onEvent: (event: AgentEvent) => void = () => {},
  model?: string,
  history: Message[] = [],
  permissionMode: PermissionMode = "ask",//权限
  signal?: AbortSignal,
  onHook: (event: HarnessEvent) => void = () => {},
  providerId?: string,
): Promise<string> {
  return await harness.run({
    query,
    providerId,
    model,
    history,
    permissionMode,
    signal,
    onEvent(event) {
      if (event.type === "tool") {
        onEvent({
          type: "tool",
          name: event.name,
          input: event.input ?? "",
          output: event.output ?? "",
        });
      } else onHook(event);
    },
  });
}
export type { HarnessEvent, PermissionMode, RunOptions } from "./contracts.ts";
export { listCronSchedules, runCronSchedule, saveCronSchedules } from "./scheduler.ts";
