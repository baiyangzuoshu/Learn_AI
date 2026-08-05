# s62：A2A 网络运行时

## 本课目标

把 s52 的 HTTP Handler 变成可被远程 Agent 调用的受保护服务：Agent Card 发现、Bearer
认证、幂等提交和显式任务状态迁移。

## 关键机制

- 未携带正确 Bearer Token 的请求在业务路由之前被拒绝。
- `idempotency-key` 让客户端重试不会创建重复任务。
- 任务和 Artifact 使用有限状态机，非法迁移返回 `409`。

## 运行与练习

```sh
deno check stages/s62_a2a_network_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s62_a2a_network_runtime.ts
```

1. 增加 `tasks/{id}/events` 的 SSE 流。
2. 为不同租户绑定不同的 Agent Card 和权限范围。
3. 将 `Map` 替换为带 lease 的持久化任务存储。

## 生产边界

教学代码使用 `Request/Response` 模拟网络；生产还需要 TLS、真实身份验证、任务恢复、流量限制和
Artifact 存储。
