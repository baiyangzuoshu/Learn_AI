# s34：混合 RAG 与 Grounding

## 要解决的问题

只把所有记忆塞进 Prompt
会浪费上下文，也无法解释答案来源。只做向量检索又可能漏掉精确的文件名、错误码或专有名词。本课把词项匹配和向量相似度合并，并保留证据来源。

## 代码地图

- `lexicalScore`：教学版词项重叠分数，模拟 BM25 的“精确命中”价值。
- `cosine`：计算两个 embedding 的余弦相似度。
- `hybridSearch`：按 0.55/0.45 融合并返回 source、lexical、semantic、score。
- `hybrid_rag_search`：让模型观察检索结果，而不是直接读取整个库。

## 运行

```sh
deno check stages/s34_hybrid_rag.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s34_hybrid_rag.ts
```

修改两个文档的措辞，观察 lexical 分数变化；再给文档和 query 增加同维度 embedding，比较混合排序。

## Grounding 规则

检索结果必须带文档 ID、片段和来源。生成答案时要求引用这些
ID；找不到证据时输出“不知道”或继续检索。检索分数不是事实真值，仍需权限过滤、时间过滤和去重。

## 练习

1. 实现 top-k 后的去重与邻近片段合并。
2. 加入 freshness 权重，让近期文档优先。
3. 增加 `minScore`，低于阈值时返回空证据集。

## 与生产的边界

这里用数组和确定性分数模拟向量库。生产需要 embedding
provider、索引、租户隔离、删除同步和成本监控；检索工具仍必须走权限系统。
