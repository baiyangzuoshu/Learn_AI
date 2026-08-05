# s81：Production Runtime Adapter

## 本课目标

学习如何把课程中的运行机制迁移到唯一的生产 `AgentRuntime`。功能模块不能再创建自己的
Loop，而是通过一个显式适配器传入 workspace、预算、取消信号和 trace。

## 关键设计

`ProductionRun` 是跨边界最小上下文：请求、工作区、预算和 `traceId`。`GuardedRuntimeAdapter` 在进入
Runtime 前验证预算，在返回后检查输出，并为开始、完成和失败留下事件证据。

这避免了常见错误：某个 Feature 偷偷调用模型、使用默认工作区、遗漏 AbortSignal，或把超大输出直接交给
UI。

## 练习

1. 为 token、并发、deadline 和模型成本补充预算字段。
2. 将 `RuntimeAdapterEvent` 映射到用户可见事件与开发者 Hook。
3. 给超限、取消和 Provider 失败写三组负例。

## 生产边界

本课是迁移契约；真正接线时要在 `src/contracts.ts` 和 `src/runtime.ts`
设计兼容的公开类型，而不是导入此阶段文件。
