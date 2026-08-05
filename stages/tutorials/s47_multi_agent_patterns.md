# s47：Flow、Orchestrator、Debate、Vote、Peer

## 本课目标

“多 Agent”不是一种架构。书中区分
Flow、Orchestration、Collaboration，并进一步讨论顺序、并行、层级、辩论、投票、角色协作和 Peer 网络。

## 代码地图

- `runFlow`：确定性流水线。
- `orchestrate`：中心调度器把任务分配给 Worker。
- `debate`：保留 dissent，不把少数意见静默丢掉。
- `vote`：按共识数量和置信度选结果。

## 运行

```sh
deno check stages/s47_multi_agent_patterns.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s47_multi_agent_patterns.ts
```

## 练习

- 为并行 Worker 增加并发上限和超时。
- 让 reviewer 看到 analyst 的证据但不能修改原始结果。
- 增加 quorum、tie-breaker 和人工裁决。

## 与生产的边界

课程 Worker 是同步函数。生产要统一权限、Trace、预算、消息协议和失败恢复；Agent
数量增加会同时增加延迟、成本和协调风险。
