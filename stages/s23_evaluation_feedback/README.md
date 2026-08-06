# 23: Tool Policy — 工具契约与权限共同守边界

[← s22](../s22_structured_tracing/README.md) · [课程地图](../README.md) ·
[s24 →](../s24_retrieval_augmented_memory/README.md)

> “每个工具都要有职责、范围和输出上限”
>
> 生产层：工具安全。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

只注册工具名称无法说明它是否变更状态、需要什么身份范围、输出多大或何时过期。

## 解决方案

把 mutation、scopes、maxOutput 与 Principal 过期时间纳入统一 ToolPolicy。

## 工作原理

1. 读取工具策略元数据。
2. 校验身份未过期。
3. 验证全部 scope。
4. 执行后按策略限制输出。

### 执行链

```text
tool request → policy + principal → authorize → execute → bounded output
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s23`
- 类型检查：`deno check stages/s23_evaluation_feedback/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

移除 read scope、让身份过期并制造超长结果，分别观察拒绝与截断。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

生产策略必须进入统一 Permission 执行面，支持 read-only/mutating/external/dangerous
分类、人工审批和审计。

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

进入 [s24 →](../s24_retrieval_augmented_memory/README.md)，继续补齐生产 Agent 的下一层约束。
