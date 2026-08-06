# 39: Evidence-first Product Flow — 用窄职责组成产品

[← s38](../s38_cost_latency_routing/README.md) · [课程地图](../README.md) ·
[s40 →](../s40_cognitive_workspace/README.md)

> “没有证据先检索，没有授权先升级”
>
> 生产层：产品架构。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

把路由、检索、回答和动作全交给万能 Agent，会让质量、权限和失败责任无法单独评估。

## 解决方案

组合 triage、retrieve、ground、act 与 human escalation，每个节点只承担窄职责并传递证据。

## 工作原理

1. 先识别 intent。
2. 无证据时进入检索。
3. 证据充分后形成 grounded answer。
4. 需要动作但无授权时升级人工。

### 执行链

```text
intent → triage → retrieve/ground → act or escalate
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s39`
- 类型检查：`deno check stages/s39_loop_control_replay/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

切换 hasEvidence 与 canAct 组合，确认流程不会跳过检索或权限边界。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

真实产品还需要强制引用结构、多语料路由、业务权限、隐私、SLA、人工反馈回流和业务审计。

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

进入 [s40 →](../s40_cognitive_workspace/README.md)，继续补齐生产 Agent 的下一层约束。
