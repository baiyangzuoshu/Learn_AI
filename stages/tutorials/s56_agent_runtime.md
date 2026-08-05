# s56：单一、可取消、有界的 Agent Runtime

## 本课目标

把之前散落的预算、工具调用、事件和停止条件收拢到一个真正可测试的 runtime loop。

## 核心符号

- `RuntimeModel`：模型依赖注入，不把 provider 写死。
- `BoundedAgentRuntime`：统一处理 iteration、tool-call、output 和 cancellation。
- `RuntimeEvent`：记录 model/tool/stop/error，并带有序号。

## 运行

```sh
deno check stages/s56_agent_runtime.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s56_agent_runtime.ts
```

## 练习

- 增加 Tool Schema 校验和权限 callback。
- 让 tool handler 接收 parentRunId、workspace 和 AbortSignal。
- 实现 retryable/non-retryable 错误分类和最大输出截断。

## 与生产的边界

这里用 fake model 验证控制流。生产 provider
必须支持流式输出、重试、遥测、上下文压缩、密钥隔离和真实取消。
