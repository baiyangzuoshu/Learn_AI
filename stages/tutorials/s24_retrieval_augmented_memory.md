# s24：检索增强记忆

源码：[s24_retrieval_augmented_memory.ts](../s24_retrieval_augmented_memory.ts)

## 学习目标

- 理解文档摄取、分块、检索和来源引用的最小闭环。
- 区分检索证据与模型固有知识。
- 建立可替换的词法检索基线。

## 核心机制

`rag_index_documents` 将文档切成有重叠的受限块并保存在工作区内存索引；`rag_search`
用词项重合评分，返回来源、块 ID、文本和分数。

## 运行与观察

```sh
deno task s24
```

索引两份主题不同的短文档，再用多个查询观察召回结果和来源。

## 局限与练习

当前不是向量 RAG。增加 Embedding、持久向量库、元数据过滤、Reranker 和引用校验。
