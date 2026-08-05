# s50：完整 Cognitive Agent 综合课

## 本课目标

s40 只有认知监控；s50 把书中 Cognitive
Workspace、Perception、Planning、Execution、Evaluation、Attention、Memory
组合成一个有界循环，并加入发布检查。

## 代码地图

- `perceive`：从问题提取有限观察。
- `plan`：产生可验证步骤。
- `cognitiveCycle`：在共享 workspace 中推进模块状态。
- `evaluateState`：低置信度升级，完成条件通过才结束。
- `releaseCheck`：检查 prompt/tool/model 版本。
- `metrics`：输出可观测的认知指标。

## 运行

```sh
deno check stages/s50_cognitive_capstone.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s50_cognitive_capstone.ts
```

## 练习

- 将 s44 Memory 接入 `memory` 模块，在计划前主动检索经验。
- 将 s46 Grounding/HITL 接入 Evaluation 模块。
- 将 s43 策略选择接入 Attention，在停滞时切换 ReAct/ToT/Reflexion。
- 统计认知效率：完成率、平均迭代数、证据覆盖率、升级率和成本。

## 与生产的边界

综合课仍是确定性教学骨架。完成它之后，才适合把每个模块拆成独立生产
Feature，并通过真实模型、权限、取消、Trace、评测和发布流水线逐项验证。
