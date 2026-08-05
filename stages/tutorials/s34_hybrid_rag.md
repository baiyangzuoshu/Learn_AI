# s34：Release, Canary, Rollback, and AIOps

## 合并范围

整合 Production Readiness、Release Chaos、Release Orchestrator、AIOps 与 Production Acceptance。

## 学习重点

Release 绑定 prompt、tool、model 和 schema 版本。Promotion 依赖 Eval、安全与 SLO；Canary
失败需冻结流量、保留 Trace、回滚健康版本并启动 Incident Runbook。

## 练习

1. 为 Manifest 加签名和 provenance。
2. 注入 Provider、MCP、Memory、Queue 故障。
3. 使用真实指标平台驱动告警与自动回滚。

## 生产迁移

课程控制器不是部署平台；仍需真实流量、告警渠道、值班流程和跨版本回放。
