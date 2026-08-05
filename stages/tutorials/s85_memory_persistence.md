# s85：Atomic Memory Persistence

## 本课目标

将长期记忆保存到正确的数据路径，保证租户隔离、原子替换、串行写入、版本号和删除墓碑。

## 核心机制

- `MemoryPathProvider` 避免硬编码平台路径。
- 临时文件加 rename，防止进程中断留下半个 JSON。
- 同一租户使用锁串行写入，删除使用 tombstone。

## 练习

1. 接入 `src/config/paths.ts` 的平台数据目录。
2. 增加 schema migration、加密、TTL 和备份恢复。
3. 将文件 Store 替换为向量库和图数据库。

## 生产边界

课程使用文件快照；生产需要并发事务、索引重建、密钥管理和合规保留策略。
