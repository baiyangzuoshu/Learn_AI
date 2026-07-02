# G5 计划包（基于实际文件核对）

> 日期：2026-07-02  
> 角色：规划/验收 AI  
> 范围：仅 G5 计划，不进入 G5 实现

## 1. 文件核对结论

### 实际检查文件

- `01/docs/linkup-ai-engineering-master-plan.md`
- `01/docs/linkup-agent-implementation-plan.md`
- `01/docs/decisions/ADR-MCP-002-runtime-adapter.md`
- `01/docs/acceptance/G1-acceptance-20260630.md`
- `01/docs/acceptance/G2-implementation-report-20260701.md`
- `01/docs/acceptance/G3-implementation-report-20260701.md`
- `01/docs/acceptance/G4.1-spike-report-20260701.md`
- `01/docs/acceptance/G4.2-implementation-report-20260702.md`
- `01/docs/acceptance/G4.2-fix-report-20260702.md`
- `01/mcp/linkup-dev-mcp/**` 当前结构
- `01/agent/**` 当前结构
- 当前工作区 `git status`

### 文件事实

- `git status` 当前无未提交改动，分支为 `main...origin/main`。
- `01/agent/` 当前为空，G5 尚未落地。
- `01/mcp/linkup-dev-mcp/` 当前已存在 G3 静态 MCP 与 G4 Runtime 相关源码、测试、构建产物与配置。
- `01/docs/decisions/` 当前只有：
  - `ADR-MCP-001-sdk-and-protocol.md`
  - `ADR-MCP-002-runtime-adapter.md`
- 当前没有：
  - `ADR-AGENT-001-eval-format.md`
  - `01/agent/linkup-agent-evals/**`
  - `G5` 相关验收记录

### 与历史说法一致/不一致

一致：

- G4.1 和 G4.2 的文档、代码与目录都真实存在。
- G4.2 代码层面的 Runtime 结构已进入 `01/mcp/linkup-dev-mcp/src/runtime/**` 与对应 tools/tests。

不一致：

- “G3 已独立验收通过”没有文件证据。现有 `G3-implementation-report-20260701.md` 头部仍写明 `Waiting for independent verification (2nd round)`。
- “G4.1 已独立验收通过”没有文件证据。现有 `G4.1-spike-report-20260701.md` 头部仍写明 `预研完成，等待审查`。
- “G4.2 已完成 GUI/CDP 真实联调并最终闭环验收通过”没有文件证据。现有两个 G4.2 报告都写明 `等待独立验收`，且正文仍保留“需 GUI 验证/仍需人工 GUI 复验”。
- G1 文件名虽为 `acceptance`，但头部状态仍写 `Self-test complete ... awaiting independent acceptance`，严格说也不是独立验收 PASS 记录。

## 2. G5 定义还原

### 主计划中的 G5 原始目标

来自 `01/docs/linkup-ai-engineering-master-plan.md`：

- G5 标题：`Agent Evals`
- 原始目标：`将完整工作流转换为可复用验收场景。`
- 详细计划：执行 `linkup-agent-implementation-plan.md` 中 `AP0–AP7`

### G5 在路线图中的位置

G5 不是业务功能开发阶段，而是评测/验收基础设施阶段。它位于：

- G1：Tools
- G2：Skill
- G3：MCP
- G4：Runtime（按需求插入，非默认必做）
- G5：Agent Evals
- G6：完整闭环试运行

也就是说，G5 的职责不是“新增业务能力”，而是把前面已有能力组织成：

- 场景 schema
- 场景集
- fixture / temp-copy 隔离机制
- runner
- 证据收集与评分
- 独立验收入口

### G5 的原始交付定义

主计划要求 G5 必须交付：

- Scenario Schema
- 至少九个启用场景；Runtime 场景可在 G4 前禁用
- 明确 `allowed paths`、`required evidence`、`must/must-not assertions`
- 人工可执行的评分规则
- 如有 runner，只负责记录和评分，不调用模型

子计划把 G5 进一步拆成：

- AP0 决策
- AP1 Schema 与校验
- AP2 Fixture 管理
- AP3 基础场景（E001–E004）
- AP4 修改场景（E005–E006）
- AP5 MCP 与权限场景（E007–E009）
- AP6 Runner 与评分
- AP7 G5 提交包

## 3. G5 开工条件判断

### 前置是否满足

- 对“开始做 G5 计划”：满足
- 对“开始做受限版 G5 实现”：条件满足，但只能做非 Runtime 最小版
- 对“开始做可正式独立验收的完整 G5 实现”：当前文件证据不足

### 已满足项

- G5 在主计划与子计划中定义清楚，足以支撑计划编写。
- G5 目标目录和目标结构已明确。
- G5 所依赖的主要输入物在文件层面存在：
  - G1 工具目录已存在
  - G2 Skill 文档已存在
  - G3/G4 MCP 目录已存在
- G5 是否可不依赖 Runtime 已写清楚：Runtime 场景可在 G4 前禁用。
- 当前工作区干净，适合后续实施 AI 受控落地。

### 未满足项

- 没有找到 G1/G2/G3/G4 的独立验收 PASS 记录。
- G4.2 没有找到 GUI/CDP 真实联调已通过的独立验收证据。
- `ADR-AGENT-001-eval-format.md` 尚不存在。
- `01/agent/linkup-agent-evals/**` 尚不存在。
- G5 若要把 Runtime 观察场景作为启用场景，需要先有 G4 PASS 证据；当前没有。

### 是否可以开始做 G5 计划

可以。  
文件定义已足够，且缺口可以被明确标注，不阻断计划编制。

### 是否可以开始做 G5 实现

结论分两层：

- 可以开始做“最小 G5 实现版”：仅做 E001–E009 的非 Runtime 主体，E010 Runtime 场景保持 disabled。
- 不建议直接进入“完整 G5 正式实现并宣称可验收通过”：因为输入基线（尤其 G2/G3/G4 的独立验收状态）没有被文件证据冻结，后续容易返工。

### G5 是否需要建立在 G4 Runtime 已完成基础上

不需要，前提是：

- G5 第一版只交付非 Runtime 主体；
- Runtime 观察场景 `E010` 保持 disabled。

如果目标是“包含 Runtime 观察场景的完整 G5 套件”，则需要 G4 Runtime 已通过独立验收，而当前文件不能证明这一点。

## 4. G5 范围说明

### 范围内

- `01/agent/linkup-agent-evals/**` 下的 schema、scenarios、fixtures、runner、test
- `01/docs/decisions/ADR-AGENT-001-eval-format.md`
- `01/docs/acceptance/G5-*.md`
- `/tmp/linkup-agent-evals/**` 作为临时运行目录
- G5 的评分规则、证据格式、权限断言、硬失败规则
- 非 Runtime 场景 E001–E009
- Runtime 场景 E010 的预留定义与 disabled 状态

### 范围外

- `01/LinkUpClient/**` 业务代码修改
- `01/tools/**`、`01/skill/**`、`01/mcp/**` 的返工或扩展
- G4 Runtime 的补实现、补验收、补 GUI 联调
- 自定义 Agent Host
- 模型 API、Key、远程服务、长期任务队列、多 Agent 自动协作
- Git commit/push/PR

### 默认禁止项

- 真实 LinkUpClient 写入
- 网络安装依赖
- 启动外部服务或运行 GUI/CDP 联调
- 让 runner 调用模型
- 让 runner 自行宣布系统 PASS
- 把 Runtime 临时观察结果描述成 prefab/源码已保存

## 5. G5 计划表

| 工作包 ID | 工作包名称 | 目标 | 输入依赖 | 产出物 | 完成标准 | 风险点 | 建议顺序 |
|---|---|---|---|---|---|---|---|
| G5-WP0 | 输入冻结与偏差登记 | 明确 G5 基于哪些现有文件事实实施，记录未验收输入基线 | 主计划、Agent 子计划、G1-G4 当前文件状态 | `G5` 计划缺口说明、输入清单 | 明确“基于当前树实施”还是“等待独立验收后实施” | 把未冻结输入当稳定接口，后续返工 | 1 |
| G5-WP1 | AP0 评测格式决策 | 固化 scenario/result 格式、runner 技术栈、artifact 保留策略 | 主计划 G5、Agent 子计划 AP0 | `ADR-AGENT-001-eval-format.md` | ADR 存在，范围不越权，不引入模型调用 | ADR 不清导致后续 schema/runner 返工 | 2 |
| G5-WP2 | AP1 Schema 与校验 | 建立 scenario/result schema 与校验测试 | WP1 决策 | `schemas/*.json`、schema tests | schema 可解析；字段覆盖 permissions/assertions/scoring；测试通过 | schema 过宽导致场景无法验收 | 3 |
| G5-WP3 | AP2 Fixture 与隔离 | 建立 temp-copy/fixture/hash/forbidden diff 机制 | WP1、WP2 | `fixtures/**`、manifest、prepare-run 测试 | 可在 `/tmp/linkup-agent-evals` 隔离运行；真实项目零写入 | 路径边界漏出，污染真实项目 | 4 |
| G5-WP4 | AP3 基础场景 | 落地 E001–E004：事实优先、拒绝陈旧文档、诊断能力 | WP2、WP3；G1/G2 当前接口 | `scenarios/E001-E004` | 场景可校验、权限完整、证据要求明确 | 诊断场景与真实规则不一致 | 5 |
| G5-WP5 | AP4 修改场景 | 落地 E005–E006：只改临时副本，形成 Skill+Tools 闭环 | WP2、WP3；G1/G2 当前接口 | `scenarios/E005-E006`、fixture diff 断言 | 只允许 temp-copy 写入；输出必须能映射验证命令 | 场景设计过大，超出最小修改原则 | 6 |
| G5-WP6 | AP5 MCP 与权限场景 | 落地 E007–E009；定义 E010 disabled | WP2、WP3；G3/G4 当前接口 | `scenarios/E007-E010` | E007-E009 启用；E010 存在但 disabled（若无 G4 PASS） | 把未验收 Runtime 当可用输入 | 7 |
| G5-WP7 | AP6 Runner 与评分 | 实现 prepare/collect/score/summarize；runner 不调用模型 | WP2–WP6 | `runner/**`、runner tests、评分规则 | runner 只做准备/记录/评分；hard fail 有自动判定 | runner 越界成“半个 agent” | 8 |
| G5-WP8 | AP7 提交包与独立验收入口 | 形成场景清单、样例 artifact、测试摘要、验收命令 | WP1–WP7 | `G5` 提交包文档、样例 run artifacts、验收记录草稿 | 能直接交给独立验收者复跑 | 证据不全，无法复验 | 9 |

### G5 最小可交付版本

最小可交付版本应为：

- AP0–AP7 完成
- 至少九个启用场景可执行
- 对应子计划的 E001–E009 全部启用
- E010 Runtime 观察场景可存在，但在 G4 未独立 PASS 前保持 disabled
- Runner、fixtures、schema、scoring、样例 artifacts、独立验收命令齐备

## 6. G5 独立验收表

| 验收项 ID | 验收目标 | 验收方法 | 通过标准 | 备注 |
|---|---|---|---|---|
| G5-A01 | Schema 合法 | 校验所有 scenario/result 文件 | 全部通过 schema 校验 | 对应主计划 G5-01 |
| G5-A02 | 启用场景数量达标 | 列出 `scenarios/` 并核对 `enabled` | 至少 9 个启用场景；若有 E010，可 disabled | 对应主计划 G5-02 |
| G5-A03 | 路径边界正确 | 抽查所有写场景 permissions | 每个写任务均有 `allowedWritePaths`，且不含真实项目路径 | 对应主计划 G5-03 |
| G5-A04 | 证据要求完整 | 抽查 assertions/evidence 定义 | 每个场景均定义 `requiredEvidence`/等价字段并可执行 | 对应主计划 G5-04 |
| G5-A05 | 反事实能力存在 | 执行 E002 或等价场景 | Agent 不把历史 Inspector 文档当成已实现事实 | 对应主计划 G5-05 |
| G5-A06 | 视觉边界存在 | 执行 E008；若 E010 disabled 则检查禁用理由 | 无 Runtime 证据时不声称视觉验收通过 | 对应主计划 G5-06 |
| G5-A07 | 真实项目零写入 | 比较运行前后真实工作区 | `01/LinkUpClient/**`、`01/tools/**`、`01/skill/**`、`01/mcp/**` 无未授权变化 | 对应子计划 23.2 |
| G5-A08 | Runner 不越权 | 检查 runner 源码与测试 | runner 不调用模型、不做网络、不做 Git mutation | 对应子计划 AP6 / 23.2 |
| G5-A09 | 场景行为覆盖 | 核对 E001–E009 分类覆盖 | 事实优先、诊断、修改、MCP、权限边界均被覆盖 | 对应子计划 23.3 |

### 独立验收应如何验

独立验收顺序建议固定为：

1. 读 `ADR-AGENT-001` 与 G5 提交包。
2. 校验 schema/result。
3. 核对场景数量、启用状态、permissions、assertions。
4. 复跑 fixture/hash/forbidden diff 测试。
5. 复跑 runner/scoring 测试。
6. 执行 E001–E009 的代表性 run。
7. 检查真实项目零写入。
8. 记录 PASS / PASS WITH NOTES / FAIL / BLOCKED。

## 7. 给实施 AI 的启动指令

```text
你现在开始实施 G5，但只允许实施 G5，不得返工 G1-G4，不得补做 G4 验收，不得修改 01/LinkUpClient、01/tools、01/skill、01/mcp。先按实际文件重新核对以下输入：01/docs/linkup-ai-engineering-master-plan.md、01/docs/linkup-agent-implementation-plan.md、01/docs/decisions/ADR-MCP-002-runtime-adapter.md、01/docs/acceptance/G2-implementation-report-20260701.md、01/docs/acceptance/G3-implementation-report-20260701.md、01/docs/acceptance/G4.1-spike-report-20260701.md、01/docs/acceptance/G4.2-implementation-report-20260702.md、01/docs/acceptance/G4.2-fix-report-20260702.md，以及 01/agent、01/mcp/linkup-dev-mcp 的当前实际结构和 git status。你的目标是只在允许路径内落地 G5：01/agent/linkup-agent-evals/**、01/docs/decisions/ADR-AGENT-001-eval-format.md、01/docs/acceptance/G5-*.md、/tmp/linkup-agent-evals/**。先完成 AP0–AP7；最小版本要求 E001–E009 启用，E010 仅在有 G4 独立 PASS 证据时启用，否则必须保留 disabled 并写明原因。runner 只允许做准备、记录、评分和汇总，禁止调用模型、禁止网络安装、禁止 Git mutation、禁止真实项目写入。完成后你的结果包必须至少包含：Changed-File List、场景清单、实测结果、样例 run artifacts、独立验收命令、以及“验收映射（逐项对应 G5-A01~G5-A09）”。如果你发现 G5 定义与现有文件事实冲突，只能输出偏差说明和最小修正建议，不能擅自扩展范围。
```

## 8. 缺口与建议

### 文件事实缺口

1. 缺少 G1/G2/G3/G4 的独立验收 PASS 记录，当前可见文件多为“实施完成/等待独立验收”。
2. 缺少 G4.2 GUI/CDP 真实联调已通过的独立证据；现有报告仍写“需 GUI 验证”。
3. 缺少 `ADR-AGENT-001-eval-format.md`。
4. 缺少 `01/agent/linkup-agent-evals/**` 的任何现成骨架。
5. 缺少“G5 是否应以当前实现树为基线，还是以独立验收 PASS 基线为准”的冻结说明。

### 最小补齐建议

1. 先按“非 Runtime 最小版 G5”推进：E001–E009 启用，E010 disabled。
2. 在 G5 实施开始前先补 `ADR-AGENT-001-eval-format.md`，冻结 schema、runner、artifact 策略。
3. 把 G5 输入基线明确写入实施说明：
   - 方案 A：按当前树实施，接受后续因 G2/G3/G4 验收变化而返工；
   - 方案 B：等待 G2/G3/G4 独立验收记录补齐后再实施。
4. 若要把 Runtime 场景纳入 G5 启用集合，先补一份 G4.2 独立验收记录，且其中必须包含 GUI/CDP 真实联调证据。

### 风险最大的点

最大的实施风险不是“代码写不出来”，而是：**在未冻结的 G2/G3/G4 输入基线上提前固化 G5 场景与评分规则，导致评测体系验证的是不稳定接口。**  
次级风险是 fixture/temp-copy 边界失守，造成真实项目被误写。

### 假设清单

1. 假设 G5 第一版允许不启用 Runtime 场景。  
原因：主计划和子计划都明确写了 Runtime 场景可在 G4 前禁用。

2. 假设“能开始做 G5 计划”不等于“能宣称 G5 已具备正式独立验收前置”。  
原因：计划编制依赖定义是否充分；正式实施/验收依赖前置是否被独立证据冻结。

3. 假设 G5 受限版实施可以基于当前文件树推进。  
原因：G5 目录为空，且现有计划已经给出完整目标结构；但这只是“可实施”，不是“已具备无争议验收基线”。

### 是否需要人工确认的问题列表

以下问题只在你准备立刻启动 G5 实施时才是真正阻断：

1. 你要不要接受“先做非 Runtime 最小版 G5，E010 disabled”作为正式目标？
2. G5 实施基线是：
   - 以当前实际文件树为准直接开工；还是
   - 等 G2/G3/G4 的独立验收 PASS 记录补齐后再开工？

