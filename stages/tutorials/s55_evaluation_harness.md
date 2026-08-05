# s55：重复评测与 Regression Gate

## 本课目标

把 s46 的反馈数据推进到可重复评测：正例、负例、多次运行、延迟、flaky case 和 baseline gate。

## 核心符号

- `EvalCase`：输入、期望、标签。
- `runEvaluation`：重复运行并捕获错误。
- `summarizeEvaluation`：计算通过率、p95、flaky。
- `regressionGate`：比较当前与基线。

## 运行

```sh
deno check stages/s55_evaluation_harness.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s55_evaluation_harness.ts
```

## 练习

1. 增加语义评分、Grounding 评分和“不知道”负例。
2. 将结果写成 JSONL，按 prompt/model/tool 版本聚合。
3. 用随机 runner 模拟 flaky，并设置最大允许波动。

## 与生产的边界

本课使用确定性字符串 runner。生产需要 LLM-as-Judge 校准、人工抽样、Phoenix
数据集、隐私脱敏和发布门禁。
