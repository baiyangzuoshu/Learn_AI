# s22：结构化追踪

源码：[s22_structured_tracing.ts](../s22_structured_tracing.ts)

## 学习目标

- 为每次运行分配稳定 `runId` 和事件序号。
- 将工具、Hook、完成和失败统一为 Trace Record。
- 控制 Trace 字段长度并避免记录秘密。

## 核心机制

本阶段包装事件回调，产生带时间、类型、名称和摘要的有序记录。`trace_summarize`
对记录按名称计数，展示结构化 Trace 如何支持诊断和指标聚合。

## 运行与观察

```sh
deno task s22
```

执行一个工具任务，检查同一运行的事件序号是否递增，并计算总耗时。

## 局限与练习

增加 `spanId`、`parentSpanId` 和 Provider 调用 Span，再实现敏感字段脱敏器。
