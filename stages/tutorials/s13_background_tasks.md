# s13：后台任务

源码：[s13_background_tasks.ts](../s13_background_tasks.ts)

## 学习目标

- 理解长时间命令为何不应阻塞 Agent Loop。
- 掌握后台进程的启动、查询、取消和输出限制。
- 处理并发上限和进程生命周期。

## 核心机制

`background_start` 启动子进程并立即返回任务 ID，`background_status` 查询状态，`background_cancel`
发送终止信号。任务记录包含工作区，避免跨项目读取。

## 运行与观察

```sh
deno task s13
```

启动一个短暂的延迟命令，连续查询状态，再测试取消仍在运行的任务。

## 练习

让父级 `AbortSignal` 终止子进程，并增加超时后的强制清理。
