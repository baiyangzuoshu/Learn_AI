# s20：综合 Desktop Harness

源码：[s20_comprehensive.ts](../s20_comprehensive.ts)

## 学习目标

- 回顾 s01–s19 如何组合为完整 Harness。
- 使用能力清单和自检工具诊断运行环境。
- 理解教学综合层与生产组合入口的边界。

## 核心机制

`harness_status` 返回阶段能力清单，`harness_self_check` 检查工作区、模型、API
Key、系统提示和持久化目录。综合提示要求选择最小充分能力并验证结果。

## 组合能力，但保持一个循环

s01–s19 并不是 19 套 Agent。工具、权限、Hook、Todo、子
Agent、Skill、压缩、记忆、任务、后台、调度、团队、worktree 与 MCP 最终都围绕同一个 `agentLoop()`
工作。多条平行循环会产生不一致的权限、取消和事件语义。

`harness_status` 展示“已声明能力”，`harness_self_check` 检查工作区、Provider 配置、API
Key、系统提示与持久化目录。两者不能混为一谈：注册了某个工具不代表依赖可用，自检通过也不代表真实任务已验证。

综合系统提示要求模型选择最小充分能力。例如读取一个文件不该启动团队，短任务不该写持久任务图。Harness
越完整，越需要避免每次都动用所有机制。

本课是教学组合层，不是生产入口。生产代码通过
`src/mod.ts`、`AgentRuntime`、`ToolRegistry`、`PromptRegistry` 与 `HarnessFeature` 组合；不能从
`src/` 直接导入 stage。

## 能力依赖图

```text
AgentRuntime
├─ ToolRegistry → permissions → hooks/events
├─ PromptRegistry → skills / memory guidance
├─ context → compaction / persistent tasks
└─ orchestration → background / scheduler / teams / worktrees / MCP
```

## 运行与观察

```sh
deno task s20
```

先调用状态工具，再运行自检；区分能力“声明”和实际运行检查。

## 练习

让清单从 Registry 动态生成，并为每项能力区分 `registered/configured/healthy`。禁用一个依赖，确认综合
Harness 能降级而不是启动失败。
