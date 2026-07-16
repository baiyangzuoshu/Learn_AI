import { type AgentEvent, agentLoop as backgroundAgentLoop } from "./s13_background_tasks.ts";
import type { PermissionMode } from "./s03_permission.ts";
import { registerSystemPromptSection, registerTool } from "./s02_tool_use.ts";
import type { Message, ToolDefinition } from "../src/core/types.ts";
import { getWorkspace, withWorkspace } from "../src/config/settings.ts";
import { appendConversation } from "../src/config/conversations.ts";

export interface CronSchedule {
  id: string;
  title: string;
  prompt: string;
  workspace: string | null;
  intervalSeconds: number;
  frequency: "interval" | "daily" | "weekly" | "monthly" | "yearly";
  time?: string;
  weekday?: number;
  dayOfMonth?: number;
  month?: number;
  timeoutSeconds: number;
  model?: string;
  permissionMode: PermissionMode;
  enabled: boolean;
  lastRunAt?: string;
  lastConversationId?: string;
  lastError?: string;
  nextRunAt?: string;
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();
let loaded = false;

function schedulesPath(): string {
  const home = Deno.env.get("HOME");
  if (!home) throw new Error("HOME is unavailable");
  return `${home}/Library/Application Support/DenoAgent/cron/agent-schedules.json`;
}
function validateSchedules(value: unknown): CronSchedule[] {
  if (!Array.isArray(value)) throw new Error("schedules must be an array");
  if (value.length > 50) throw new Error("at most 50 schedules are allowed");
  const modes = new Set<PermissionMode>(["ask", "auto", "full"]);
  const schedules = value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`schedules[${index}] is invalid`);
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "").trim(), title = String(item.title ?? "").trim();
    const prompt = String(item.prompt ?? "").trim();
    const intervalSeconds = Math.floor(Number(item.intervalSeconds));
    const frequency = String(item.frequency ?? "interval") as CronSchedule["frequency"];
    const timeoutSeconds = Math.floor(Number(item.timeoutSeconds ?? 600));
    const permissionMode = String(item.permissionMode ?? "auto") as PermissionMode;
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) throw new Error(`schedules[${index}].id is invalid`);
    if (!title || title.length > 200) throw new Error(`schedules[${index}].title is invalid`);
    if (!prompt || prompt.length > 50_000) throw new Error(`schedules[${index}].prompt is invalid`);
    if (!["interval", "daily", "weekly", "monthly", "yearly"].includes(frequency)) {
      throw new Error(`schedules[${index}].frequency is invalid`);
    }
    if (
      frequency === "interval" &&
      (!Number.isFinite(intervalSeconds) || intervalSeconds < 5 || intervalSeconds > 2_592_000)
    ) {
      throw new Error(`schedules[${index}].intervalSeconds must be between 5 and 2592000`);
    }
    const time = String(item.time ?? "09:00"), weekday = Math.floor(Number(item.weekday ?? 1));
    const dayOfMonth = Math.floor(Number(item.dayOfMonth ?? 1)),
      month = Math.floor(Number(item.month ?? 1));
    if (frequency !== "interval" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("time must use HH:mm");
    }
    if (frequency === "weekly" && (weekday < 0 || weekday > 6)) {
      throw new Error("weekday must be 0-6");
    }
    if (["monthly", "yearly"].includes(frequency) && (dayOfMonth < 1 || dayOfMonth > 31)) {
      throw new Error("dayOfMonth must be 1-31");
    }
    if (frequency === "yearly" && (month < 1 || month > 12)) throw new Error("month must be 1-12");
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 7_200) {
      throw new Error(`schedules[${index}].timeoutSeconds must be between 10 and 7200`);
    }
    if (!modes.has(permissionMode)) {
      throw new Error(`schedules[${index}].permissionMode is invalid`);
    }
    const workspace = item.workspace === null || item.workspace === "global"
      ? null
      : String(item.workspace ?? "").trim() || null;
    return {
      id,
      title,
      prompt,
      workspace,
      intervalSeconds: frequency === "interval" ? intervalSeconds : 3600,
      frequency,
      time: frequency === "interval" ? undefined : time,
      weekday: frequency === "weekly" ? weekday : undefined,
      dayOfMonth: ["monthly", "yearly"].includes(frequency) ? dayOfMonth : undefined,
      month: frequency === "yearly" ? month : undefined,
      timeoutSeconds,
      permissionMode,
      model: typeof item.model === "string" && item.model ? item.model : undefined,
      enabled: item.enabled !== false,
      lastRunAt: typeof item.lastRunAt === "string" ? item.lastRunAt : undefined,
      lastConversationId: typeof item.lastConversationId === "string"
        ? item.lastConversationId
        : undefined,
      lastError: typeof item.lastError === "string" ? item.lastError : undefined,
    };
  });
  if (new Set(schedules.map((item) => item.id)).size !== schedules.length) {
    throw new Error("schedule ids must be unique");
  }
  return schedules;
}
async function readSchedules(): Promise<CronSchedule[]> {
  try {
    return validateSchedules(JSON.parse(await Deno.readTextFile(schedulesPath())));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}
async function persistSchedules(schedules: CronSchedule[]): Promise<void> {
  const path = schedulesPath();
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temporary, `${JSON.stringify(schedules, null, 2)}\n`);
  await Deno.rename(temporary, path);
}
async function executeSchedule(id: string) {
  if (running.has(id)) throw new Error(`schedule is already running: ${id}`);
  const schedules = await readSchedules(), schedule = schedules.find((item) => item.id === id);
  if (!schedule) throw new Error(`schedule not found: ${id}`);
  const workspace = schedule.workspace ?? await getWorkspace();
  running.add(id);
  const conversationId = crypto.randomUUID(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), schedule.timeoutSeconds * 1_000);
  let answer: string;
  try {
    answer = await withWorkspace(workspace, () =>
      backgroundAgentLoop(
        schedule.prompt,
        () => {},
        schedule.model,
        [],
        schedule.permissionMode,
        controller.signal,
      ));
    schedule.lastError = undefined;
  } catch (error) {
    answer = `定时任务执行失败：${error instanceof Error ? error.message : String(error)}`;
    schedule.lastError = answer;
  } finally {
    clearTimeout(timer);
    running.delete(id);
  }
  schedule.lastRunAt = new Date().toISOString();
  schedule.lastConversationId = conversationId;
  const latest = await readSchedules(), current = latest.find((item) => item.id === id);
  if (current) {
    Object.assign(current, schedule);
    await persistSchedules(latest);
  }
  await appendConversation(workspace, {
    id: conversationId,
    title: `◷ ${schedule.title}`,
    createdAt: Date.now(),
    messages: [{ role: "user", content: schedule.prompt }, { role: "assistant", content: answer }],
  });
  return { schedule, conversationId, workspace, answer };
}
function calendarDate(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), hour, minute);
}
function nextRun(schedule: CronSchedule, from = new Date()): Date {
  if (schedule.frequency === "interval") {
    return new Date(from.getTime() + schedule.intervalSeconds * 1000);
  }
  const [hour, minute] = (schedule.time ?? "09:00").split(":").map(Number);
  if (schedule.frequency === "daily") {
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  if (schedule.frequency === "weekly") {
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    let days = (schedule.weekday! - next.getDay() + 7) % 7;
    if (!days && next <= from) days = 7;
    next.setDate(next.getDate() + days);
    return next;
  }
  if (schedule.frequency === "monthly") {
    let next = calendarDate(
      from.getFullYear(),
      from.getMonth(),
      schedule.dayOfMonth!,
      hour,
      minute,
    );
    if (next <= from) {
      next = calendarDate(
        from.getFullYear(),
        from.getMonth() + 1,
        schedule.dayOfMonth!,
        hour,
        minute,
      );
    }
    return next;
  }
  let next = calendarDate(
    from.getFullYear(),
    schedule.month! - 1,
    schedule.dayOfMonth!,
    hour,
    minute,
  );
  if (next <= from) {
    next = calendarDate(
      from.getFullYear() + 1,
      schedule.month! - 1,
      schedule.dayOfMonth!,
      hour,
      minute,
    );
  }
  return next;
}
function scheduleNext(schedule: CronSchedule) {
  const delay = Math.max(1000, nextRun(schedule).getTime() - Date.now());
  timers.set(
    schedule.id,
    setTimeout(async () => {
      try {
        await executeSchedule(schedule.id);
      } catch (error) {
        console.error(`[cron:${schedule.id}]`, error);
      }
      const latest = (await readSchedules()).find((item) => item.id === schedule.id);
      if (latest?.enabled) scheduleNext(latest);
    }, delay),
  );
}
async function installSchedules(schedules: CronSchedule[]) {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (const schedule of schedules.filter((item) => item.enabled)) scheduleNext(schedule);
  loaded = true;
}
async function ensureSchedules() {
  if (!loaded) await installSchedules(await readSchedules());
}
export async function listCronSchedules(): Promise<CronSchedule[]> {
  await ensureSchedules();
  return (await readSchedules()).map((schedule) => ({
    ...schedule,
    nextRunAt: schedule.enabled ? nextRun(schedule).toISOString() : undefined,
  }));
}
export async function saveCronSchedules(value: unknown): Promise<CronSchedule[]> {
  const schedules = validateSchedules(value);
  for (const schedule of schedules) {
    if (schedule.workspace) {
      const stat = await Deno.stat(schedule.workspace);
      if (!stat.isDirectory) throw new Error(`绑定项目已失效：${schedule.workspace}`);
    }
  }
  await persistSchedules(schedules);
  await installSchedules(schedules);
  return schedules;
}
export async function runCronSchedule(id: string) {
  await ensureSchedules();
  return await executeSchedule(id);
}

const listDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_list",
    description: "List recurring AI conversation tasks",
    parameters: { type: "object", properties: {} },
  },
};
const writeDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_write",
    description: "Replace all recurring AI conversation tasks",
    parameters: {
      type: "object",
      properties: { schedules: { type: "array" } },
      required: ["schedules"],
    },
  },
};
const runDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "cron_run_now",
    description: "Run one recurring AI conversation task immediately",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
};
registerTool(listDefinition, async () => JSON.stringify(await listCronSchedules()));
registerTool(
  writeDefinition,
  async (input) => JSON.stringify(await saveCronSchedules(input.schedules)),
);
registerTool(
  runDefinition,
  async (input) => JSON.stringify(await runCronSchedule(String(input.id ?? ""))),
);
registerSystemPromptSection({
  id: "s14-cron",
  title: "Scheduled AI conversations",
  priority: 47,
  content:
    "Recurring tasks send an AI prompt and save the result as a new conversation in the bound project. Use cron_write only when explicitly requested. A null workspace means the default global project, resolved to the current default workspace when it runs.",
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
  const schedules = await listCronSchedules();
  onHook({
    name: "CronSchedulerReady",
    detail: `${schedules.length} AI tasks · ${
      schedules.filter((item) => item.enabled).length
    } enabled`,
  });
  return await backgroundAgentLoop(
    query,
    (event) => {
      onEvent(event);
      if (event.name.startsWith("cron_")) {
        onHook({
          name: "CronEvent",
          detail: `${event.name} · ${event.output.length} chars`,
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
  const query = prompt("s14 >> ")?.trim();
  if (query) console.log(`\n${await agentLoop(query)}`);
}
