# s22：结构化追踪

源码：[s22_structured_tracing.ts](../s22_structured_tracing.ts)

## 学习目标

- 为每次运行分配稳定 `runId` 和事件序号。
- 将工具、Hook、完成和失败统一为 Trace Record。
- 控制 Trace 字段长度并避免记录秘密。

## 核心机制

本阶段包装事件回调，产生带时间、类型、名称和摘要的有序记录。`trace_summarize`
对记录按名称计数，展示结构化 Trace 如何支持诊断和指标聚合。

## 日志与 Trace 的区别

字符串日志适合人临时阅读，却难以回答“哪次运行、按什么顺序、哪个父动作导致、耗时多少”。`TraceRecord`
使用 `runId`、递增 `sequence`、时间、类型、名称与受限 detail，把工具和 Hook 统一为可查询事件流。

本课包装原有 `onEvent` 与 `onHook`，既保留调用方回调，又同步记录轨迹。成功与失败都必须结束
Trace；否则监控系统会把悬空运行误判为仍在执行。`trace_summarize`
展示如何从结构化记录聚合工具次数，而不重新解析日志文本。

真实分布式追踪还需要 `traceId/spanId/parentSpanId` 表达 Provider、工具、子 Agent 和 MCP
的父子关系，并记录 duration、status
与受控属性。详细参数可能包含密钥、个人数据和文件正文，因此必须先脱敏，默认只保存摘要和元数据。

Trace 服务于调试、性能、成本和审计，但不能成为新的无限存储；采样、保留周期与单条大小都需预算。

## 运行与观察

```sh
deno task s22
```

执行一个工具任务，检查同一运行的事件序号是否递增，并计算总耗时。

## 局限与练习

增加 Span 父子关系和 Provider 调用耗时，实现密钥、Authorization 头和常见 token
格式脱敏。构造一次失败运行，确认仍有结束状态且序号连续。
