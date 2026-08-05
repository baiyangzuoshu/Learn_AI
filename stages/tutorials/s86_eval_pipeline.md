# s86：Evaluation Pipeline

## 本课目标

让评估成为可回放流水线：数据集、输出、Grounding、Trace、人工复核和回归门禁全部保留。

## 核心机制

- 每个 Case 有独立 trace ID。
- 失败或未接地结果进入人工 Review，而不是静默计为成功。
- 当前结果和 baseline 比较后才能发布。

## 练习

1. 接入 OTel/Phoenix exporter 和 LLM Judge。
2. 增加 Critic、引用覆盖率、成本和安全评分。
3. 将人工标签回灌为新的回归数据集。

## 生产边界

课程没有外部评估平台；生产需要实验版本、数据集存储、采样和 CI/CD 门禁。
