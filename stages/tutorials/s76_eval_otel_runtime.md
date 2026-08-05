# s76：OpenTelemetry Evaluation Runtime

## 本课目标

让一次评估同时产出数据集结果、Grounding 指标和可关联的 Trace，支持 baseline 与 candidate 回归比较。

## 核心机制

- `OTelRecorder` 记录 trace、span、父子关系、属性和耗时。
- `evaluateDataset` 将结果与 Grounding 检查绑定。
- `regressionGate` 把质量下降转化为发布阻断原因。

## 练习

1. 导出 OTLP/Phoenix，加入模型、token、成本和工具属性。
2. 增加 Critic、LLM Judge、人工 `needs-review` 队列。
3. 将负例和历史反馈自动写入回归数据集。

## 生产边界

示例导出内存 JSON；生产需要采样、脱敏、实验版本、数据集存储和 CI 门禁。
