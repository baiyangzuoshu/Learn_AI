# s38：Observability, Cost, and AIOps

## 合并范围

整合 Structured Tracing、OTel、成本路由、SLO、Dashboard、告警和下游依赖观测。

## 学习重点

Agent 可观测性需要同一 Trace 上的 Prompt、Tool、Provider、MCP、A2A、Worker、Latency、Cost 和
Outcome；没有证据就无法解释质量或费用变化。

## 练习

1. 导出 OTLP 并添加采样和 PII Redaction。
2. 监控检索索引、Provider、MCP Server 和 Queue 健康度。
3. 设计成本异常和错误率异常的告警策略。

## 生产迁移

指标必须关联版本和租户，但不能包含明文凭据或完整私密内容。
