# s52：A2A HTTP 运行时

## 本课目标

把 A2A 从状态结构推进到真实 Request/Response 边界：Agent Card、任务创建、状态变更和 Artifact。

## 核心符号

- `createA2AHandler`：返回可测试的 HTTP handler。
- `/.well-known/agent.json`：Agent Card 发现端点。
- `POST /tasks`：异步接受任务，返回 202。
- `POST /tasks/:id`：严格验证状态迁移。

## 运行

```sh
deno check stages/s52_a2a_http_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s52_a2a_http_runtime.ts
```

## 练习

- 增加 `Idempotency-Key`，重复 POST 不得创建两个任务。
- 增加 Bearer token 和租户检查。
- 增加 SSE task updates 和客户端断线恢复。

## 与生产的边界

课程 handler 是内存状态；生产要使用持久化任务表、租约、Artifact 存储、TLS、审计和跨服务 Trace。
