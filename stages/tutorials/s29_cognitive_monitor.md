# s29：RAG, Deep Research, and Grounding

## 合并范围

整合 Reasoning Strategies、Sequential Thinking、Deep Research、Research Worker、Citation 和
Grounding。

## 学习重点

Research 是 Planner + 有界
Worker：检索、抓取、质量检查、综合和引用。来源不足、过期或矛盾时必须返回不确定并升级。

## 练习

1. 给抓取增加并发上限、重试、Checkpoint 和 freshness。
2. 加入 Critic 验证每个事实都有来源。
3. 让 UI 流式显示计划、部分发现和最终引用。

## 生产迁移

真实 Search/Fetcher 需要权限、robots、费用预算和审计。
