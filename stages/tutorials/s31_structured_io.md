# s31：结构化 I/O 与 Schema

## 要解决的问题

模型返回的自然语言适合给人阅读，却不适合直接驱动下一步工具。缺少字段、类型错位或额外文本都会把错误推迟到副作用发生之后。本课建立一条明确边界：**模型输出先解析，再验证，最后才允许执行**。

## 代码地图

- `JsonSchema`：课程使用的最小 schema 类型，只覆盖 object、array 和基础标量。
- `validateSchema`：递归检查类型、必填字段和数组成员，并返回全部错误而不是第一个错误。
- `parseStructuredOutput`：把 JSON 解析错误和 schema 错误统一成可重试的异常。
- `structured_output_validate`：把上述流程暴露成可观察的工具。

## 运行实验

```sh
deno check stages/s31_structured_io.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s31_structured_io.ts
```

先观察启动时的本地校验，再输入一个问题让模型调用工具。可以把 `{"answer":"ok"}` 改成缺少 `answer`
的对象，比较错误如何沿工具结果返回，而不是让循环崩溃。

## 关键观察

1. schema 是协议，不是提示词里的建议。
2. 校验错误应该包含路径（例如 `$.items[1]`），方便模型修复。
3. 生产实现还需要 JSON Schema 完整标准、大小限制、拒绝未知字段和版本号。

## 练习

1. 增加 `additionalProperties: false`，拒绝未声明字段。
2. 为 number 增加 `minimum`、`maximum`。
3. 让工具返回机器可读的 `{valid, errors}`，由上层决定是否重试。

## 与生产的边界

本课的 schema 校验器是教学实现，不能替代成熟校验库。完成后再把“结构化输出”作为独立 Feature 接入生产
Runtime，并为每个工具保存 schema 版本和回归样例。
