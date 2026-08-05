# s57：API、Queue、Worker、SSE 实装

## 本课目标

从“选择 wire”进入可测试服务：HTTP 入队、health、job 查询、Worker claim、retry 和 SSE 事件。

## 核心符号

- `DurableLessonQueue`：展示 queued/running/completed/failed 状态。
- `createServiceHandler`：API 边界验证并返回 202。
- `eventStream`：输出可消费的 SSE 数据帧。

## 运行

```sh
deno check stages/s57_deploy_service.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s57_deploy_service.ts
```

## 练习

- 增加 leaseUntil、死信队列和指数退避。
- 让 Worker 通过 `AbortController` 停止正在执行的 Agent。
- 写一个真实 `Deno.serve` 入口，并限制 loopback/反向代理边界。

## 与生产的边界

课程队列仍是进程内 Map。生产需要 durable broker、容器、Compose、TLS、认证、背压、监控和优雅关闭。
