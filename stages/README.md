# Deno Agent：从一个循环到生产级 Harness

`stages/` 是一套可运行、可修改、可观察的 Harness Engineering 课程。模型负责判断下一步，Harness
提供工具、知识、状态、权限、协议和运行边界。

> Agent 产品 = 模型 + Harness。

课程组织借鉴 [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code)
的章节风格：每章都是独立目录，包含完整叙事与可运行代码。本项目使用
Deno/TypeScript，并把学习路线继续扩展到生产运行时、评估、安全、部署和验收。

## 目录约定

```text
stages/
├── README.md
├── s01_agent_loop/
│   ├── README.md     # 问题、方案、机制、观察、练习和生产差距
│   ├── code.ts       # 本章可运行实现
│   └── images/       # 本章执行链或状态图（SVG）
├── s02_tool_use/
│   ├── README.md
│   └── code.ts
└── ... s40_cognitive_workspace/
```

不再维护独立的 `tutorials/`：教程和源码放在同一课程目录，避免链接、编号和内容演进不同步。

每章 README 都嵌入 `images/overview.svg`。图示是代码阅读的入口：先看箭头上的输入、边界和证据，再回到
`code.ts` 找对应的类型、Handler 或状态转移。

## 学习路线

### 第一部分：让 Agent 能行动（s01–s10）

建立 Agent Loop、工具、权限、Hook、计划、委派、技能、压缩、记忆和 Prompt 组装。

### 第二部分：让 Agent 能长期协作（s11–s20）

加入恢复、持久任务、后台执行、调度、团队协议、自治、Worktree、MCP，并汇入单一 Harness。

### 第三部分：把机制收紧为生产系统（s21–s30）

把预算、Trace、工具策略、任务恢复、Worker、MCP、A2A、Memory、Research 和 Eval 变成可执行约束。

### 第四部分：完成安全、部署与验收闭环（s31–s40）

覆盖身份与 DLP、认知控制、部署拓扑、发布回滚、Provider 路由、红队、可观测性、产品流和架构总验收。

## 如何学习

1. 进入课程目录，先读 `README.md`，明确本章解决的问题。
2. 运行 `deno task sXX`，观察工具、事件、状态或 Gate 的实际变化。
3. 修改一个预算、策略或失败条件，再运行 `deno check stages/sXX_name/code.ts`。
4. 完成 README 的练习，并用自己的话画出执行链。
5. 若迁移到产品代码，围绕生产契约重新设计，绝不从 `src/` 或 `desktop/` 直接导入课程。

## 课程地图

| 阶段 | 主题                                                             | 本课原则                                      |
| ---- | ---------------------------------------------------------------- | --------------------------------------------- |
| s01  | [Agent Loop](s01_agent_loop/README.md)                           | 一个工具和一个循环构成最小 Agent              |
| s02  | [Tool Use](s02_tool_use/README.md)                               | 能力经由 Registry 注册，不改主循环            |
| s03  | [Permission](s03_permission/README.md)                           | 模型请求动作，Harness 决定是否授权            |
| s04  | [Hooks](s04_hooks/README.md)                                     | 扩展点挂在生命周期上                          |
| s05  | [TodoWrite](s05_todo_write/README.md)                            | 短期计划让进度可见                            |
| s06  | [Subagent](s06_subagent/README.md)                               | 聚焦子任务使用干净上下文                      |
| s07  | [Skill Loading](s07_skill_loading/README.md)                     | 知识按需发现和加载                            |
| s08  | [Context Compact](s08_context_compact/README.md)                 | 压缩成本，但保留目标和证据                    |
| s09  | [Memory](s09_memory/README.md)                                   | 只保存跨会话有价值的事实                      |
| s10  | [System Prompt](s10_system_prompt/README.md)                     | Prompt 是可测试的运行时组装结果               |
| s11  | [Error Recovery](s11_error_recovery/README.md)                   | 先分类，再有限恢复                            |
| s12  | [Task Graph](s12_persistent_task_graph/README.md)                | 长期目标用持久依赖图表达                      |
| s13  | [Background Tasks](s13_background_tasks/README.md)               | 慢操作离开关键路径                            |
| s14  | [Cron Scheduling](s14_cron_scheduling/README.md)                 | Scheduler 唤醒同一个 Agent Loop               |
| s15  | [Agent Teams](s15_agent_teams/README.md)                         | 独立专家并行，保留部分成功                    |
| s16  | [Team Protocol](s16_team_protocol/README.md)                     | 协作消息必须结构化和可路由                    |
| s17  | [Bounded Autonomy](s17_autonomous_agent/README.md)               | 自治是有成功标准的反馈循环                    |
| s18  | [Git Worktree](s18_git_worktree/README.md)                       | 用独立目录隔离并行修改                        |
| s19  | [MCP Plugins](s19_mcp_plugins/README.md)                         | 外部协议能力仍受本地权限约束                  |
| s20  | [Comprehensive Harness](s20_comprehensive/README.md)             | 机制很多，主循环只有一个                      |
| s21  | [Production Runtime](s21_bounded_runtime/README.md)              | 预算和取消必须真实可执行                      |
| s22  | [Structured Trace](s22_structured_tracing/README.md)             | Schema 与 Trace 贯穿所有边界                  |
| s23  | [Tool Policy](s23_evaluation_feedback/README.md)                 | 职责、范围、身份和输出共同守边界              |
| s24  | [Task State & Replay](s24_retrieval_augmented_memory/README.md)  | 从证据恢复，避免重复副作用                    |
| s25  | [Worker Workloads](s25_planner_executor_verifier/README.md)      | Lease、Retry 与 Dead Letter 管长任务          |
| s26  | [MCP Management](s26_mcp_capability_negotiation/README.md)       | Session 生命周期与 Transport 分离             |
| s27  | [A2A Handoff](s27_handoff_guardrails/README.md)                  | 交接角色、范围、证据和有界权限                |
| s28  | [RAG & Memory Service](s28_checkpoint_resume/README.md)          | 检索先于 Prompt，删除必须可证明               |
| s29  | [Grounded Research](s29_cognitive_monitor/README.md)             | 来源不足时说不知道并升级                      |
| s30  | [Evaluation CI](s30_production_readiness/README.md)              | 回归与负例决定是否晋级                        |
| s31  | [Security Boundary](s31_structured_io/README.md)                 | 身份、沙箱、出口和 DLP 在执行时强制           |
| s32  | [Cognitive Control](s32_reasoning_strategies/README.md)          | 认知信号选择 act、retrieve、pivot 或 escalate |
| s33  | [Deployment Topology](s33_flow_handoff_guardrails/README.md)     | 延迟决定 WebSocket、SSE 或 Queue              |
| s34  | [Release AIOps](s34_hybrid_rag/README.md)                        | Canary、SLO 与 Rollback 属于一条门禁          |
| s35  | [Production Acceptance](s35_evaluation_feedback/README.md)       | 每次迁移都需要完整证据矩阵                    |
| s36  | [Provider Routing](s36_deploy_worker_queue/README.md)            | 按能力、质量、延迟、成本和故障路由            |
| s37  | [Security Assurance](s37_security_governance/README.md)          | 红队负例是发布条件                            |
| s38  | [Observability](s38_cost_latency_routing/README.md)              | Trace、成本和 SLO 驱动 AIOps                  |
| s39  | [Evidence-first Product Flow](s39_loop_control_replay/README.md) | 窄职责 Agent 通过证据流组合                   |
| s40  | [Architecture Capstone](s40_cognitive_workspace/README.md)       | 六层验收收束完整生产架构                      |

## 快速开始

```sh
# 最小 Agent Loop
deno task s01

# 前二十课综合 Harness
deno task s20

# 完整四十课终点
deno task s40
```

课程任务可能调用模型、Shell、文件系统或外部协议。请先配置项目要求的 Provider
凭据，并在测试工作区中运行涉及写入、后台进程或 Worktree 的课程。

## 教学代码与生产代码的边界

课程代码为了突出单一机制，会使用内存 Map、简化向量、占位证据和紧凑协议。生产实现必须通过
`AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和 `HarnessFeature` 重新设计。

架构变更后必须确认：

```sh
rg 'stages/' src desktop
```

命令应无匹配。课程完成代表理解机制，不代表已经通过生产迁移、桌面打包或目标操作系统运行验收。
