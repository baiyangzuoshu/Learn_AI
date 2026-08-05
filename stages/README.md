# Deno Agent：从一个循环到生产级 Harness

`stages/` 是一套可运行、可修改、可观察的 Agent Harness 课程。模型决定下一步，Harness
提供工具、状态、协议、权限和运行边界。

> Agent 产品 = 模型 + Harness。

## 学习路线

### 第一部分：工具、上下文与边界（s01–s10）

从最小 Agent Loop 开始，建立工具注册、权限、Hook、计划、子 Agent、技能、上下文压缩、记忆和 Prompt
组装的基础。

### 第二部分：持久任务与协作（s11–s20）

加入错误恢复、任务图、后台任务、调度、团队协议、自治、Worktree 和 MCP，并在 s20 汇入单一 Harness。

### 第三部分：生产级 Agent 系统（s21–s40）

原 `s21–s90`
已合并为二十门整合课程：Runtime、Trace、工具安全、长任务、Worker、MCP、A2A、Memory、Deep
Research、评估、安全、认知、部署、发布和生产验收。它们仍只作为教学行为参考，不直接进入 `src/`。

## 如何学习

1. 阅读教程，理解问题、边界和生产差距。
2. 执行 `deno task sXX` 或 `deno run ... stages/sXX_*.ts`。
3. 修改一个预算、策略或失败条件，并运行 `deno check stages/sXX_*.ts`。
4. 完成后将行为映射为生产 `HarnessFeature`，不要从 `src/` 或 `desktop/` 导入课程代码。

## 课程地图

| 阶段 | 本课原则                                        | 教程                                                            |
| ---- | ----------------------------------------------- | --------------------------------------------------------------- |
| s01  | 一个工具和一个循环构成最小 Agent                | [Agent Loop](tutorials/s01_agent_loop.md)                       |
| s02  | 能力经由工具池注册，不改主循环                  | [Tool Use](tutorials/s02_tool_use.md)                           |
| s03  | 先划权限边界，再给行动自由                      | [Permission](tutorials/s03_permission.md)                       |
| s04  | 扩展点挂在循环上                                | [Hooks](tutorials/s04_hooks.md)                                 |
| s05  | 计划把目标变成进度                              | [TodoWrite](tutorials/s05_todo_write.md)                        |
| s06  | 子 Agent 隔离上下文                             | [Subagent](tutorials/s06_subagent.md)                           |
| s07  | 技能按需发现和加载                              | [Skill Loading](tutorials/s07_skill_loading.md)                 |
| s08  | 历史可以压缩，意图不能丢失                      | [Context Compact](tutorials/s08_context_compact.md)             |
| s09  | 只保留跨会话有价值的事实                        | [Memory](tutorials/s09_memory.md)                               |
| s10  | Prompt 是有优先级的组装结果                     | [System Prompt](tutorials/s10_system_prompt.md)                 |
| s11  | 错误是分类和恢复的输入                          | [Error Recovery](tutorials/s11_error_recovery.md)               |
| s12  | 长任务需要持久化依赖图                          | [Task Graph](tutorials/s12_persistent_task_graph.md)            |
| s13  | 慢操作脱离主循环                                | [Background Tasks](tutorials/s13_background_tasks.md)           |
| s14  | Scheduler 唤醒，Agent 判断                      | [Cron Scheduling](tutorials/s14_cron_scheduling.md)             |
| s15  | 团队依靠身份、状态和邮箱                        | [Agent Teams](tutorials/s15_agent_teams.md)                     |
| s16  | 协作消息必须机器可验证                          | [Team Protocol](tutorials/s16_team_protocol.md)                 |
| s17  | 看板支持自主认领                                | [Autonomous Agent](tutorials/s17_autonomous_agent.md)           |
| s18  | Worktree 隔离文件                               | [Git Worktree](tutorials/s18_git_worktree.md)                   |
| s19  | MCP 接入外部能力                                | [MCP Plugins](tutorials/s19_mcp_plugins.md)                     |
| s20  | 机制很多，主循环只有一个                        | [Comprehensive Harness](tutorials/s20_comprehensive.md)         |
| s21  | Runtime 预算与取消必须可执行                    | [Production Runtime](tutorials/s21_bounded_runtime.md)          |
| s22  | Schema 与 Trace 贯穿边界                        | [Structured Trace](tutorials/s22_structured_tracing.md)         |
| s23  | 工具契约和权限共同守住执行面                    | [Tool Policy](tutorials/s23_evaluation_feedback.md)             |
| s24  | 任务状态、检查点和重放必须有证据                | [Task State](tutorials/s24_retrieval_augmented_memory.md)       |
| s25  | 后台、调度和 Worker 使用 Lease                  | [Worker Workloads](tutorials/s25_planner_executor_verifier.md)  |
| s26  | MCP 是可管理的协议 Session                      | [MCP Management](tutorials/s26_mcp_capability_negotiation.md)   |
| s27  | A2A Handoff 传递角色、证据和边界                | [A2A Teams](tutorials/s27_handoff_guardrails.md)                |
| s28  | RAG 和 Memory 是独立长期服务                    | [Memory Service](tutorials/s28_checkpoint_resume.md)            |
| s29  | Research 必须 Grounded 并可升级                 | [Deep Research](tutorials/s29_cognitive_monitor.md)             |
| s30  | 评估、反馈和 CI 决定是否晋级                    | [Evaluation CI](tutorials/s30_production_readiness.md)          |
| s31  | 身份、沙箱、出口和 DLP 在运行时执行             | [Security Boundary](tutorials/s31_structured_io.md)             |
| s32  | 认知信号路由推理、检索和升级                    | [Cognitive Control](tutorials/s32_reasoning_strategies.md)      |
| s33  | 延迟决定 API、SSE、实时或 Worker 拓扑           | [Deployment Topology](tutorials/s33_flow_handoff_guardrails.md) |
| s34  | Release、Canary、Rollback 和 AIOps 同属一条门禁 | [Release AIOps](tutorials/s34_hybrid_rag.md)                    |
| s35  | 每次迁移都必须有生产验收证据                    | [Production Acceptance](tutorials/s35_evaluation_feedback.md)   |
| s36  | Provider 按能力、质量、成本和故障路由           | [Provider Routing](tutorials/s36_deploy_worker_queue.md)        |
| s37  | 红队负例是安全发布条件                          | [Security Assurance](tutorials/s37_security_governance.md)      |
| s38  | Trace、成本和 SLO 驱动 AIOps                    | [Observability](tutorials/s38_cost_latency_routing.md)          |
| s39  | 产品由窄职责 Agent 和证据流组成                 | [Product Flow](tutorials/s39_loop_control_replay.md)            |
| s40  | 六层验收收束完整生产 Agent 架构                 | [Architecture Capstone](tutorials/s40_cognitive_workspace.md)   |

## 教学代码与生产代码的边界

阶段代码为了突出机制会使用内存 Map、占位向量和简化协议。生产实现必须通过
`AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和 `HarnessFeature`
重新设计；完成迁移后，`rg 'stages/' src desktop` 必须没有匹配。
