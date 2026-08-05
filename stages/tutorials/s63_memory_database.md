# s63：持久化 Memory Database

## 本课目标

把 s53 的 JSON 快照抽象为可迁移、可事务写入、可按租户检索、可删除的 Memory Database。

## 关键机制

- `MemoryPersistence` 把数据库语义和文件、数据库或测试内存实现解耦。
- 写入使用版本号和临时文件加 rename 的原子替换。
- 删除使用 tombstone，避免旧索引重新把已删除事实召回。

## 运行与练习

```sh
deno check stages/s63_memory_database.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s63_memory_database.ts
```

1. 加入确定性的 embedding 和 cosine 检索，与词法分数混合排序。
2. 实现 schema 1 到 schema 2 的迁移和并发写入锁。
3. 验证租户隔离、TTL、删除后派生索引清理。

## 生产边界

本课为可替换持久化层；生产需要真正的事务数据库、向量/图索引、加密、备份和保留策略。
