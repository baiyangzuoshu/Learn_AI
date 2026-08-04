# s21：有界运行时

源码：[s21_bounded_runtime.ts](../s21_bounded_runtime.ts)

## 学习目标

- 为 Agent 设置工具次数和总运行时间预算。
- 让外部取消与内部超时共享取消链路。
- 理解无界 `while` 循环的生产风险。

## 核心机制

`runtime_budget_check` 校验预算；包装后的 `agentLoop` 使用 `AbortController`
传播超时与外部取消，并统计工具事件。预算结束时发出开始和停止 Hook。

## 运行与观察

```sh
deno task s21
```

使用很小的工具预算运行多步骤任务，观察取消发生的位置和最终错误。

## 局限与练习

当前包装层在工具事件后才能计数。将预算下沉到 Runtime 的 `PreToolUse`，在执行超额工具前拒绝它。
