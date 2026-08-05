# s45：Deep Research 外部状态循环

## 本课目标

书中的任务循环不是简单 `while`：它要把计划、问题、发现、质量和终止原因外置，并把探索与最后综合分开。

## 代码地图

- `ResearchState`：保存 goal、questions、findings、quality。
- `researchIteration`：追加证据并生成下一轮问题。
- `terminationGate`：质量、迭代、发现数和无后续问题共同决定停止。
- `synthesize`：独立于检索循环生成报告。

## 运行

```sh
deno check stages/s45_deep_research_loop.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s45_deep_research_loop.ts
```

## 练习

- 加入停滞检测：连续两轮相似发现就停止或换检索策略。
- 用 `Promise.allSettled` 并行独立来源，并限制并发。
- 为每条 claim 保存 citation、时间和可信度。

## 与生产的边界

课程使用确定性 finding。生产需要真实搜索工具、状态持久化、重试、预算、取消、来源校验和最终事实核查。
