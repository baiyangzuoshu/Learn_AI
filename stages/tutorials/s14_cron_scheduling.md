# s14：周期 AI 对话

源码：[s14_cron_scheduling.ts](../s14_cron_scheduling.ts)

## 学习目标

- 理解定时任务如何复用同一个 Agent Loop。
- 掌握周期配置、持久化、超时和运行结果保存。
- 认识重复执行与单实例锁问题。

## 核心机制

`cron_list`、`cron_write` 和 `cron_run_now`
管理周期任务。调度器计算下次时间，到期后使用绑定工作区、模型和权限运行 Agent，并将回答保存为会话。

## 运行与观察

```sh
deno task s14
```

创建一个短间隔测试任务，观察 `lastRunAt`、`nextRunAt` 和错误状态更新。

## 练习

加入进程级锁，避免多个应用实例重复执行同一任务。
