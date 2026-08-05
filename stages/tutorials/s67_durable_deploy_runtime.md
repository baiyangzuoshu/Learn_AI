# s67：Durable Queue 与部署运行时

## 本课目标

把 HTTP 接入和 Worker 执行解耦，学习 enqueue、lease、ack、retry、dead-letter 五个可靠性原语。

## 关键机制

- 相同 Job ID 是幂等提交，Worker 通过 lease 声明所有权。
- lease 过期后任务可以被其他 Worker 接管。
- 超过重试上限进入 `dead`，不能无限重试制造成本和噪声。

## 运行与练习

```sh
deno check stages/s67_durable_deploy_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s67_durable_deploy_runtime.ts
```

1. 用原子 JSON 快照或数据库持久化 Queue。
2. 增加 Worker 循环、优雅关闭、backpressure 和 SSE 事件。
3. 模拟进程崩溃，验证 lease 恢复和 DLQ 运营流程。

## 生产边界

课程队列是内存实现；生产需要 Durable Broker、独立 Worker、TLS、认证、容器编排和扩缩容。
