# LinkUpClient Skill 与静态检查工具实施计划

> 文档状态：待评审  
> 版本：1.0  
> 日期：2026-06-30  
> 实施范围：`01/tools/linkup-check`、`01/skill/linkup-client`  
> 本阶段不实施：MCP、自定义 Agent、Cocos Runtime Bridge、游戏业务修复

## 1. 计划结论

第一阶段先建设两个相互配合的组件：

1. `linkup-check`：提供确定性的 LinkUpClient 静态检查能力。
2. `linkup-client` Skill：告诉 Agent 何时读取项目规则、如何修改项目、修改后必须执行哪些检查。

完成后的最小闭环：

```text
开发者提出需求
→ Agent 加载 linkup-client Skill
→ Agent 检查实际代码和相邻实现
→ Agent 修改 TypeScript / Prefab
→ Agent 运行 linkup-check
→ Agent 根据检查结果修正
→ Agent 汇报改动、验证结果和运行态限制
```

本阶段不创建 MCP。静态检查工具将保持独立 CLI 形态，未来确有需要时可以被 MCP Tool 调用，但不会为 MCP 预先增加协议层。

## 2. 背景

### 2.1 当前目录

```text
01/
├── LinkUpClient/   # Cocos Creator 游戏项目
├── agent/          # 预留：自定义 Agent
├── docs/           # 跨模块设计与实施文档
├── mcp/            # 预留：MCP Server
├── skill/          # 项目 Skill 源码
└── tools/          # 独立开发工具
```

### 2.2 当前问题

Agent 已能读写代码和 prefab，但关键项目约束主要依赖人工记忆：

- prefab 文件名、根节点名与 `UIName` 需要保持一致。
- 控制器中的节点路径必须与 prefab 层级完全匹配。
- UI prefab 默认不预挂控制器，控制器由运行时动态添加。
- 新增全局 UI 时需要同步常量和控制器注册。
- 现有代码中可能存在历史例外，不能把例外误认为规范。
- 规划文档可能已经过期，Agent 必须先检查实际目录和代码。

如果只有 Skill 没有检查器，执行结果仍依赖 Agent 自觉；如果只有检查器没有 Skill，Agent 不知道何时运行、如何解释或处理结果。两者必须一起建设。

## 3. 目标与非目标

### 3.1 目标

- 将 LinkUpClient 稳定规则沉淀为仓库内可版本化的 Skill。
- 将脆弱、可机械验证的规则实现为静态检查。
- 使用一个命令完成项目级检查。
- 同时提供人类可读和机器可读输出。
- 区分新增问题与已知历史问题。
- 让 Agent 在修改前、修改后采用固定工作流。
- 为未来 Runtime MCP 提供可靠的静态基础，但不耦合 MCP。

### 3.2 非目标

- 不修改 LinkUpClient 游戏业务。
- 不自动修复 prefab 或 TypeScript。
- 不启动或控制 Cocos Creator。
- 不检查运行时节点、动画、截图或日志。
- 不恢复已删除的 `packages/`。
- 不开发独立 Agent。
- 不把文件读写封装成 MCP。
- 不在本阶段解决全部 TypeScript 语义分析问题。

## 4. 设计原则

### 4.1 实际代码优先

检查器和 Skill 必须以以下内容为事实来源：

1. 当前文件系统结构。
2. 当前 prefab JSON。
3. 当前 TypeScript 源码。
4. `project.json`、`tsconfig.json` 和配置文件。
5. 仓库中的规则文档。

历史计划文档只能作为背景，不能证明某项能力已经存在。

### 4.2 确定性优先

能机械判断的规则交给检查器，不能稳定机械判断的规则留给 Skill：

| 规则 | 执行者 |
|---|---|
| prefab JSON 是否有效 | 检查器 |
| 文件名与根节点名是否一致 | 检查器 |
| 字面量节点路径是否存在 | 检查器 |
| UI 注册关系是否完整 | 检查器 |
| 应选择哪个相邻界面作为模板 | Skill + Agent |
| UI 是否符合美术效果 | Cocos 人工/未来 Runtime 能力 |
| 是否应重构业务模块 | Agent 与开发者 |

### 4.3 不重复建设

- `linkup-check` 只负责检查，不负责文件编辑。
- Skill 不复制检查器实现，只说明调用方法与结果处理规则。
- 详细项目事实放在 `references/`，`SKILL.md` 保持精简。
- 不在 Skill 中增加 README、安装指南或变更日志。

### 4.4 渐进增强

先完成高确定性规则，再扩展复杂规则。任何新规则必须具备：

- 明确规则 ID。
- 可解释的错误信息。
- 至少一个通过用例和一个失败用例。
- 明确严重级别。
- 对动态代码或历史例外的处理策略。

## 5. 目标目录结构

### 5.1 静态检查工具

```text
01/tools/linkup-check/
├── package.json
├── linkup-check.config.json
├── bin/
│   └── linkup-check.mjs
├── src/
│   ├── cli.mjs
│   ├── config.mjs
│   ├── diagnostics.mjs
│   ├── project-index.mjs
│   ├── prefab-parser.mjs
│   ├── ts-extractor.mjs
│   ├── reporters/
│   │   ├── text-reporter.mjs
│   │   └── json-reporter.mjs
│   └── rules/
│       ├── prefab-json.mjs
│       ├── prefab-root-name.mjs
│       ├── controller-node-paths.mjs
│       ├── ui-registration.mjs
│       └── duplicate-component-attach.mjs
└── test/
    ├── fixtures/
    ├── prefab-json.test.mjs
    ├── prefab-root-name.test.mjs
    ├── controller-node-paths.test.mjs
    └── ui-registration.test.mjs
```

第一版优先使用 Node.js 标准库和内置测试模块，避免为了少量语法提取引入大型依赖。

### 5.2 项目 Skill

```text
01/skill/linkup-client/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── architecture.md
    ├── ui-contracts.md
    └── validation.md
```

不在 Skill 内复制 `linkup-check`。Skill 通过稳定相对路径或工作区路径调用工具。

## 6. linkup-check 设计

### 6.1 命令行接口

统一入口：

```bash
node 01/tools/linkup-check/bin/linkup-check.mjs \
  --project 01/LinkUpClient
```

计划参数：

| 参数 | 说明 |
|---|---|
| `--project <path>` | LinkUpClient 项目根目录 |
| `--rule <id>` | 只运行指定规则，可重复 |
| `--format text\|json` | 输出格式，默认 text |
| `--baseline <path>` | 已知问题基线文件 |
| `--changed` | 后续能力：只检查 Git 变更相关文件 |
| `--help` | 显示帮助 |

退出码：

| 退出码 | 含义 |
|---:|---|
| `0` | 没有未基线化的错误 |
| `1` | 发现规则错误 |
| `2` | 配置、路径或工具自身错误 |

### 6.2 诊断格式

每条诊断必须包含：

```json
{
  "ruleId": "ui/prefab-root-name",
  "severity": "error",
  "file": "assets/BundleLLK/GUI/UIRewardCommon.prefab",
  "line": 16,
  "subject": "UIRewardCommon",
  "message": "Prefab file name is UIRewardCommon but root node name is UIRewardInfo",
  "suggestion": "Align the prefab file name, root node name and UIName before registration"
}
```

文本输出示例：

```text
ERROR ui/prefab-root-name
  assets/BundleLLK/GUI/UIRewardCommon.prefab:16
  Prefab file name is UIRewardCommon but root node name is UIRewardInfo

Summary: 1 error, 0 warnings, 23 passed
```

## 7. 第一版规则

### 7.1 `prefab/json-valid`

检查范围：`assets/BundleLLK/GUI/*.prefab`。

检查内容：

- 文件可读取。
- 内容是合法 JSON。
- 顶层是 Cocos prefab 对象数组。
- 能定位 prefab 根节点。

严重级别：解析失败为 `error`。

### 7.2 `ui/prefab-root-name`

检查内容：

- prefab 文件 basename 与根节点 `_name` 一致。
- 根节点名称非空。
- 同目录中不存在重复根节点名。

原因：`UIManager` 使用 `uiPrefab.data.name` 作为 UI 实例键，名称不一致可能造成查找和销毁错误。

严重级别：不一致为 `error`。

### 7.3 `ui/controller-node-paths`

检查内容：

- 提取控制器中的字面量路径：
  - `getChildByUrl("...")`
  - `AddButtonListener("...")`
  - `AddDelayButtonListener("...")`
  - `AddMOUSEListener("...")`
- 根据控制器名映射同名 prefab。
- 确认路径在 prefab 节点树中存在。
- 检查目标按钮路径是否包含 `cc.Button`。

动态路径处理：

- 字符串拼接、模板变量或函数返回值不判定为错误。
- 无法静态求值的路径输出 `info`，由 Agent 人工确认。

严重级别：

- 路径不存在：`error`。
- 监听路径存在但没有 `cc.Button`：`error`。
- 动态路径无法分析：`info`。

### 7.4 `ui/registration`

检查对象：

- `assets/Scripts/Constant.ts` 中的 `UIName`。
- `assets/Scripts/Manager/UIController.ts` 中的 prefab 展示与控制器挂载。
- `assets/BundleLLK/GUI/` 中的 prefab。
- `assets/Scripts/UI/` 中的 `*UICtrl.ts`。

检查内容：

- `UIName` 指向的全局 UI prefab 存在。
- `UIController` 使用的 `UIName` 已声明。
- `view.addComponent(XUICtrl)` 对应控制器文件存在。
- 同一个全局 UI 不应注册到多个不一致的控制器。

局部动态界面允许不进入统一注册，但必须在 Skill 中明确说明。

严重级别：缺失关系为 `error`，无法确认的局部关系为 `warning`。

### 7.5 `component/duplicate-attach`

检查内容：在同一方法的确定性执行路径中，发现完全相同的：

```ts
this.node.addComponent(SomeComponent)
```

第一版只检查同一方法中的直接重复调用，不尝试完整控制流分析。

严重级别：`warning`。

用途：捕获类似重复挂载 Manager 的高风险代码，但避免把条件分支中的合法挂载判成错误。

## 8. 基线策略

第一次对真实项目执行时，检查器可能发现历史问题。本阶段不自动修改游戏代码。

处理流程：

1. 对 `01/LinkUpClient` 运行完整检查。
2. 输出未经抑制的基线报告。
3. 人工确认每条诊断是缺陷、历史兼容行为还是规则误报。
4. 缺陷进入后续修复清单。
5. 暂时不能修复的问题写入精确基线文件。

基线要求：

- 使用 `ruleId + file + subject + message fingerprint` 精确匹配。
- 禁止目录级和规则级通配忽略。
- 每条基线记录原因。
- 新增问题仍然导致退出码 `1`。
- 规则改进后重新审查基线，不能永久隐藏问题。

计划文件：

```text
01/tools/linkup-check/linkup-check.baseline.json
```

## 9. linkup-client Skill 设计

### 9.1 Skill 定位

Skill 名称：`linkup-client`。

触发范围应覆盖：

- 修改 LinkUpClient TypeScript。
- 创建或修改 `assets/BundleLLK/GUI/*.prefab`。
- 新增或修改 UI 控制器。
- 排查 UI 节点路径、UI 注册或适配问题。
- 修改玩法组件、Manager 或 Cocos 资源引用。
- 对 LinkUpClient 进行项目级代码检查。

描述必须写入 `SKILL.md` frontmatter，正文不重复“何时触发”。

### 9.2 SKILL.md 内容

正文保持精简，预计包含：

1. 事实来源优先级。
2. 修改前检查步骤。
3. UI 修改工作流。
4. 非 UI 代码修改工作流。
5. `linkup-check` 调用方式。
6. 运行态能力限制。
7. 最终交付清单。

`SKILL.md` 不复制完整架构、节点规范和检查规则说明，详细内容放入 `references/`。

### 9.3 References

`architecture.md`：

- Cocos 版本和入口。
- Manager、EventManager、UIManager 关系。
- 动态 Component 挂载方式。
- 游戏核心模块边界。

`ui-contracts.md`：

- `750 × 1334` 竖屏基线。
- `top`、`bottom`、`bg`、`mask` 等分组。
- 模态遮罩、弹窗、Toast 常用尺寸。
- prefab、根节点、`UIName` 和控制器命名关系。
- 节点路径作为代码 API。
- 可复用资源位置。

`validation.md`：

- 检查命令。
- 规则 ID 与严重级别。
- baseline 的使用限制。
- Cocos 最终视觉验证要求。

### 9.4 与现有个人 Skill 的关系

当前个人环境中已有 `linkup-cocos-ui-prefab` Skill。实施时采用以下迁移策略：

1. 以 `01/skill/linkup-client` 作为仓库内唯一事实源。
2. 将现有 UI 规则迁移到新 Skill 的 `references/ui-contracts.md`。
3. 新 Skill 验证通过前，不删除或覆盖现有个人 Skill。
4. 新 Skill 完成隔离场景验证和后续真实任务闭环后，再决定安装、替换或停用旧 Skill。
5. 避免两个描述高度重叠的 Skill 长期同时启用。

## 10. 实施里程碑

### M0：冻结计划与样本

交付：

- 本计划评审通过。
- 确认目录和命名。
- 保存代表性 prefab、控制器和注册关系作为测试样本。
- 记录当前项目的未经抑制基线结果。

退出条件：范围不再包含 MCP、Runtime 或自动修复。

### M1：CLI 骨架与 prefab 基础规则

交付：

- CLI 参数和退出码。
- 项目路径解析。
- text/json reporter。
- `prefab/json-valid`。
- `ui/prefab-root-name`。
- 单元测试。

退出条件：能稳定检查全部 GUI prefab，并报告已知根节点异常。

### M2：控制器节点路径规则

交付：

- TypeScript 字面量路径提取。
- prefab 节点树索引。
- 按钮组件检查。
- 动态路径降级策略。
- 单元测试和真实项目验证。

退出条件：对代表性 UI 控制器无误报，能检测构造的缺失路径。

### M3：UI 注册与重复挂载规则

交付：

- `UIName` 提取。
- `UIController` 注册关系提取。
- prefab、控制器、常量交叉检查。
- 同方法重复 `addComponent` 警告。

退出条件：能输出完整关系诊断，不能解析的代码明确降级而非误判。

### M4：基线与项目级稳定性

交付：

- 精确 baseline 格式。
- baseline 匹配和过期检测。
- 完整项目报告。
- `git diff --check` 与 CLI 测试通过。

退出条件：历史问题不会阻断采用，新问题仍会使检查失败。

### M5：Skill 创建与验证

交付：

- 使用 `skill-creator` 的初始化脚本创建 Skill。
- 完成 `SKILL.md`、`agents/openai.yaml` 和 references。
- 使用 `quick_validate.py` 验证 Skill。
- 将检查命令写入强制工作流。

退出条件：Skill 格式合法、触发描述明确、正文精简且无规则重复。

### M6：闭环验收

选择至少三个代表性隔离任务，使用 fixtures、临时副本或只读诊断，不修改真实项目：

1. 修改现有弹窗中的按钮或文本节点。
2. 新增一个小型弹窗并注册控制器。
3. 排查一个节点路径或重复挂载问题。

每个任务必须执行：

- 修改前检查。
- 最小范围修改。
- `linkup-check`。
- TypeScript/JSON 检查。
- 结果汇报。

退出条件：Skill 能稳定引导 Agent 使用检查器，检查器能给出可操作诊断，并且 `01/LinkUpClient` 没有因验收任务产生改动。

## 11. 测试策略

### 11.1 单元测试

使用 Node.js 内置 `node:test`：

- 正常 prefab。
- JSON 损坏 prefab。
- 文件名与根节点名不一致。
- 存在与缺失的节点路径。
- 非 Button 节点绑定按钮监听。
- 动态路径表达式。
- 完整与缺失的 UI 注册。

### 11.2 集成测试

- 对 `01/LinkUpClient` 全量执行。
- JSON 输出必须可解析。
- 同一版本连续执行结果必须一致。
- 使用临时 fixture 制造一个新问题，确认退出码为 `1`。
- 移除临时问题后确认结果恢复。

### 11.3 Skill 验证

- `quick_validate.py` 通过。
- `agents/openai.yaml` 与 `SKILL.md` 描述一致。
- 通过隔离场景验证触发和执行流程。
- 如需独立前向验证，必须先获得用户允许再启动额外 Agent。

## 12. 验收标准

### 12.1 工具验收

- 一个命令可以检查整个 LinkUpClient。
- 无依赖网络即可运行。
- text 与 JSON 输出语义一致。
- 错误包含规则、文件、位置、原因和建议。
- 未基线化错误返回退出码 `1`。
- 工具自身失败返回退出码 `2`。
- 所有规则有通过和失败测试。
- 对真实项目重复运行结果稳定。

### 12.2 Skill 验收

- Skill 名称符合小写连字符规范。
- frontmatter 只有 `name` 和 `description`。
- 触发描述覆盖 LinkUpClient 代码、GUI 和检查任务。
- `SKILL.md` 不超过 500 行，且只保留核心流程。
- 详细知识按需放入一层 references。
- 修改后必须执行 `linkup-check`。
- 明确 Cocos 仍是最终视觉验收环境。
- Skill 验证脚本通过。

### 12.3 闭环验收

- Agent 能从实际目录发现 LinkUpClient。
- Agent 不依赖旧 `packages` 或 Inspector 文档。
- Agent 能遵循节点路径和动态控制器契约。
- Agent 能解释检查失败并实施最小修正。
- Agent 不会把静态检查通过描述为运行时或视觉验证通过。

## 13. 风险与应对

| 风险 | 应对 |
|---|---|
| 正则提取 TypeScript 产生误报 | 第一版只分析明确字面量，动态表达式降级为 info |
| 历史问题导致工具无法采用 | 使用精确 baseline，不使用通配忽略 |
| Skill 与代码逐渐漂移 | 仓库内 Skill 为事实源，场景验证后更新 |
| 新旧 Skill 同时触发 | 验证新 Skill 后停用重叠旧 Skill |
| 检查器范围不断扩张 | 每条新规则必须有明确 ID、测试和收益 |
| 把静态检查当成视觉验证 | Skill 和输出明确标注运行态限制 |
| 工具依赖环境版本 | 第一版使用 Node 标准库，启动时检查 Node 版本 |

## 14. 实施约束

- 在本计划批准前不创建工具或 Skill 文件。
- 实施期间不修改 `01/LinkUpClient` 业务代码，除非另行授权。
- 所有新文件限定在 `01/tools/`、`01/skill/` 和 `01/docs/`。
- 不安装第三方依赖，除非标准库无法满足并单独说明理由。
- 不创建 MCP、Runtime Bridge 或自定义 Agent。
- 不自动修复检查发现的问题。
- 每个里程碑完成后先展示结果，再进入下一个里程碑。

## 15. 计划完成定义

当以下条件全部满足时，第一阶段完成：

1. `linkup-check` 可以稳定检查真实项目。
2. 第一版五条规则均有测试。
3. 历史问题通过报告和精确 baseline 管理。
4. `linkup-client` Skill 创建并验证通过。
5. 至少三个代表性隔离任务完成闭环验收。
6. 没有引入 MCP、Runtime 或业务代码耦合。
7. 文档、Skill 和 CLI 中的目录及命令一致。

## 16. 后续阶段入口

第一阶段稳定后，再根据实际痛点决定是否进入：

- Runtime 观察 MCP：节点树、属性、日志、截图。
- 游戏后台 MCP：玩家、关卡、订单和远程日志。
- 自定义 Agent：仅在现有 Agent 无法满足长期任务编排时考虑。

后续阶段不能因为“技术完整性”自动启动，必须由真实需求和收益驱动。
