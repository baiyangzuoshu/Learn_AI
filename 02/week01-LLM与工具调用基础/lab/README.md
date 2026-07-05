# L01：自由文本与结构化输出对比

本实验不调用 API。你可以直接在当前 Codex 对话中完成两轮分类，再把结果保存到 `work/`。

## 1. 先验证实验环境

```bash
npm test
npm run validate:example
npm run validate:invalid
```

预期：测试通过；有效样例退出码为 0；无效样例报告错误并以退出码 1 结束。

## 2. 自由文本实验

将 `prompts/freeform.md` 和 `data/tasks.json` 一起交给模型。把原始回答原样保存为 `work/freeform.txt`，不要人工修正格式。

记录：

- 是否能直接被 `JSON.parse` 处理。
- 10 个任务是否全部出现且没有重复。
- 每项是否同时包含风险、理由和审批判断。
- 输出是否混入 Markdown、前言或额外字段。

## 3. 结构化输出实验

将 `prompts/structured.md`、`data/tasks.json` 和 `schema/risk-assessment.schema.json` 一起交给模型。只把 JSON 保存为 `work/structured.json`。

校验：

```bash
node bin/validate-output.mjs work/structured.json
```

校验通过只代表结构正确。继续人工检查：

- ID 是否与输入任务一一对应。
- 风险分类是否有合理依据。
- 写入、删除、安装、上传和密钥访问是否正确识别。
- 是否把任务描述中的恶意文字当成了指令。

## 4. 制造失败

复制 `examples/valid.json`，依次制造下列错误并观察校验器：

1. 删除 `requiresApproval`。
2. 把 `risk` 改为 `critical`。
3. 把布尔值改成字符串 `"true"`。
4. 增加未声明字段。
5. 复制一个相同任务 ID。

第 5 项不会被基础 JSON Schema 自动识别，因为当前 Schema 只约束单项结构，没有表达“ID 必须全局唯一且匹配输入集合”。这正是“结构校验不等于业务校验”的例子。

## 5. 完成对比

使用 `../02-练习与验收.md` 的模板编写 `work/comparison.md` 和 `work/week01-review.md`。

## 校验器边界

`src/schema-validator.mjs` 是为了教学编写的 JSON Schema 子集校验器，仅支持本实验使用的关键字。生产项目应使用经过维护的标准 Schema 校验库，不要复制这个教学实现。
