# s23：评估与反馈

源码：[s23_evaluation_feedback.ts](../s23_evaluation_feedback.ts)

## 学习目标

- 在执行前定义可测量成功标准。
- 使用确定性 Grader 评估回答。
- 将失败证据用于下一轮改进。

## 核心机制

`evaluation_score` 支持 `contains`、`not_contains` 和 `exact`
三种规则，并按权重计算得分。确定性规则便于回归测试，也避免完全依赖模型自评。

## 运行与观察

```sh
deno task s23
```

对同一回答设置正向和负向规则，观察单项结果、总分和整体通过状态。

## 局限与练习

建立 Eval Dataset，加入工具轨迹断言、延迟预算和可选 LLM Judge。
