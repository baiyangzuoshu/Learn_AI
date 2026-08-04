# Deno Agent 分阶段课程

`stages/` 是从最小 Agent Loop
演进到生产级智能体能力的教学代码。每一阶段都在上一阶段基础上增加一个核心概念，但生产代码只存在于
`src/` 与 `desktop/`，不得直接依赖这里的实现。

## 学习方式

1. 先阅读对应教程，明确本阶段新增能力。
2. 对照 `.ts` 源码寻找教程中提到的类型、工具和事件。
3. 使用 `deno task sXX` 运行阶段。
4. 完成教程末尾练习，再进入下一阶段。

运行阶段需要配置模型 API Key；只阅读代码或运行 `deno task check` 不需要发起模型请求。

## 课程索引

| 阶段 | 主题                       | 教程                                                |
| ---- | -------------------------- | --------------------------------------------------- |
| s01  | Agent Loop                 | [教程](tutorials/s01_agent_loop.md)                 |
| s02  | Tool Use                   | [教程](tutorials/s02_tool_use.md)                   |
| s03  | Permission                 | [教程](tutorials/s03_permission.md)                 |
| s04  | Hooks                      | [教程](tutorials/s04_hooks.md)                      |
| s05  | Todo                       | [教程](tutorials/s05_todo_write.md)                 |
| s06  | Subagent                   | [教程](tutorials/s06_subagent.md)                   |
| s07  | Skill Loading              | [教程](tutorials/s07_skill_loading.md)              |
| s08  | Context Compact            | [教程](tutorials/s08_context_compact.md)            |
| s09  | Memory                     | [教程](tutorials/s09_memory.md)                     |
| s10  | System Prompt              | [教程](tutorials/s10_system_prompt.md)              |
| s11  | Error Recovery             | [教程](tutorials/s11_error_recovery.md)             |
| s12  | Persistent Task Graph      | [教程](tutorials/s12_persistent_task_graph.md)      |
| s13  | Background Tasks           | [教程](tutorials/s13_background_tasks.md)           |
| s14  | Cron Scheduling            | [教程](tutorials/s14_cron_scheduling.md)            |
| s15  | Agent Teams                | [教程](tutorials/s15_agent_teams.md)                |
| s16  | Team Protocol              | [教程](tutorials/s16_team_protocol.md)              |
| s17  | Autonomous Agent           | [教程](tutorials/s17_autonomous_agent.md)           |
| s18  | Git Worktree               | [教程](tutorials/s18_git_worktree.md)               |
| s19  | MCP Plugins                | [教程](tutorials/s19_mcp_plugins.md)                |
| s20  | Comprehensive Harness      | [教程](tutorials/s20_comprehensive.md)              |
| s21  | Bounded Runtime            | [教程](tutorials/s21_bounded_runtime.md)            |
| s22  | Structured Tracing         | [教程](tutorials/s22_structured_tracing.md)         |
| s23  | Evaluation and Feedback    | [教程](tutorials/s23_evaluation_feedback.md)        |
| s24  | Retrieval-Augmented Memory | [教程](tutorials/s24_retrieval_augmented_memory.md) |
| s25  | Planner–Executor–Verifier  | [教程](tutorials/s25_planner_executor_verifier.md)  |
| s26  | MCP Capability Negotiation | [教程](tutorials/s26_mcp_capability_negotiation.md) |
| s27  | Handoff Guardrails         | [教程](tutorials/s27_handoff_guardrails.md)         |
| s28  | Checkpoint and Resume      | [教程](tutorials/s28_checkpoint_resume.md)          |
| s29  | Cognitive Monitor          | [教程](tutorials/s29_cognitive_monitor.md)          |
| s30  | Production Readiness       | [教程](tutorials/s30_production_readiness.md)       |
