# 25: Worker Workloads — 用 Lease 管长任务

[← s24](../s24_retrieval_augmented_memory/README.md) · [课程地图](../README.md) ·
[s26 →](../s26_mcp_capability_negotiation/README.md)

> “接收、调度和执行是三种职责”
>
> 生产层：后台与队列。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

HTTP 请求、定时唤醒和长任务执行耦合在一个进程时，崩溃会丢任务，多实例会重复领取。

## 解决方案

用 queued、leased、done、dead 状态和过期 Lease 表达可靠 Worker 生命周期。

## 工作原理

1. 入口只负责 enqueue。
2. Worker 原子领取 Lease。
3. 失败受 attempts 上限约束。
4. 过期 Lease 可被其他 Worker 接管。

### 执行链

```text
admission/scheduler → queue → lease → execute → done/retry/dead
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s25`
- 类型检查：`deno check stages/s25_planner_executor_verifier/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

模拟 Worker 领取后崩溃，把时间推进到 leaseUntil 之后，确认任务可以安全接管。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产需要持久队列、事务领取、优先级、退避、健康检查、取消和运营补偿，不能依赖进程内 Map。

生产迁移必须通过 `AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和独立 `HarnessFeature`
完成；禁止从 `src/` 或 `desktop/` 直接导入课程代码。

## 动手练习

1. 修改一个阈值或状态转移，写下预期结果并运行本章验证。
2. 增加一个负例，确认失败会留下可定位证据，而不是被吞掉或误报成功。
3. 把本章机制映射到生产模块，列出契约、持久化、权限、Trace、取消和回滚要求。

## 过关标准

- 能画出执行链并解释每个边界由谁强制。
- 能指出示例中的占位实现和至少三项生产缺口。
- 能给出一条可自动化的验收证据，而不是“人工看起来没问题”。

## 下一章

进入 [s26 →](../s26_mcp_capability_negotiation/README.md)，继续补齐生产 Agent 的下一层约束。
