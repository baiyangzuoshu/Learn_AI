# s28：检查点与恢复

源码：[s28_checkpoint_resume.ts](../s28_checkpoint_resume.ts)

## 学习目标

- 将长循环状态保存到工作区。
- 使用临时文件加 rename 原子写入。
- 恢复时避免重复已经完成的副作用。

## 核心机制

`checkpoint_write` 保存目标、迭代、完成项、待办和证据；`checkpoint_read` 按安全 ID 读取。文件位于
`.deno-agent/checkpoints/`，写入过程具有原子性。

## 运行与观察

```sh
deno task s28
```

保存一次循环状态，重启阶段后读取，确认完成项和证据仍存在。

## 局限与练习

加入 Schema 版本、迁移、校验和恢复后副作用幂等键。
