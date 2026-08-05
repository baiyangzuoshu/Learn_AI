# s72：Schema 与 Trace Context

## 本课目标

在工具真正执行前验证参数，并把同一个 Trace 关联到模型、工具、MCP、Nested Agent 和 Scheduler。

## 核心机制

- `validateObject` 拒绝缺失字段和错误类型。
- `childContext` 保留 `traceId`，为下游生成新的 `spanId`。
- `SpanSink` 让内存测试和 OTel exporter 使用同一个接口。

## 练习

1. 支持数组、枚举、最大长度和敏感字段脱敏。
2. 为每个 `HarnessEvent` 增加 trace/span ID。
3. 将工具失败、重试、权限拒绝都记录为 Span。

## 生产边界

示例是轻量 Schema 校验；生产应使用统一的运行时 Schema、采样、PII 脱敏和 OTLP 导出。
