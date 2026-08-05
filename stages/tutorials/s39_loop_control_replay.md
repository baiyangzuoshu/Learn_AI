# s39：Evidence-first Product Architecture

## 合并范围

整合客服/RAG/Research 产品模式：Router、Retriever、Grounding、Action Guardrail、Answer 与 Human
Escalation。

## 学习重点

每个 Agent 保持窄职责。没有证据先检索；有证据但无授权先升级；可行动时仍受 Tool Policy
约束。这样比一个万能 Agent 更可评估和维护。

## 练习

1. 加入多语料路由和结果 rerank。
2. 给 Answer 强制 citation 结构。
3. 建立人工升级后反馈回流的路径。

## 生产迁移

真实用户流还需产品权限、隐私、客服 SLA 与业务审计。
