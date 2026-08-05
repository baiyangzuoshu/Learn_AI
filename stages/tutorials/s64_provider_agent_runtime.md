# s64：Provider 集成 Agent Runtime

## 本课目标

让唯一 Agent Runtime 负责 Provider 流式输出、取消、重试、Schema 校验和输出预算，Provider
只实现模型适配器。

## 关键机制

- `ModelProvider.complete` 返回异步流，不把具体模型写死在循环中。
- Runtime 在消费流时检查取消和最大输出长度。
- 最终输出必须符合结构化 Schema，瞬时错误才允许有限重试。

## 运行与练习

```sh
deno check stages/s64_provider_agent_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write stages/s64_provider_agent_runtime.ts
```

1. 为不同 Provider 增加错误分类和指数退避。
2. 把 tool call、prompt、token usage 加入 `RuntimeEvent`。
3. 让 `AbortSignal` 在 Provider、工具和嵌套 Agent 之间贯穿。

## 生产边界

示例 Provider 是本地假实现；生产需要真实凭据、流式协议、速率限制、模型路由和 trace parent 关联。
