# s89：Cognitive Production Adapter

## 本课目标

将 Perception、Planning、Execution、Evaluation、Attention 和 Memory
接入一个生产级、可取消、可观测的主循环。

## 核心机制

- 共享 evidence 工作区，不让模块通过隐式全局状态通信。
- 低置信度升级，重复输出触发停滞升级。
- 完成、升级和停止都有明确状态和指标。

## 练习

1. 接入 s85 Memory、s86 Evaluation 和 s81 Runtime。
2. 增加知识边界、矛盾检测、策略 Pivot 和回滚。
3. 记录 cognitive efficiency：迭代数、证据数、置信度和升级率。

## 生产边界

课程组件是注入式实现；生产需要持久化 Workspace、跨服务 Trace 和权限上下文。
