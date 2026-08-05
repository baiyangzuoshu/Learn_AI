# s28：RAG and Long-term Memory

## 合并范围

整合检索记忆、Hybrid RAG、Memory Architecture、Persistent Store、Memory Service、迁移与 Retention。

## 学习重点

记忆分 semantic、episodic、procedural；检索先于
Prompt。生产记忆需要租户隔离、混合排序、过期、Tombstone、迁移和索引清理。

## 练习

1. 用真实 embedding、ANN、reranker 和图边替换占位向量。
2. 验证删除后缓存与派生索引均不再返回事实。
3. 记录召回率、引用覆盖率和“应该说不知道”的案例。

## 生产迁移

Memory Service 必须独立于聊天记录，采用应用数据路径、加密、备份和恢复演练。
