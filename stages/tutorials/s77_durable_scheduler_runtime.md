# s77：Durable Scheduler

## 本课目标

让定时任务在进程重启后仍可恢复，并通过 Lease、重试和 Dead Letter 解决重复执行与 Poison Job。

## 核心机制

- `ScheduleStore` 将调度状态与存储解耦。
- 到期任务被 Lease，Lease 过期后可被重新接管。
- 失败任务有限重试，超过上限进入 `dead`。

## 练习

1. 用 `src/config/paths.ts` 对应的数据根实现原子 JSON 存储。
2. 加入时区、cron、错峰和优雅关机。
3. 测试 Worker 崩溃、重复唤醒和跨进程抢占。

## 生产边界

课程使用内存 Store；生产需要数据库/队列、锁、时钟校正、指标和运营补偿流程。
