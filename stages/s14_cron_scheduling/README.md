# 14: Cron Scheduling — 到时间唤醒同一个 Agent

[← s13](../s13_background_tasks/README.md) · [课程地图](../README.md) ·
[s15 →](../s15_agent_teams/README.md)

> “Scheduler 负责唤醒，Agent 负责判断”
>
> Harness 层：调度。本章只增加一个机制，Agent 的核心决策循环保持不变。

## 本章目标

学完后，你应该能解释这个机制解决的具体问题、指出它插入 Agent Loop
的位置，并能修改一个约束后验证行为变化。

## 问题

需要重复执行的 AI 对话不能依赖用户每次手动启动，同时也不能复制另一套推理循环。

## 解决方案

持久化计划的 Prompt、工作区、模型、权限和时间，到期后调用同一个 Agent Loop 并保存结果。

## 工作原理

1. 校验周期与绑定上下文。
2. 原子保存计划。
3. 计算 nextRunAt 并安装定时器。
4. 超时运行后保存会话和状态。

### 执行链

```text
schedule → timer wakeup → same agent loop → saved conversation
```

模型负责决定下一步，Harness 负责校验、执行、记录和限制。失败也作为观察返回模型，而不是被隐藏。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s14`
- 类型检查：`deno check stages/s14_cron_scheduling/code.ts`

沿着注册点、输入校验、执行函数和 `agentLoop()`
四处阅读。先找到本章新增的状态或工具，再追踪它如何复用前一章。

## 观察清单

创建短间隔测试计划，观察 lastRunAt、nextRunAt、lastError 和立即运行入口。

建议同时记录：模型看见了什么 Schema、Harness
实际执行了什么、结果如何回到消息历史，以及取消或失败发生在哪一层。

## 边界与生产差距

生产调度需要时区、misfire、单实例 lease、幂等 execution ID、失败退避和凭据运行时解析。

课程代码为了突出机制会使用简化存储、协议或策略。不要把它直接导入 `src/`；迁移时应围绕生产
Registry、Runtime 和 Feature 契约重新实现。

## 动手练习

1. 修改一个预算、状态或校验条件，预测行为后再运行验证。
2. 构造一个失败输入，确认错误有界、可观察，且不会破坏已完成状态。
3. 写出该机制迁移到生产 `HarnessFeature` 时需要的输入、事件、权限类别和取消路径。

## 过关标准

- 能不看代码画出上面的执行链。
- 能运行本章并解释一次关键事件或工具结果。
- 能说清教学简化与生产边界，而不是只描述“功能能用”。

## 下一章

进入 [s15 →](../s15_agent_teams/README.md)，在同一个 Loop 上继续增加下一项能力。

## 课程图

![s14_cron_scheduling 执行链](images/overview.svg)

图中把本章新增机制放在统一 Agent Loop
的边界上；阅读代码时，沿箭头核对输入、执行、限制和证据是否一致。
