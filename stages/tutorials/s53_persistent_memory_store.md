# s53：真实文件持久化 Memory Store

## 本课目标

把 s44 的记忆算法推进到版本化、租户隔离、原子写入、Graph Link 和 Tombstone Delete。

## 核心符号

- `MemorySnapshot`：版本化快照。
- `PersistentMemoryStore.load/save`：校验数据并使用临时文件 rename 原子提交。
- `search`：只返回指定 tenant 的 live memory。
- `forget`：软删除，避免派生索引继续误召回。

## 运行

```sh
deno check stages/s53_persistent_memory_store.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s53_persistent_memory_store.ts
```

## 练习

1. 增加 schema migration 和损坏快照备份。
2. 将 `edges` 实现成邻接查询，支持多跳关系。
3. 为删除操作同步清理向量索引、图索引和压缩摘要。

## 与生产的边界

JSON 文件适合教学和单进程实验，不适合并发生产。生产要使用事务存储、并发锁、备份、加密、租户级权限和
retention policy。
