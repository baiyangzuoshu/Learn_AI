# 40: Architecture Capstone — 六层证据收束系统

[← s39](../s39_loop_control_replay/README.md) · [课程地图](../README.md) · 终点

> “完整 Agent 系统 = 一个有界 Runtime + 可移除 Feature”
>
> 生产层：架构总验收。本章把前二十课的教学机制收紧为可执行、可观察、可验收的约束。

## 本章目标

学完后，你应该能说明该能力为什么属于生产
Harness、它依赖哪些证据，以及缺少哪项检查时必须阻断迁移或发布。

## 问题

局部能力全部“看起来可用”时，系统仍可能缺协议、知识、评估、安全或运营闭环。

## 解决方案

用 runtime、protocol、knowledge、evaluation、security、operations 六层 CapstoneCheck
判断整体迁移资格。

## 工作原理

1. 逐层关联真实自动化证据。
2. 任何失败都返回 failed 列表。
3. 先补证据再允许 Promotion。
4. 一次只迁移一个可回滚 Feature。

### 执行链

```text
all course evidence → six-layer capstone → ready / fix evidence → production migration
```

这里的类和函数是可运行的最小模型，用来暴露状态机与边界；它们不是生产服务的替代品。

## 读代码

- 实现：[code.ts](./code.ts)
- 运行：`deno task s40`
- 类型检查：`deno check stages/s40_cognitive_workspace/code.ts`

先读导出的类型与纯函数，再看课程工具如何构造一个最小示例，最后追踪 Prompt Section 如何把原则加入统一
Harness。

## 观察清单

让六层逐一失败，确认 next 建议始终阻止无证据晋级，并为每层找到仓库中的生产对应模块。

观察时要区分“示例返回了正确
JSON”和“生产系统具备持久化、并发、安全、取消与运营证据”这两个完全不同的结论。

## 边界与生产差距

Capstone 不是发布平台；最终仍要通过格式、类型、架构扫描、桌面打包和目标操作系统真实运行验证。

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

完成课程后，从一个小型能力开始设计 HarnessFeature，并用完整生产检查验证迁移。
