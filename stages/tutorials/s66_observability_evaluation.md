# s66：可观测评估与人工反馈

## 本课目标

把一次 Agent 运行变成可审计的 Trace、数据集结果、Judge 标签和人工复核反馈。

## 关键机制

- `TraceRecorder.span` 记录 trace ID、属性和耗时，失败也会留下证据。
- Evaluation Case 与 runner 解耦，Judge 可以是规则、模型或人工。
- `needs-review` 不等于失败：它进入人工队列，不能静默丢弃。

## 运行与练习

```sh
deno check stages/s66_observability_evaluation.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s66_observability_evaluation.ts
```

1. 接入 OpenTelemetry/Phoenix exporter。
2. 增加 grounding、critic、成本和安全指标。
3. 把 feedback 写入回归数据集，并比较 baseline 与 candidate。

## 生产边界

本课只保留内存 Trace；生产需要数据集/实验持久化、采样策略、PII 脱敏、人工队列和 CI 发布门禁。
