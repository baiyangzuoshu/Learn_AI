# s80：AIOps 与发布证据

## 本课目标

完成从“发布成功”到“持续运营”：监控 SLO、成本和错误率，生成告警，冻结晋级，回滚到健康版本并保留事故
Runbook。

## 核心机制

- `AIOpsController.observe` 将指标转换为分级 Alert。
- Critical 信号将 Release 标记为 degraded。
- Runbook 固化 freeze、trace、rollback、incident 和 replay 步骤。

## 练习

1. 接入 s76 的 Trace/Eval 和 s70 的 Canary Controller。
2. 增加告警去重、维护窗口、自动回滚和人工批准。
3. 演练 Provider、MCP、Queue、Memory 和下游 API 故障。

## 生产边界

课程只提供控制器；生产需要监控平台、签名/Provenance、通知渠道、事故值班和跨版本回放。
