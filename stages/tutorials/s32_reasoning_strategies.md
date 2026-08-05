# s32：Reasoning, Research, and Cognitive Control

## 合并范围

整合 Cognitive Monitor、Workspace、Cognitive Runtime、Production Adapter 和策略选择。

## 学习重点

ReAct、Plan-Execute、ToT 和 Reflexion 是可选策略，不是叠加越多越好。Attention
根据低置信度、矛盾、知识缺口和停滞决定 act、retrieve、pivot 或 escalate。

## 练习

1. 用评估结果和检索质量生成 `CognitiveState`。
2. 持久化 Workspace 并记录策略效果。
3. 对重复搜索和自信错误写失败测试。

## 生产迁移

认知模块必须是可移除 Feature，围绕唯一 Runtime，而非第二个 Agent Loop。
