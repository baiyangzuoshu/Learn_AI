# s22：Structured Contracts and Trace

## 合并范围

整合结构化 I/O、Trace、Hook、Telemetry 和可观测性课程。

## 学习重点

Schema 先于工具执行；一个 Trace 必须贯穿 UI、模型、工具、MCP、A2A、Worker 和评估。`TraceBook`
演示父子 Span，而 `validate` 演示边界校验。

## 练习

1. 增加枚举、数组长度和输出 Schema。
2. 记录 token、成本、模型、权限决策和错误分类。
3. 导出 OTLP 时脱敏 Prompt 和工具参数。

## 生产迁移

在 `HarnessEvent` 上增加稳定 Trace 关联，不把遥测逻辑散落到每个 Feature。
