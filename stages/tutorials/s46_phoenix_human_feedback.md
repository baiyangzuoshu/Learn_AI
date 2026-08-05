# s46：Phoenix 风格 Trace、评估与 HITL

## 本课目标

评估不能只返回一个分数。要保留 Trace、数据集、实验、Annotation，并在 grounding 或 confidence
不足时交给人工。

## 代码地图

- `Span`：区分 agent、llm、tool，并保存脱敏属性。
- `FeedbackDataset`：收集 spans 和 annotations。
- `groundingCheck`：检查答案是否包含所需引用。
- `humanEscalation`：把低分结果送入 human-review。

## 运行

```sh
deno check stages/s46_phoenix_human_feedback.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s46_phoenix_human_feedback.ts
```

## 练习

- 建立正例、负例和“应该回答不知道”的 benchmark。
- 增加 evaluator agent，输出 typed pass/fail/feedback。
- 为 Prompt 或 Model 版本运行 before/after experiment。

## 与生产的边界

本课是 Phoenix 数据模型的教学替身。生产需要真正的观测后端、采样、PII 脱敏、人工审核队列和告警策略。
