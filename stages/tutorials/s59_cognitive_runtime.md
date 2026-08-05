# s59：模块化 Cognitive Runtime

## 本课目标

把 s50 的静态函数替换成可替换模块和共享
workspace：Perception、Planning、Execution、Evaluation、Attention、Memory。

## 核心符号

- 六个模块接口：每个模块都有明确输入输出。
- `CognitiveRuntime.run`：只有一个有界认知循环。
- `Attention.route`：决定继续、完成还是升级人工。
- `MemoryModule`：在计划前 recall，在完成后 remember。

## 运行

```sh
deno check stages/s59_cognitive_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s59_cognitive_runtime.ts
```

## 练习

- 用 s43 的 strategy selector 替换固定 planning。
- 用 s53 PersistentMemoryStore 实现 MemoryModule。
- 用 s55 evaluator 和 s58 authorize 共同实现 Evaluation/Attention。

## 与生产的边界

课程模块是纯函数/内存依赖。生产需要持久化 workspace、Trace
因果链、并发控制、取消、模型路由和跨会话学习。
