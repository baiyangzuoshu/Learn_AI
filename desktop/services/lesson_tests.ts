import { harness } from "../../src/mod.ts";
import { compactHistory } from "../../src/context.ts";
import { authorize } from "../../src/permissions.ts";
import { ProviderError } from "../../src/providers/openai_compatible.ts";
import { runRuntimeBudgetAcceptance } from "./acceptance.ts";

export interface LessonTestCase {
  lesson: number;
  id: string;
  title: string;
  description: string;
  run: () => Promise<void> | void;
}

export interface LessonTestResult {
  lesson: number;
  id: string;
  title: string;
  status: "passed" | "failed";
  durationMs: number;
  detail?: string;
}

export interface LessonTestReport {
  suite: "21test-lessons";
  ok: boolean;
  passed: number;
  failed: number;
  results: LessonTestResult[];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = "values differ"): void {
  if (Object.is(actual, expected)) return;
  throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertTools(...names: string[]): void {
  const available = new Set(harness.tools.names());
  const missing = names.filter((name) => !available.has(name));
  assert(!missing.length, `missing tools: ${missing.join(", ")}`);
}

function lesson(
  number: number,
  title: string,
  description: string,
  run: () => Promise<void> | void,
): LessonTestCase {
  return {
    lesson: number,
    id: `21test-${String(number).padStart(2, "0")}`,
    title,
    description,
    run,
  };
}

export const lessonTestCases: readonly LessonTestCase[] = [
  lesson(1, "Agent Loop", "验证生产 Harness 暴露单一 AgentRuntime 入口。", () => {
    assert(typeof harness.run === "function", "AgentRuntime.run is unavailable");
  }),
  lesson(2, "Tool Use", "验证核心文件和 Shell 工具已注册。", () => {
    assertTools("bash", "read_file", "write_file", "edit_file");
  }),
  lesson(3, "Permission", "验证危险 Shell 命令在 auto 模式下被拒绝。", async () => {
    let denied = false;
    try {
      await authorize({ name: "bash", input: { command: "rm -rf /" } }, "auto");
    } catch {
      denied = true;
    }
    assert(denied, "dangerous command was not denied");
  }),
  lesson(4, "Hooks", "验证 Hook 所需的稳定系统提示区段已组装。", () => {
    const prompt = harness.prompts.build(process.cwd());
    const ids = prompt.sections.map((section) => section.id);
    assertEquals(new Set(ids).size, ids.length, "prompt section ids must be unique");
    assert(ids.includes("contract"), "contract prompt section missing");
  }),
  lesson(5, "TodoWrite", "验证临时任务工具已注册。", () => assertTools("todo_write")),
  lesson(6, "Subagent", "验证单任务委派工具已注册。", () => assertTools("subagent")),
  lesson(7, "Skill Loading", "验证 Skill 发现和按需加载工具已注册。", () => {
    assertTools("list_skills", "load_skill");
  }),
  lesson(8, "Context Compact", "验证长历史会话会触发压缩。", () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? "assistant" as const : "user" as const,
      content: `message-${index} ${"x".repeat(3_000)}`,
    }));
    const result = compactHistory(history);
    assert(result.compacted, "history did not compact");
    assert(result.after < result.before, "compaction did not reduce content");
  }),
  lesson(9, "Memory", "验证跨会话 Memory 工具已注册。", () => {
    assertTools("memory_read", "memory_append", "memory_replace");
  }),
  lesson(10, "System Prompt", "验证系统提示可由 Feature 动态组装。", () => {
    const prompt = harness.prompts.build(process.cwd());
    assert(prompt.prompt.includes("AI Agent"), "identity prompt missing");
    assert(prompt.sections.length >= 5, "too few prompt sections");
  }),
  lesson(11, "Error Recovery", "验证 Provider 错误包含可重试分类。", () => {
    const error = new ProviderError("temporary", 503, true, 100);
    assert(error.retryable, "retryable provider error lost classification");
    assertEquals(error.retryAfterMs, 100);
  }),
  lesson(12, "Task Graph", "验证持久化任务图读写工具已注册。", () => {
    assertTools("task_graph_read", "task_graph_write");
  }),
  lesson(13, "Background Tasks", "验证后台任务启动、查询和取消工具已注册。", () => {
    assertTools("background_start", "background_status", "background_cancel");
  }),
  lesson(14, "Cron Scheduling", "验证周期对话调度工具已注册。", () => {
    assertTools("cron_list", "cron_write", "cron_run_now");
  }),
  lesson(15, "Agent Teams", "验证并行 Team 编排工具已注册。", () => assertTools("team_run")),
  lesson(16, "Team Protocol", "验证 Team 消息收发工具已注册。", () => {
    assertTools("team_send", "team_inbox");
  }),
  lesson(17, "Autonomous Agent", "验证自治循环工具已注册。", () => assertTools("autonomous_run")),
  lesson(18, "Git Worktree", "验证隔离 Worktree 工具已注册。", () => {
    assertTools("worktree_create", "worktree_list", "worktree_agent", "worktree_remove");
  }),
  lesson(19, "MCP Plugins", "验证 MCP 发现和调用工具已注册。", () => {
    assertTools("mcp_servers", "mcp_list_tools", "mcp_call");
  }),
  lesson(27, "A2A Handoff", "验证租户隔离、证据交接和终态约束工具已注册。", () => {
    assertTools("handoff_submit", "agent_handoff", "handoff_complete", "handoff_status");
  }),
  lesson(28, "RAG Memory", "验证租户记忆检索、引用和 tombstone 工具已注册。", () => {
    assertTools(
      "memory_store",
      "memory_search",
      "memory_tombstone",
      "memory_status",
      "memory_migrate_legacy",
    );
  }),
  lesson(29, "Grounded Research", "验证研究任务、来源引用、置信度和升级工具已注册。", () => {
    assertTools("research_start", "research_add_source", "grounded_research", "research_status");
  }),
  lesson(30, "Evaluation CI", "验证版本化数据集、引用覆盖率和发布 Gate 工具已注册。", () => {
    assertTools("evaluation_gate", "evaluation_status");
  }),
  lesson(20, "Comprehensive Harness", "验证 1–20 机制汇聚到同一个工具池。", () => {
    assert(harness.tools.names().length >= 30, "complete harness tool registry is incomplete");
  }),
  lesson(21, "Production Runtime", "运行完整 RuntimeBudget 验收用例。", async () => {
    const report = await runRuntimeBudgetAcceptance();
    assert(
      report.ok,
      report.results.filter((result) => result.status === "failed").map((result) => result.detail)
        .join("; "),
    );
  }),
];

export function listLessonTests() {
  return lessonTestCases.map(({ run: _run, ...test }) => test);
}

export async function runLessonAcceptance(lessonNumber?: number): Promise<LessonTestReport> {
  const selected = lessonNumber === undefined
    ? lessonTestCases
    : lessonTestCases.filter((test) => test.lesson === lessonNumber);
  if (!selected.length) throw new Error("lesson must be an integer from 1 to 30");

  const results: LessonTestResult[] = [];
  for (const test of selected) {
    const startedAt = performance.now();
    try {
      await test.run();
      results.push({
        lesson: test.lesson,
        id: test.id,
        title: test.title,
        status: "passed",
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      results.push({
        lesson: test.lesson,
        id: test.id,
        title: test.title,
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const passed = results.filter((result) => result.status === "passed").length;
  return {
    suite: "21test-lessons",
    ok: passed === results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
