# Deno Agent：从一个循环到生产级 Harness

`stages/` 是一套可以运行、可以修改、可以观察的 Agent Harness
课程。它不负责训练模型，而是逐步搭建模型工作的环境：工具、知识、上下文、权限、持久化、协作和运行治理。

> **核心公式：Agent 产品 = 模型 + Harness。**
>
> 模型负责判断下一步做什么；Harness
> 负责把环境描述给模型、执行动作、返回观察结果，并保证所有动作处于可控边界内。

## 先建立正确的心智模型

最小 Agent 并不需要复杂工作流。它只有一个循环：

```text
用户任务 → messages → 大模型
                       │
             ┌─────────┴─────────┐
             │普通文本           │工具调用
             ▼                   ▼
          返回用户          本地执行工具
                                  │
                           tool result
                                  │
                                  └──→ 追加到 messages，再问模型
```

代码没有替模型推理。`if/else`、计划、权限和调度都是 Harness
机制，用来扩大模型可观察、可行动的范围，并约束风险。30 个阶段始终围绕同一个循环演进。

## 三段学习路线

### 第一部分：让模型拥有双手和边界（s01–s10）

从最小循环开始，依次加入工具注册、权限、Hook、计划、子
Agent、技能、上下文压缩、长期记忆和可组合系统提示。完成后，你将理解一次交互为何能变成多步骤任务执行。

### 第二部分：让 Agent 长期运行并协作（s11–s20）

加入错误恢复、持久化任务图、后台任务、定时调度、团队邮箱、通信协议、自组织领取、Git worktree 隔离和
MCP。s20 把这些机制重新汇入一个 Harness。

### 第三部分：让系统可观测、可评估、可恢复（s21–s30）

生产系统不能依赖模型“自己停下来”或“应该没问题”。这一部分增加预算、追踪、评测、检索、计划验证、能力协商、交接契约、检查点、认知门控与上线清单。

### 第四部分：完成教学闭环，再考虑生产接入（s31–s40）

这一部分把书中尚未完整展开的能力拆成独立实验：结构化 I/O、推理策略、Flow 与交接、混合
RAG、评测反馈、部署队列、安全治理、成本路由、循环控制和认知工作区。它们全部停留在
`stages/`，用于理解协议与边界；完成练习并通过回归后，才逐项设计生产 Feature。

### 第五部分：跨 Agent、认知与运营综合（s41–s50）

这一部分补齐 MCP 服务端与传输、A2A、Sequential Thinking、语义/情景/程序记忆、Deep
Research、Phoenix/HITL、多 Agent 高级模式、实时部署、安全治理和完整 Cognitive Agent。课程仍然只修改
`stages/`；完成标志是能够解释每个模块的协议、状态和失败边界，而不是已经上线。

### 第六部分：真实协议、存储、运行时、评估与部署（s51–s60）

这一部分把 s41–s50 的概念推进为可测试的深度实装：逐行 MCP STDIO、A2A
HTTP、原子文件记忆、可取消研究运行时、重复评测、单一 Agent
Runtime、API/Queue/SSE、安全强制执行、模块化 Cognitive Runtime，以及 Release/SLO/Chaos
门禁。仍然不接入生产代码。

## 如何学习每一课

1. 阅读教程中的“问题”与“设计”，先理解为什么增加这一层。
2. 打开对应 `.ts`，沿教程给出的符号追踪调用链。
3. 执行 `deno task sXX`，给模型一个会触发本课机制的任务。
4. 修改练习中的一个约束，再运行 `deno check stages/sXX_*.ts`。
5. 思考教学实现和生产实现的差距。`stages/` 只能作为行为参考，生产代码仍应通过 `src/` 的
   Registry、Feature 和 Runtime 契约实现。

运行课程需要已配置模型 API Key；静态阅读和 `deno task check` 不会请求模型。

## 课程地图

| 阶段 | 本课原则                                     | 深入教程                                                                |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------- |
| s01  | 一个工具 + 一个循环，就是最小 Agent          | [Agent Loop](tutorials/s01_agent_loop.md)                               |
| s02  | 新能力注册进工具池，不改循环                 | [Tool Use](tutorials/s02_tool_use.md)                                   |
| s03  | 先划边界，再给行动自由                       | [Permission](tutorials/s03_permission.md)                               |
| s04  | 扩展点挂在循环上，不塞进循环里               | [Hooks](tutorials/s04_hooks.md)                                         |
| s05  | 计划把目标变成可观察的进度                   | [TodoWrite](tutorials/s05_todo_write.md)                                |
| s06  | 隔离上下文，汇总结果                         | [Subagent](tutorials/s06_subagent.md)                                   |
| s07  | 先发现、后加载，节省上下文                   | [Skill Loading](tutorials/s07_skill_loading.md)                         |
| s08  | 历史可以压缩，当前意图不能丢                 | [Context Compact](tutorials/s08_context_compact.md)                     |
| s09  | 只持久化跨会话仍有价值的事实                 | [Memory](tutorials/s09_memory.md)                                       |
| s10  | Prompt 是有优先级的组装结果                  | [System Prompt](tutorials/s10_system_prompt.md)                         |
| s11  | 错误是分类和恢复的输入                       | [Error Recovery](tutorials/s11_error_recovery.md)                       |
| s12  | 长任务需要持久化依赖图                       | [Persistent Task Graph](tutorials/s12_persistent_task_graph.md)         |
| s13  | 慢操作放后台，主循环继续工作                 | [Background Tasks](tutorials/s13_background_tasks.md)                   |
| s14  | 调度器负责唤醒，Agent 负责判断               | [Cron Scheduling](tutorials/s14_cron_scheduling.md)                     |
| s15  | 团队协作依靠身份、状态和邮箱                 | [Agent Teams](tutorials/s15_agent_teams.md)                             |
| s16  | 协作消息必须机器可验证                       | [Team Protocol](tutorials/s16_team_protocol.md)                         |
| s17  | 共享看板让队友自主认领任务                   | [Autonomous Agent](tutorials/s17_autonomous_agent.md)                   |
| s18  | 任务隔离目标，worktree 隔离文件              | [Git Worktree](tutorials/s18_git_worktree.md)                           |
| s19  | MCP 把远程能力接入统一工具池                 | [MCP Plugins](tutorials/s19_mcp_plugins.md)                             |
| s20  | 机制可以很多，主循环只能有一个               | [Comprehensive Harness](tutorials/s20_comprehensive.md)                 |
| s21  | 时间、调用数和输出都必须有上限               | [Bounded Runtime](tutorials/s21_bounded_runtime.md)                     |
| s22  | 没有结构化轨迹，就无法解释运行               | [Structured Tracing](tutorials/s22_structured_tracing.md)               |
| s23  | 没有评测反馈，就不知道改动是否变好           | [Evaluation](tutorials/s23_evaluation_feedback.md)                      |
| s24  | 记忆要按问题检索，不应全部塞进 Prompt        | [Retrieval Memory](tutorials/s24_retrieval_augmented_memory.md)         |
| s25  | 计划、执行、验证是三个不同责任               | [Planner–Executor–Verifier](tutorials/s25_planner_executor_verifier.md) |
| s26  | 先协商能力，再调用 MCP 方法                  | [Capability Negotiation](tutorials/s26_mcp_capability_negotiation.md)   |
| s27  | 交接传递目标、证据和权限，不传模糊期待       | [Handoff Guardrails](tutorials/s27_handoff_guardrails.md)               |
| s28  | 检查点让中断变成可恢复状态                   | [Checkpoint and Resume](tutorials/s28_checkpoint_resume.md)             |
| s29  | 自信不是证据，行动前需要门控                 | [Cognitive Monitor](tutorials/s29_cognitive_monitor.md)                 |
| s30  | 编译成功不等于生产就绪                       | [Production Readiness](tutorials/s30_production_readiness.md)           |
| s31  | 结构化输出必须先过 schema                    | [Structured I/O](tutorials/s31_structured_io.md)                        |
| s32  | 不同问题选择不同推理策略                     | [Reasoning Strategies](tutorials/s32_reasoning_strategies.md)           |
| s33  | Flow 路由与 handoff 契约要有护栏             | [Flow and Handoff](tutorials/s33_flow_handoff_guardrails.md)            |
| s34  | 检索、重排、引用共同构成 grounding           | [Hybrid RAG](tutorials/s34_hybrid_rag.md)                               |
| s35  | 评测结果必须进入反馈与回归集                 | [Evaluation Feedback](tutorials/s35_evaluation_feedback.md)             |
| s36  | API、队列、Worker 要用协议解耦               | [Worker Queue](tutorials/s36_deploy_worker_queue.md)                    |
| s37  | 安全是工具边界、身份和数据流的合约           | [Security Governance](tutorials/s37_security_governance.md)             |
| s38  | 模型路由是成本、延迟、质量的策略决策         | [Cost and Routing](tutorials/s38_cost_latency_routing.md)               |
| s39  | 每一层循环都需要停止、幂等与重放             | [Loop Control](tutorials/s39_loop_control_replay.md)                    |
| s40  | 有限认知工作区要持续监控并自适应             | [Cognitive Workspace](tutorials/s40_cognitive_workspace.md)             |
| s41  | MCP 服务端要分离能力与传输                   | [MCP Server and Transports](tutorials/s41_mcp_server_transports.md)     |
| s42  | A2A 需要 Agent Card、任务状态和 Artifact     | [A2A Protocol](tutorials/s42_a2a_protocol.md)                           |
| s43  | Sequential Thinking 是受控 scratchpad        | [Sequential Thinking](tutorials/s43_sequential_thinking.md)             |
| s44  | 记忆要区分语义、情景和程序经验               | [Memory Architecture](tutorials/s44_memory_architecture.md)             |
| s45  | Deep Research 需要外部状态与综合步骤         | [Deep Research Loop](tutorials/s45_deep_research_loop.md)               |
| s46  | Trace 要进入数据集、实验和人工反馈           | [Phoenix and HITL](tutorials/s46_phoenix_human_feedback.md)             |
| s47  | 多 Agent 模式要显式比较协调与共识            | [Multi-agent Patterns](tutorials/s47_multi_agent_patterns.md)           |
| s48  | 部署方式由通信延迟和任务生命周期决定         | [Realtime Deployment](tutorials/s48_realtime_deployment.md)             |
| s49  | 身份、沙箱、出口和 DLP 共同形成安全边界      | [Identity and Egress](tutorials/s49_identity_sandbox_egress.md)         |
| s50  | Cognitive Agent 要把模块组合成可测闭环       | [Cognitive Capstone](tutorials/s50_cognitive_capstone.md)               |
| s51  | MCP STDIO 要有真实 JSON-RPC 会话             | [MCP STDIO Runtime](tutorials/s51_mcp_stdio_runtime.md)                 |
| s52  | A2A HTTP 要有发现、任务和状态迁移            | [A2A HTTP Runtime](tutorials/s52_a2a_http_runtime.md)                   |
| s53  | Memory 要版本化、原子持久化和可删除          | [Persistent Memory](tutorials/s53_persistent_memory_store.md)           |
| s54  | Research Runtime 要可取消、可恢复、并行      | [Research Runtime](tutorials/s54_research_runtime.md)                   |
| s55  | 评测要重复运行并阻断回归                     | [Evaluation Harness](tutorials/s55_evaluation_harness.md)               |
| s56  | Agent Runtime 统一循环、预算和事件           | [Agent Runtime](tutorials/s56_agent_runtime.md)                         |
| s57  | API、Queue、Worker、SSE 要可组合             | [Deploy Service](tutorials/s57_deploy_service.md)                       |
| s58  | 安全策略必须在执行时强制                     | [Security Runtime](tutorials/s58_security_runtime.md)                   |
| s59  | Cognitive 模块要通过 workspace 协同          | [Cognitive Runtime](tutorials/s59_cognitive_runtime.md)                 |
| s60  | Release、SLO 和 Chaos 决定能否迁移生产       | [Release Chaos](tutorials/s60_release_chaos.md)                         |
| s61  | MCP 客户端要通过真实契约完成互操作           | [MCP Interop Harness](tutorials/s61_mcp_interop_harness.md)             |
| s62  | A2A 网络任务必须认证、幂等、可迁移           | [A2A Network Runtime](tutorials/s62_a2a_network_runtime.md)             |
| s63  | Memory 数据库要可迁移、可事务、可删除        | [Memory Database](tutorials/s63_memory_database.md)                     |
| s64  | Provider 适配器必须受 Runtime 统一治理       | [Provider Agent Runtime](tutorials/s64_provider_agent_runtime.md)       |
| s65  | Research Worker 要能重试、恢复并引用证据     | [Research Worker](tutorials/s65_research_worker_runtime.md)             |
| s66  | Trace、评估和人工反馈要形成闭环              | [Observability Evaluation](tutorials/s66_observability_evaluation.md)   |
| s67  | Durable Queue 把接入和 Worker 可靠解耦       | [Durable Deploy Runtime](tutorials/s67_durable_deploy_runtime.md)       |
| s68  | 安全策略必须在身份、沙箱和出口处执行         | [Security Policy Runtime](tutorials/s68_security_policy_runtime.md)     |
| s69  | 六个认知模块要接入真实 Agent Runtime         | [Cognitive Integration](tutorials/s69_cognitive_integration.md)         |
| s70  | Canary、Rollback 和 Chaos 组成发布总门禁     | [Release Orchestrator](tutorials/s70_release_orchestrator.md)           |
| s71  | Runtime 必须强制迭代、工具、输出和成本上限   | [Runtime Guardrails](tutorials/s71_runtime_guardrails.md)               |
| s72  | Schema 校验与 Trace Context 贯穿所有边界     | [Schema and Trace](tutorials/s72_schema_trace_context.md)               |
| s73  | MCP 协议状态必须独立于 STDIO/HTTP 传输       | [MCP Transport](tutorials/s73_mcp_transport_runtime.md)                 |
| s74  | A2A 服务要持久化任务、Artifact 和事件        | [A2A Service](tutorials/s74_a2a_service_runtime.md)                     |
| s75  | Memory Service 提供租户隔离与混合检索        | [Memory Service](tutorials/s75_memory_service.md)                       |
| s76  | Evaluation、Grounding 与 OTel 必须可回放     | [Eval and OTel](tutorials/s76_eval_otel_runtime.md)                     |
| s77  | Scheduler 要用 Lease、重试和 Dead Letter     | [Durable Scheduler](tutorials/s77_durable_scheduler_runtime.md)         |
| s78  | IAM、沙箱、出口和 DLP 在执行时强制           | [IAM and Sandbox](tutorials/s78_iam_sandbox_runtime.md)                 |
| s79  | Cognitive Loop 要接入生产 Workspace          | [Production Cognitive](tutorials/s79_cognitive_production_runtime.md)   |
| s80  | AIOps 用指标、告警和 Runbook 闭合发布闭环    | [AIOps Release](tutorials/s80_aiops_release_runtime.md)                 |
| s81  | 所有生产能力必须进入唯一 Runtime             | [Production Runtime](tutorials/s81_production_runtime_adapter.md)       |
| s82  | Provider 按能力、质量、延迟和成本路由        | [Provider Routing](tutorials/s82_provider_routing.md)                   |
| s83  | MCP 子进程必须可复用、可取消、可关闭         | [MCP Process Manager](tutorials/s83_mcp_process_manager.md)             |
| s84  | A2A Gateway 负责发现、路由和任务恢复         | [A2A Gateway](tutorials/s84_a2a_gateway.md)                             |
| s85  | Memory 必须按应用路径原子持久化              | [Memory Persistence](tutorials/s85_memory_persistence.md)               |
| s86  | 评估流水线要保留 Trace、Grounding 和人工反馈 | [Evaluation Pipeline](tutorials/s86_eval_pipeline.md)                   |
| s87  | Worker 要用 Lease、Ack、Retry 和 Dead Letter | [Worker Orchestrator](tutorials/s87_worker_orchestrator.md)             |
| s88  | 安全能力必须用威胁模型和负例证明             | [Security Assurance](tutorials/s88_security_assurance.md)               |
| s89  | Cognitive 模块要接入生产主循环               | [Cognitive Adapter](tutorials/s89_cognitive_adapter.md)                 |
| s90  | 生产迁移必须通过统一验收门禁                 | [Production Acceptance](tutorials/s90_production_acceptance.md)         |

## 教学代码与生产代码的边界

阶段代码会为了突出单一概念而简化：例如用字符数近似 token、用进程内 Map
代替数据库、用词项重叠代替向量检索。它们展示的是机制和边界，不是可以直接复制上线的模块。

生产实现位于 `src/` 和 `desktop/`。完成一课后，可以寻找它在生产架构中的对应物：`AgentRuntime`
承载唯一循环，`ToolRegistry` 和 `PromptRegistry` 负责扩展，`HarnessFeature`
组织可移除能力，`scheduler.ts` 管理计划执行，`providers/` 处理模型差异。
