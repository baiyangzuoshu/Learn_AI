# s79：生产 Cognitive Loop

## 本课目标

把认知模块连接成一个受限闭环：策略选择、证据、执行、记忆、置信度、停滞检测和升级共享同一个
Workspace。

## 核心机制

- 低置信度不执行，直接升级。
- 连续无变化触发 stagnation escalation，防止重复搜索。
- 完成后记录经验，下一次运行可以召回。

## 练习

1. 接入 s75 Memory Service 和 s76 Evaluator。
2. 增加知识边界、矛盾证据和策略 pivot。
3. 为每个认知模块增加 Trace、预算和权限上下文。

## 生产边界

课程使用注入式 Selector/Runner；生产需要真实 Provider、Workspace 持久化和跨模块恢复。
