# 28: RAG & Memory Service — 检索先于注入

[← s27](../s27_handoff_guardrails/README.md) · [课程地图](../README.md) ·
[s29 →](../s29_cognitive_monitor/README.md)

> “长期记忆是独立服务，不是无限聊天历史”
>
> 生产层：检索记忆。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

全文注入所有记忆会占满上下文，也无法处理租户隔离、删除、过期和不同记忆类型。

## 解决方案

把 semantic、episodic、procedural 记忆结构化保存，并在 Prompt 前按租户与查询检索。

## 工作原理

1. 过滤 tenant、tombstone 与 expiresAt。
2. 生成候选并计算相关度。
3. 按分数排序。
4. 只注入有证据的少量结果。

### 执行链

```text
query → tenant filter → lexical/vector candidates → rerank → cited context
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s28`
- 类型检查：`deno check stages/s28_checkpoint_resume/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

加入其他租户、已删除和已过期记录，确认它们不会出现在结果中。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

示例 embedding
和排序是占位实现；生产需要真实向量、ANN、reranker、迁移、备份、清除派生索引和召回评估。

生产迁移必须通过 `AgentRuntime`、`ToolRegistry`、`PromptRegistry` 和独立 `HarnessFeature`
完成；禁止从 `src/` 或 `desktop/` 直接导入课程代码。

## 动手练习

1. 修改一个阈值或状态转移，写下预期结果并运行本章验证。
2. 增加一个负例，确认失败会留下可定位证据，而不是被吞掉或误报成功。
3. 把本章机制映射到生产模块，列出契约、持久化、权限、Trace、取消和回滚要求。

## 过关标准

- 能画出执行链并解释每个边界由谁强制。
- 能指出示例中的占位实现和至少三项生产缺口。
- 能给出一条可自动化的验收证据，而不是“人工看起来没问题”。

## 下一章

进入 [s29 →](../s29_cognitive_monitor/README.md)，继续补齐生产 Agent 的下一层约束。
