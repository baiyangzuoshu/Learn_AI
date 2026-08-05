# s35：TDAD、Rubric 与反馈

## 要解决的问题

只看一次对话“感觉不错”无法证明 Agent 变好了。评测要把要求拆成可重复的
rubric，把失败保留为回归样例，再把 Trace 和反馈送回开发流程。

## 代码地图

- `Rubric`：为每个标准声明权重和是否必需。
- `evaluate`：计算加权分数、必需项失败和修复建议。
- `phoenixLikeTrace`：把事件压成可检索的序列、输出长度和错误标记。
- `evaluation_feedback_run`：在工具边界运行一次评测。

## 运行

```sh
deno check stages/s35_evaluation_feedback.ts
deno run --allow-env --allow-net --allow-run --allow-read --allow-write --env-file=.env.local stages/s35_evaluation_feedback.ts
```

使用一个只满足普通标准、不满足 required 标准的答案，观察 `score` 可能很高但 `passed` 仍为 false。

## 评测闭环

1. TDAD：先写任务、期望工具调用和安全负例，再实现。
2. Critic：检查答案与证据，而不是只检查字符串相似度。
3. Rubric：固定判分维度，避免每次人工标准漂移。
4. Trace/Phoenix：定位是检索、规划、工具还是模型输出失败。
5. Feedback：将失败样例加入回归集，比较改动前后分数。

## 练习

- 增加 groundedness 检查，要求答案包含证据 ID。
- 记录每个 rubric 的 before/after，生成差异报告。
- 加入“不可接受行为”负向测试，例如泄露密钥或绕过权限。

## 与生产的边界

字符串包含只是教学代理指标。生产评测要结合结构化断言、人工抽样、模型裁判校准和隐私处理；评测数据不得混入用户秘密。
