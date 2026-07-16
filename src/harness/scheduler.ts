import { appendConversation } from "../config/conversations.ts";
import { appDataDir } from "../config/paths.ts";
import { getWorkspace } from "../config/settings.ts";
import type { PermissionMode, RunOptions } from "./contracts.ts";

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
  providerId?: string;
  model?: string;
  permissionMode: PermissionMode;
  enabled: boolean;
  lastRunAt?: string;
  lastConversationId?: string;
  lastError?: string;
  nextRunAt?: string;
}

type Runner = (options: RunOptions) => Promise<string>;
let runner: Runner | undefined;
let loaded = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();

export function configureScheduler(value: Runner): void {
  runner = value;
}

function path(): string {
  return `${appDataDir()}/cron/agent-schedules.json`;
}

function validate(value: unknown): CronSchedule[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error("定时任务必须是最多 50 项的数组");
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`schedules[${index}] 无效`);
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim();
    const prompt = String(item.prompt ?? "").trim();
    const frequency = String(item.frequency ?? "interval") as CronSchedule["frequency"];
    const intervalSeconds = Math.floor(Number(item.intervalSeconds ?? 60));
    const timeoutSeconds = Math.floor(Number(item.timeoutSeconds ?? 600));
    const permissionMode = String(item.permissionMode ?? "auto") as PermissionMode;
    const time = String(item.time ?? "09:00");
    const weekday = Math.floor(Number(item.weekday ?? 1));
    const dayOfMonth = Math.floor(Number(item.dayOfMonth ?? 1));
    const month = Math.floor(Number(item.month ?? 1));
    if (!/^[\w.-]{1,80}$/.test(id) || ids.has(id)) {
      throw new Error(`schedules[${index}].id 无效或重复`);
    }
    ids.add(id);
    if (!title || !prompt || title.length > 200 || prompt.length > 50_000) {
      throw new Error(`schedules[${index}] 标题或提示词无效`);
    }
    if (!["interval", "daily", "weekly", "monthly", "yearly"].includes(frequency)) {
      throw new Error("执行频率无效");
    }
    if (frequency === "interval" && (intervalSeconds < 5 || intervalSeconds > 2_592_000)) {
      throw new Error("间隔必须为 5–2592000 秒");
    }
    if (frequency !== "interval" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("时间必须使用 HH:mm");
    }
    if (frequency === "weekly" && (weekday < 0 || weekday > 6)) throw new Error("星期必须为 0–6");
    if (["monthly", "yearly"].includes(frequency) && (dayOfMonth < 1 || dayOfMonth > 31)) {
      throw new Error("日期必须为 1–31");
    }
    if (frequency === "yearly" && (month < 1 || month > 12)) throw new Error("月份必须为 1–12");
    if (timeoutSeconds < 10 || timeoutSeconds > 7_200) throw new Error("超时必须为 10–7200 秒");
    if (!["ask", "auto", "full"].includes(permissionMode)) throw new Error("权限模式无效");
    return {
      id,
      title,
      prompt,
      frequency,
      intervalSeconds,
      timeoutSeconds,
      permissionMode,
      workspace: item.workspace === null || item.workspace === "global"
        ? null
        : String(item.workspace ?? "").trim() || null,
      providerId: typeof item.providerId === "string" && item.providerId
        ? item.providerId
        : undefined,
      time: frequency === "interval" ? undefined : time,
      weekday: frequency === "weekly" ? weekday : undefined,
      dayOfMonth: ["monthly", "yearly"].includes(frequency) ? dayOfMonth : undefined,
      month: frequency === "yearly" ? month : undefined,
      model: typeof item.model === "string" && item.model ? item.model : undefined,
      enabled: item.enabled !== false,
      lastRunAt: typeof item.lastRunAt === "string" ? item.lastRunAt : undefined,
      lastConversationId: typeof item.lastConversationId === "string"
        ? item.lastConversationId
        : undefined,
      lastError: typeof item.lastError === "string" ? item.lastError : undefined,
    };
  });
}

async function read(): Promise<CronSchedule[]> {
  try {
    return validate(JSON.parse(await Deno.readTextFile(path())));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}

async function persist(schedules: CronSchedule[]): Promise<void> {
  const target = path();
  await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temporary, `${JSON.stringify(schedules, null, 2)}\n`);
  await Deno.rename(temporary, target);
}

function calendar(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), hour, minute);
}

function nextRun(schedule: CronSchedule, from = new Date()): Date {
  if (schedule.frequency === "interval") {
    return new Date(from.getTime() + schedule.intervalSeconds * 1_000);
  }
  const [hour, minute] = (schedule.time ?? "09:00").split(":").map(Number);
  if (schedule.frequency === "daily") {
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }
  if (schedule.frequency === "weekly") {
    const next = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, minute);
    let days = ((schedule.weekday ?? 1) - next.getDay() + 7) % 7;
    if (!days && next <= from) days = 7;
    next.setDate(next.getDate() + days);
    return next;
  }
  if (schedule.frequency === "monthly") {
    let next = calendar(
      from.getFullYear(),
      from.getMonth(),
      schedule.dayOfMonth ?? 1,
      hour,
      minute,
    );
    if (next <= from) {
      next = calendar(
        from.getFullYear(),
        from.getMonth() + 1,
        schedule.dayOfMonth ?? 1,
        hour,
        minute,
      );
    }
    return next;
  }
  let next = calendar(
    from.getFullYear(),
    (schedule.month ?? 1) - 1,
    schedule.dayOfMonth ?? 1,
    hour,
    minute,
  );
  if (next <= from) {
    next = calendar(
      from.getFullYear() + 1,
      (schedule.month ?? 1) - 1,
      schedule.dayOfMonth ?? 1,
      hour,
      minute,
    );
  }
  return next;
}

async function execute(id: string) {
  if (!runner) throw new Error("Harness scheduler 尚未初始化");
  if (running.has(id)) throw new Error(`任务正在执行：${id}`);
  const schedules = await read();
  const schedule = schedules.find((item) => item.id === id);
  if (!schedule) throw new Error(`定时任务不存在：${id}`);
  const workspace = schedule.workspace ?? await getWorkspace();
  const conversationId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), schedule.timeoutSeconds * 1_000);
  running.add(id);
  let answer = "";
  try {
    answer = await runner({
      query: schedule.prompt,
      workspace,
      providerId: schedule.providerId,
      model: schedule.model,
      permissionMode: schedule.permissionMode,
      signal: controller.signal,
    });
    schedule.lastError = undefined;
  } catch (error) {
    answer = `定时任务执行失败：${error instanceof Error ? error.message : String(error)}`;
    schedule.lastError = answer;
  } finally {
    clearTimeout(timeout);
    running.delete(id);
  }
  schedule.lastRunAt = new Date().toISOString();
  schedule.lastConversationId = conversationId;
  await persist(schedules);
  await appendConversation(workspace, {
    id: conversationId,
    title: `◷ ${schedule.title}`,
    createdAt: Date.now(),
    messages: [{ role: "user", content: schedule.prompt }, { role: "assistant", content: answer }],
  });
  return { schedule, conversationId, workspace, answer };
}

function install(schedules: CronSchedule[]): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (let schedule of schedules.filter((item) => item.enabled)) {
    const arm = () =>
      timers.set(
        schedule.id,
        setTimeout(async () => {
          try {
            await execute(schedule.id);
          } catch (error) {
            console.error(`[cron:${schedule.id}]`, error);
          }
          const latest = (await read()).find((item) => item.id === schedule.id);
          if (latest?.enabled) {
            schedule = latest;
            arm();
          }
        }, Math.max(1_000, nextRun(schedule).getTime() - Date.now())),
      );
    arm();
  }
  loaded = true;
}

async function ensure(): Promise<void> {
  if (!loaded) install(await read());
}
export async function listCronSchedules(): Promise<CronSchedule[]> {
  await ensure();
  return (await read()).map((item) => ({
    ...item,
    nextRunAt: item.enabled ? nextRun(item).toISOString() : undefined,
  }));
}
export async function saveCronSchedules(value: unknown): Promise<CronSchedule[]> {
  const schedules = validate(value);
  for (const item of schedules) {
    if (item.workspace && !(await Deno.stat(item.workspace)).isDirectory) {
      throw new Error(`绑定项目已失效：${item.workspace}`);
    }
  }
  await persist(schedules);
  install(schedules);
  return await listCronSchedules();
}
export async function runCronSchedule(id: string) {
  await ensure();
  return await execute(id);
}
