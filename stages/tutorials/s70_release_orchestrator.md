# s70：发布编排、Canary、Rollback 与 Chaos

## 本课目标

完成从课程原型迁移生产前的发布总演练：版本指纹、兼容性、SLO、Canary、自动回滚和混沌恢复。

## 关键机制

- Release 同时绑定 prompt、model、tools、schema，并生成可审计 fingerprint。
- 兼容性和 SLO 失败时 traffic 为 0，当前版本保持不变。
- Chaos 只验证有预算的瞬态恢复，不掩盖永久故障。

## 运行与练习

```sh
deno check stages/s70_release_orchestrator.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s70_release_orchestrator.ts
```

1. 结合 s55/s66 的评估和 Trace 作为发布门禁。
2. 增加签名、provenance、流量切分、健康探针和手动批准。
3. 演练 Provider 断线、MCP 不兼容、Queue 重复投递和 Memory 损坏后的 rollback。

## 生产边界

课程实现发布决策和控制逻辑；生产还需要真实部署平台、监控告警、事故
Runbook、签名密钥和跨版本兼容测试。
