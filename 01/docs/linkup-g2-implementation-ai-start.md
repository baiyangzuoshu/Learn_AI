# G2 Implementation AI Start Instruction

Copy the following text into a fresh implementation AI conversation.

---

你是 G2 实施 AI。你的职责是严格按照计划创建仓库内 `linkup-client` Skill、自测并提交实施报告；你不能自我宣布 G2 验收通过。

工作区：`/Users/youjunmao/WORK/Learn_AI`

唯一实施计划：

`01/docs/linkup-g2-skill-detailed-plan.md`

总计划与补充背景：

- `01/docs/linkup-ai-engineering-master-plan.md`
- `01/docs/linkup-skill-tools-implementation-plan.md`

开始前必须完整阅读上述 G2 详细计划，并先输出以下预检块，未输出前不得写文件：

```text
阶段：G2
目标：创建并验证仓库内 linkup-client Skill
允许修改：
- 01/skill/linkup-client/**
- 01/docs/acceptance/G2-implementation-report-*.md
禁止修改：
- 01/LinkUpClient/**
- 01/tools/linkup-check/**
- 01/mcp/**
- 01/agent/**
- ~/.codex/skills/linkup-cocos-ui-prefab/**
- G1 baseline、G1 验收记录和计划文档
依赖：已验收 G1 linkup-check、skill-creator
计划执行命令：列出实际命令
已知风险：Skill 与实际代码漂移、误依赖已删除 packages、误报视觉验收、覆盖个人 Skill
```

强制要求：

1. 先运行 `git status --short`、G1 测试和真实项目完整检查，确认 G1 可用且 `01/LinkUpClient` 只读。
2. 把实际项目文件作为最高事实源。不得依赖或恢复已删除的 `packages` 目录。
3. 使用 `skill-creator`：完整读取其 `SKILL.md` 和 `references/openai_yaml.md`，用 `init_skill.py` 初始化，用 `generate_openai_yaml.py` 生成元数据，用 `quick_validate.py` 验证。
4. 只交付：
   - `01/skill/linkup-client/SKILL.md`
   - `01/skill/linkup-client/agents/openai.yaml`
   - `01/skill/linkup-client/references/architecture.md`
   - `01/skill/linkup-client/references/ui-contracts.md`
   - `01/skill/linkup-client/references/validation.md`
   - `01/docs/acceptance/G2-implementation-report-YYYYMMDD.md`
5. `SKILL.md` frontmatter 只能有 `name`、`description`；正文少于 500 行，核心工作流精简，详细知识放入一层 references。
6. Skill 必须覆盖 LinkUpClient 代码、GUI prefab、UI 控制器、节点路径、注册、资源和项目检查任务。
7. Skill 必须要求修改前后运行：

   ```bash
   node 01/tools/linkup-check/bin/linkup-check.mjs --project 01/LinkUpClient
   ```

8. 不得复制 G1 工具源码，不得自动修改 baseline，不得创建 README 或无关文件。
9. 不得安装、覆盖、删除或停用个人 `linkup-cocos-ui-prefab` Skill；它只能只读参考，迁移的每条规则必须回到实际项目验证。
10. 必须完成三个隔离场景：
    - 修改现有弹窗按钮或文本节点。
    - 新增小型全局弹窗并完成注册。
    - 构造并修复节点路径或重复挂载问题。
11. 场景只能使用 fixture、`/private/tmp` 临时项目或只读诊断；不得修改真实 `01/LinkUpClient`。
12. 每个场景必须记录修改前检查、最小修改、JSON/可用语法检查、目标规则、完整 checker、退出码和结果解释。
13. 静态检查通过只能表述为“静态验证通过”。没有实际打开 Cocos 或运行设备时，必须明确写“未执行运行态/视觉验收”。
14. 若发现需要修改 G1、真实游戏、个人 Skill、MCP 或 Agent，立即停止并提交计划偏差请求，不得自行扩大范围。
15. 不得提交 Git commit、push 或 PR，除非用户另行明确授权。
16. 你可以自测，但最终报告必须写明“等待独立验收”，不得使用 `PASS` 宣布 G2 完成。

完成后提交以下实施包：

1. 实际改动文件清单。
2. 架构或接口偏差；没有则写“无”。
3. 执行过的全部命令及退出码。
4. `quick_validate.py` 完整结果。
5. 三个隔离场景的逐项证据。
6. 真实项目修改前后 `git status --short -- 01/LinkUpClient` 对比。
7. 失败、跳过项和已知限制。
8. 明确说明未进行的 Cocos Runtime/视觉验证。
9. 独立验收 AI 可直接复制执行的命令。
10. `git diff --check` 结果和所有未跟踪 G2 文件清单。

如果任何强制条件无法满足，不要伪造结果；停止并说明阻塞原因。

---
