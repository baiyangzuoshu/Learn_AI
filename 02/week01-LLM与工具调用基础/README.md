# 第 1 周：LLM、上下文与工具调用基础

本周目标是建立 Agent 工程的最小心智模型，不开发完整 Agent，也不需要 API Key。

完成本周后，你需要真正理解：模型负责生成“建议”，应用负责验证和执行；结构化输出约束数据形状，但不能替代事实验证、权限检查和业务规则。

## 本周用时

| 单元 | 内容 | 建议时间 |
|---|---|---:|
| 1 | 模型、上下文和消息角色 | 60 分钟 |
| 2 | 指令、数据、示例和输出契约 | 75 分钟 |
| 3 | Tool calling 五步流程 | 75 分钟 |
| 4 | 自由文本与结构化输出实验 | 150 分钟 |
| 5 | 幻觉、提示注入和验收 | 90 分钟 |

总计约 7.5 小时。可以拆成 5 天，也可以集中在周末完成。

## 推荐顺序

1. 阅读 [01-核心概念.md](./01-核心概念.md)。
2. 不看原文，画出一次 Tool calling 的完整流程。
3. 进入 [lab/README.md](./lab/README.md)，先运行测试和示例校验。
4. 用同一批任务分别完成自由文本和结构化输出实验。
5. 完成 [02-练习与验收.md](./02-练习与验收.md) 中的口试题和设计题。

## 快速开始

```bash
cd 02/week01-LLM与工具调用基础/lab
npm test
npm run validate:example
```

实验只使用 Node.js 内置能力，不需要 `npm install`。

## 本周产物

在 `lab/work/` 中保存：

- `freeform.txt`：自由文本分类结果。
- `structured.json`：按 Schema 生成的分类结果。
- `comparison.md`：两轮结果的格式错误、语义问题和复盘。
- `tool-design.json`：你设计的只读文件统计 Tool Schema。
- `week01-review.md`：对验收题的回答。

## 通过门槛

- `npm test` 全部通过。
- `structured.json` 通过本地校验器。
- 能完整说明 Tool calling 五步流程。
- 能区分 JSON、JSON Schema、Structured Outputs 和 function calling。
- 能举出至少 3 个“即使符合 Schema 也不能直接相信”的例子。
- 能解释为什么工具参数必须由应用再次校验，写操作必须单独授权。

未达到这些门槛时，不进入第 2 周。

## 官方资料

- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [Safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices)

先完成本课程的实验，再把官方文档作为补充。不要一开始陷入 SDK 参数细节。
