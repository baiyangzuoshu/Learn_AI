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

## 如何学习每一课

1. 阅读教程中的“问题”与“设计”，先理解为什么增加这一层。
2. 打开对应 `.ts`，沿教程给出的符号追踪调用链。
3. 执行 `deno task sXX`，给模型一个会触发本课机制的任务。
4. 修改练习中的一个约束，再运行 `deno check stages/sXX_*.ts`。
5. 思考教学实现和生产实现的差距。`stages/` 只能作为行为参考，生产代码仍应通过 `src/` 的
   Registry、Feature 和 Runtime 契约实现。

运行课程需要已配置模型 API Key；静态阅读和 `deno task check` 不会请求模型。

## 课程地图

| 阶段 | 本课原则                               | 深入教程                                                                |
| ---- | -------------------------------------- | ----------------------------------------------------------------------- |
| s01  | 一个工具 + 一个循环，就是最小 Agent    | [Agent Loop](tutorials/s01_agent_loop.md)                               |
| s02  | 新能力注册进工具池，不改循环           | [Tool Use](tutorials/s02_tool_use.md)                                   |
| s03  | 先划边界，再给行动自由                 | [Permission](tutorials/s03_permission.md)                               |
| s04  | 扩展点挂在循环上，不塞进循环里         | [Hooks](tutorials/s04_hooks.md)                                         |
| s05  | 计划把目标变成可观察的进度             | [TodoWrite](tutorials/s05_todo_write.md)                                |
| s06  | 隔离上下文，汇总结果                   | [Subagent](tutorials/s06_subagent.md)                                   |
| s07  | 先发现、后加载，节省上下文             | [Skill Loading](tutorials/s07_skill_loading.md)                         |
| s08  | 历史可以压缩，当前意图不能丢           | [Context Compact](tutorials/s08_context_compact.md)                     |
| s09  | 只持久化跨会话仍有价值的事实           | [Memory](tutorials/s09_memory.md)                                       |
| s10  | Prompt 是有优先级的组装结果            | [System Prompt](tutorials/s10_system_prompt.md)                         |
| s11  | 错误是分类和恢复的输入                 | [Error Recovery](tutorials/s11_error_recovery.md)                       |
| s12  | 长任务需要持久化依赖图                 | [Persistent Task Graph](tutorials/s12_persistent_task_graph.md)         |
| s13  | 慢操作放后台，主循环继续工作           | [Background Tasks](tutorials/s13_background_tasks.md)                   |
| s14  | 调度器负责唤醒，Agent 负责判断         | [Cron Scheduling](tutorials/s14_cron_scheduling.md)                     |
| s15  | 团队协作依靠身份、状态和邮箱           | [Agent Teams](tutorials/s15_agent_teams.md)                             |
| s16  | 协作消息必须机器可验证                 | [Team Protocol](tutorials/s16_team_protocol.md)                         |
| s17  | 共享看板让队友自主认领任务             | [Autonomous Agent](tutorials/s17_autonomous_agent.md)                   |
| s18  | 任务隔离目标，worktree 隔离文件        | [Git Worktree](tutorials/s18_git_worktree.md)                           |
| s19  | MCP 把远程能力接入统一工具池           | [MCP Plugins](tutorials/s19_mcp_plugins.md)                             |
| s20  | 机制可以很多，主循环只能有一个         | [Comprehensive Harness](tutorials/s20_comprehensive.md)                 |
| s21  | 时间、调用数和输出都必须有上限         | [Bounded Runtime](tutorials/s21_bounded_runtime.md)                     |
| s22  | 没有结构化轨迹，就无法解释运行         | [Structured Tracing](tutorials/s22_structured_tracing.md)               |
| s23  | 没有评测反馈，就不知道改动是否变好     | [Evaluation](tutorials/s23_evaluation_feedback.md)                      |
| s24  | 记忆要按问题检索，不应全部塞进 Prompt  | [Retrieval Memory](tutorials/s24_retrieval_augmented_memory.md)         |
| s25  | 计划、执行、验证是三个不同责任         | [Planner–Executor–Verifier](tutorials/s25_planner_executor_verifier.md) |
| s26  | 先协商能力，再调用 MCP 方法            | [Capability Negotiation](tutorials/s26_mcp_capability_negotiation.md)   |
| s27  | 交接传递目标、证据和权限，不传模糊期待 | [Handoff Guardrails](tutorials/s27_handoff_guardrails.md)               |
| s28  | 检查点让中断变成可恢复状态             | [Checkpoint and Resume](tutorials/s28_checkpoint_resume.md)             |
| s29  | 自信不是证据，行动前需要门控           | [Cognitive Monitor](tutorials/s29_cognitive_monitor.md)                 |
| s30  | 编译成功不等于生产就绪                 | [Production Readiness](tutorials/s30_production_readiness.md)           |

## 教学代码与生产代码的边界

阶段代码会为了突出单一概念而简化：例如用字符数近似 token、用进程内 Map
代替数据库、用词项重叠代替向量检索。它们展示的是机制和边界，不是可以直接复制上线的模块。

生产实现位于 `src/` 和 `desktop/`。完成一课后，可以寻找它在生产架构中的对应物：`AgentRuntime`
承载唯一循环，`ToolRegistry` 和 `PromptRegistry` 负责扩展，`HarnessFeature`
组织可移除能力，`scheduler.ts` 管理计划执行，`providers/` 处理模型差异。
