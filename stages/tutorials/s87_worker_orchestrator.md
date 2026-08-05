# s87：Worker Orchestrator

## 本课目标

让长任务从 HTTP 会话中脱离，交给可恢复的 Worker。每个任务都带 Trace、Lease、尝试次数和终态。

## 关键设计

Lease 表示某 Worker 暂时拥有执行权；它到期后才能被接管。成功进入 `done`，反复失败进入
`dead`，避免无限重试消耗模型费用。

## 练习

1. 增加退避、优先级、并发上限和取消状态。
2. 让 Worker 通过 A2A 或 MCP 执行专门任务。
3. 测试崩溃、重复 delivery、网络断线和 Poison Job。

## 生产边界

真实队列需要持久化、事务、监控、告警和人工补偿，不能依赖单进程 Map。
