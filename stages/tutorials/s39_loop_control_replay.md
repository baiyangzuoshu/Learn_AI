# s39：循环控制、幂等与重放

## 要解决的问题

Agent
有内部推理循环、任务依赖循环和元控制循环。只要缺少显式停止条件，就可能无限调用工具；只要重试没有幂等键，就可能重复扣款、重复写文件或重复发送消息。

## 代码地图

- `terminationGate`：统一检查迭代数、工具调用数和时间预算。
- `IdempotencyLedger`：展示一次请求只能被 claim 一次。
- `replay`：只重放已验证的事件前缀，支持从检查点复现。

## 运行

```sh
deno check stages/s39_loop_control_replay.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s39_loop_control_replay.ts
```

把 `iterations` 设为 10，观察 gate 返回 iteration-limit；再次 claim 同一个 key，观察 duplicate 为
false。

## 三类停止条件

1. 软停止：模型输出最终答案或任务完成。
2. 硬停止：预算、超时、取消、最大深度触发。
3. 安全停止：权限拒绝、检测到注入、验证失败或状态不一致。

所有停止都应产生事件，便于解释“为什么没有继续”。

## 练习

- 为 ledger 增加结果缓存，使重复请求返回第一次结果。
- 为 replay 增加 schema/version 校验。
- 模拟取消，确认等待中的异步工作会收到 AbortSignal。

## 与生产的边界

课程 ledger
是进程内集合。生产需要原子存储、租约、事务边界和并发测试；重放必须脱敏，不能把用户秘密写进事件日志。
