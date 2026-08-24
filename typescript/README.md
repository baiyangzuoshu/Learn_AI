# TypeScript Agent Framework

这是课程 1 的当前主版本。C 语言实现暂时保留在项目根目录的 `C/`，后续按同样的模块边界逐步迁移。

## 结构

```text
main.ts       CLI 入口和依赖组装
agent.ts      Agent Runtime / Agent Loop
provider.ts   DeepSeek Provider
tools.ts      Tool Registry 和 bash Tool
types.ts      公共协议类型
```

执行链：

```text
用户 → DeepSeek → tool_calls → bash → tool 结果 → DeepSeek → 最终回答
```

## 运行

```sh
export DEEPSEEK_API_KEY="你的 DeepSeek API Key"
deno run --allow-env --allow-net --allow-run typescript/main.ts
```

可选配置：

```sh
export DEEPSEEK_MODEL="deepseek-chat"
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
export DEEPSEEK_WORKSPACE="$(pwd)"
```

这是教学和本地实验版本，bash 工具没有生产级权限审批；请只在可信工作区运行。
