# s32：ReAct、树搜索与 Reflexion

## 要解决的问题

“让模型多想一想”不是一种策略。需要外部证据时，ReAct
更合适；存在多个方案时，需要有限的树搜索；答案已经生成但质量不确定时，需要
Reflexion/critic。把三者混在一个无限循环里，会增加 token 和幻觉。

## 代码地图

- `react` 把问题、动作、观察组织成可记录的步骤。
- `treeOfThoughts` 对候选项打分、排序，并限制候选数量。
- `reflexion` 根据 rubric 找出答案缺口。
- `reasoning_compare` 一次性比较三种策略，便于教学观察。

## 运行与实验

```sh
deno check stages/s32_reasoning_strategies.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s32_reasoning_strategies.ts
```

给工具传入 8 个候选方案，观察排序结果。把候选数量上限从 8 改成 3，思考搜索宽度与质量、成本的关系。

## 设计原则

1. 思考步骤是内部控制数据，不要默认把完整 chain-of-thought 展示给用户。
2. 每个策略都要有 `maxSteps`、`maxBranches` 或超时。
3. 评分函数必须可解释；仅按字符串长度是教学占位，不是质量评估。
4. Reflexion 的反馈应转成下一轮可执行的修复动作，而不是重复批评。

## 练习

- 为树节点增加 `cost`，实现“质量/成本”排序。
- 让 ReAct 在观察为空时返回 `gather-evidence`，而不是继续行动。
- 为 Reflexion 增加“必须引用来源”的 rubric。

## 与生产的边界

生产 Runtime 只保留一个主循环，策略作为 Planner/Verifier 等 Feature
插入。不要为每种推理策略再创建一个失控的 agent loop；所有分支共享预算、Trace 和取消信号。
