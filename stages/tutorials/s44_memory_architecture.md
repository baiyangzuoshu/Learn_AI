# s44：Semantic、Episodic、Procedural Memory

## 本课目标

RAG
不等于记忆。知识通常是外部文档，记忆则来自对话、经验和策略。本课把三类长期记忆放入统一检索协议，并增加压缩与遗忘。

## 代码地图

- `embed` / `similarity`：教学版向量表示与相似度。
- `hybridMemorySearch`：词项命中加向量分数，并可按记忆类型过滤。
- `compressMemories`：保留高重要度和较新的记忆。
- `forgetStale`：删除过期低重要度项目。

## 运行

```sh
deno check stages/s44_memory_architecture.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s44_memory_architecture.ts
```

## 练习

- 增加实体和关系，支持“谁与谁相关”的图检索。
- 为 semantic、episodic、procedural 三类记忆设不同 TTL。
- 增加租户和权限过滤，确保检索不会越权。

## 与生产的边界

课程 embedding 是确定性玩具算法。生产需真实 embedding、ANN/Vector DB、Graph
DB、写入去重、删除同步、压缩任务和隐私保留策略。
