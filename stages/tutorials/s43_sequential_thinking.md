# s43：Sequential Thinking MCP Scratchpad

## 本课目标

书中把 Sequential Thinking Server 作为结构化
scratchpad，用来保存、修订、分支和裁剪思考。它不是把完整思维链暴露给用户，而是让控制器拥有可验证的中间状态。

## 代码地图

- `ThoughtScratchpad.add`：新增带父节点的 thought。
- `revise`：保留旧节点并产生修订节点。
- `pruneBelow`：按分数裁剪低价值分支。
- `chooseStrategy`：根据复杂度选择 direct、ReAct、ToT 或 Reflexion。

## 运行

```sh
deno check stages/s43_sequential_thinking.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s43_sequential_thinking.ts
```

## 练习

- 限制每个父节点最多 3 个分支。
- 保存 `evidenceIds`，禁止没有证据的 thought 进入最终答案。
- 将 scratchpad 操作映射成 MCP `tools/call`，练习客户端/服务端边界。

## 与生产的边界

不要把 scratchpad
当作安全策略。生产仍需统一预算、Trace、脱敏和取消；用户只应看到结论、证据和必要的决策摘要。
