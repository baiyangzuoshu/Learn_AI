# s04：生命周期 Hooks

源码：[s04_hooks.ts](../s04_hooks.ts)

## 学习目标

- 理解 Hook 与普通工具事件的区别。
- 掌握请求、工具前后、恢复和停止事件。
- 学会用事件提高可观察性而不泄露敏感信息。

## 核心机制

本阶段在 Agent 生命周期关键位置发出 `UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`ErrorRecovery`
和 `Stop`。Hook 描述运行过程，不改变模型决策，也不应包含完整密钥或超大工具输出。

## 扩展点为何不应写进循环

若日志、审批、指标和通知都直接修改 `agentLoop()`，主路径会迅速失控。Hook
在稳定生命周期点提供插口，让横切能力可以独立注册和移除。

```text
UserPromptSubmit
  └─ PreToolUse → 执行工具 → PostToolUse
                              └─ ... → Stop
Provider 可恢复故障期间会产生 ErrorRecovery
```

`trigger()` 按顺序等待 Hook，因此同步 Hook 会增加关键路径延迟。还要明确 Hook 失败采用 fail-open 还是
fail-closed：审计失败可能只记录告警，权限策略失败通常应阻止执行。本课区分面向用户的 `AgentEvent`
与面向开发者的 `onHook`；生产 UI 应默认隐藏后者，且不能把完整 Prompt、密钥或巨大输出写入 detail。

Hook 适合耗时统计、审计、策略检查和清理，不应演变成一套隐蔽的第二工作流。

## 运行与观察

```sh
deno task s04
```

执行一个需要工具的任务，记录事件顺序，并区分用户可见事件与开发者诊断事件。

## 练习

添加 `runId`，在 `PreToolUse` 保存开始时间、`PostToolUse` 计算耗时。再注册一个会抛错的
Hook，明确选择 fail-open 或 fail-closed 并写下理由。
