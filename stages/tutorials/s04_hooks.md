# s04：生命周期 Hooks

源码：[s04_hooks.ts](../s04_hooks.ts)

## 学习目标

- 理解 Hook 与普通工具事件的区别。
- 掌握请求、工具前后、恢复和停止事件。
- 学会用事件提高可观察性而不泄露敏感信息。

## 核心机制

本阶段在 Agent 生命周期关键位置发出 `UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`ErrorRecovery`
和 `Stop`。Hook 描述运行过程，不改变模型决策，也不应包含完整密钥或超大工具输出。

## 运行与观察

```sh
deno task s04
```

执行一个需要工具的任务，记录事件顺序，并区分用户可见事件与开发者诊断事件。

## 练习

为每次运行添加 `runId`，并计算每个工具的耗时。
