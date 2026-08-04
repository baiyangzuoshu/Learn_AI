# s28：检查点与恢复

源码：[s28_checkpoint_resume.ts](../s28_checkpoint_resume.ts)

## 学习目标

- 将长循环状态保存到工作区。
- 使用临时文件加 rename 原子写入。
- 恢复时避免重复已经完成的副作用。

## 核心机制

`checkpoint_write` 保存目标、迭代、完成项、待办和证据；`checkpoint_read` 按安全 ID 读取。文件位于
`.deno-agent/checkpoints/`，写入过程具有原子性。

## 恢复不是从头重跑

长任务可能因应用退出、网络故障或用户暂停而中断。Checkpoint
保存的是足以继续决策的最小状态：目标、迭代、已完成项、待办和证据。恢复后应跳过已确认完成的副作用，而不是把整个
Prompt 重新执行一遍。

`checkpointPath()` 对 ID 采用严格字符与长度约束，防止路径逃逸。`writeAtomic()`
先写同目录临时文件，再 rename，保证读者只看到旧完整版本或新完整版本。`checkpoint_write`
限制数组大小并生成时间戳，`checkpoint_read` 解析持久 JSON。

真实 Checkpoint 需要 `schemaVersion`、迁移与运行时校验，不能信任磁盘内容。更难的是幂等：如果外部 API
已成功但写检查点前崩溃，恢复时可能重复调用。工具应接受 operation/idempotency
key，或在恢复前查询真实外部状态。

Checkpoint 与完整消息历史不同。它保存决策状态和证据摘要，避免把无限对话原样持久化。

## 运行与观察

```sh
deno task s28
```

保存一次循环状态，重启阶段后读取，确认完成项和证据仍存在。

## 局限与练习

加入 Schema 版本、迁移、严格读取校验与
checksum。模拟“外部动作完成、检查点未更新”崩溃窗口，用幂等键证明恢复不会重复副作用。
