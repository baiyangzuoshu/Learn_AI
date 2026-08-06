# 24: Task State & Replay — 从证据恢复长任务

[← s23](../s23_evaluation_feedback/README.md) · [课程地图](../README.md) ·
[s25 →](../s25_planner_executor_verifier/README.md)

> “只有证据能把任务推进到 verified”
>
> 生产层：任务账本。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

进程中断后只看聊天文本无法判断副作用是否已执行，盲目重跑又可能重复写入或外部调用。

## 解决方案

用显式 goal、state、evidence、checkpoint 和幂等记录保存可恢复状态。

## 工作原理

1. 创建 planned 任务。
2. 执行后写入证据并进入 running。
3. 恢复时读取证据而非猜测。
4. 有证据才允许 verified。

### 执行链

```text
plan → execute with idempotency key → checkpoint evidence → resume → verify
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s24`
- 类型检查：`deno check stages/s24_retrieval_augmented_memory/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

删除 checkpoint 证据后尝试 verify，确认状态机拒绝无证据完成。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

示例使用内存 Map；生产需要原子持久化、依赖图、revision、崩溃恢复和副作用幂等键。

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

进入 [s25 →](../s25_planner_executor_verifier/README.md)，继续补齐生产 Agent 的下一层约束。
