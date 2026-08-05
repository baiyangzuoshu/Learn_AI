# s25：Background, Scheduler, and Worker

## 合并范围

整合后台任务、Cron、队列、API/Worker、Lease、Retry 和 Dead Letter。

## 学习重点

HTTP 接收、调度唤醒、Worker 执行必须分离。Lease 防止并发重复执行；失败受尝试上限约束，Poison Job
进入 dead 状态。

## 练习

1. 让取消信号终止子进程并更新 Job 状态。
2. 添加退避、优先级、并发上限和健康检查。
3. 模拟崩溃后接管过期 Lease。

## 生产迁移

生产需要持久队列、独立 Worker、事务和运营补偿，不使用进程内 Map。
