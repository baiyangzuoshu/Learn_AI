# s30：Evaluation, Feedback, and CI

## 合并范围

整合评测、Phoenix/HITL、Evaluation Harness、OTel、Grounding、Critic 和 CI Gate。

## 学习重点

一次评估输出质量、Grounding、延迟、成本、Trace 和人工复核项。基线回归或负例失败必须阻断发布。

## 练习

1. 接入 Phoenix/OTLP 与数据集版本。
2. 增加 LLM Judge、Rubric Critic 和 flaky 重复运行。
3. 将人工反馈写回回归集。

## 生产迁移

测试集、生产数据和凭据必须隔离；日志在导出前脱敏。
