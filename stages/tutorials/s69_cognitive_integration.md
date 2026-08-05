# s69：Cognitive Runtime 端到端集成

## 本课目标

把 s59 的六个认知模块接上真实 Provider、Memory 和
Executor，形成一个共享工作区、受置信度门控、可取消的闭环。

## 关键机制

- Provider 产生下一步和置信度，不直接绕过 Attention。
- Memory 在运行开始召回、完成后记录，形成跨会话反馈。
- 低置信度升级，达到完成证据才结束，最大迭代数是硬上限。

## 运行与练习

```sh
deno check stages/s69_cognitive_integration.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s69_cognitive_integration.ts
```

1. 把 s63 MemoryDatabase 接入 `CognitiveMemory`。
2. 把 s64 ProviderRuntime 接入策略选择，并记录 trace。
3. 增加矛盾、停滞、知识缺口和回滚状态。

## 生产边界

示例模块仍是轻量适配器；生产需要共享 workspace 持久化、跨模块观测、权限边界和恢复协议。
