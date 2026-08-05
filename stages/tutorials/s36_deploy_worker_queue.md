# s36：API、Worker 与 Queue

## 要解决的问题

长任务不应占住 HTTP 请求；客户端断开也不应让后台任务失去状态。部署架构需要把 API、队列和 Worker
的职责分开，并明确重试、幂等和可观测协议。

## 代码地图

- `TeachingQueue`：用进程内 Map 模拟 enqueue、claim、retry、done/failed 状态。
- `work`：每次只领取一个 job，并把失败重排队，最多三次。
- `apiEnvelope`：展示请求 ID、结果和错误的稳定响应结构。
- `worker_queue_demo`：把一条任务走完，便于观察状态变化。

## 运行

```sh
deno check stages/s36_deploy_worker_queue.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s36_deploy_worker_queue.ts
```

将 `queue.work` 的 handler 改成第一次抛错，观察任务从 running 回到 queued；连续失败三次后进入
failed。

## 部署思路

API 只负责鉴权、校验和入队；Worker 负责取任务、执行和上报；Queue 负责持久化、可见性超时和重试。每个
job 都要有租户、优先级、截止时间、幂等键和 trace ID。

## 练习

1. 加入 `leaseUntil`，模拟 Worker 崩溃后的重新领取。
2. 实现指数退避和死信队列。
3. 让 `apiEnvelope` 在失败时返回稳定的错误码，而不是异常字符串。

## 与生产的边界

Map
不能抵御进程重启，也不提供并发锁。生产需使用受控队列、容器健康检查、资源限制和回滚策略；不要把本课示例直接当成部署脚本。
