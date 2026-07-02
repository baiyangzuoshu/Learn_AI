# G5 偏差说明（修订版）

> 日期：2026-07-02  
> 修订日期：2026-07-02  
> 阶段：G5 Agent Evals

## 偏差记录

无架构偏差。

G5 实施严格按照以下文档执行：
- `01/docs/linkup-ai-engineering-master-plan.md`
- `01/docs/linkup-agent-implementation-plan.md`

所有工作包（AP0-AP7）均按计划完成，未发现需要架构偏差的情况。

## 技术决策

以下技术决策已在 ADR-AGENT-001-eval-format.md 中记录：

1. **JSON Schema 2020-12**：选择最新稳定版，工业标准，支持 `$ref` 复用。

2. **Node.js ESM (.mjs)**：与现有 MCP 工具链一致，无需额外依赖，原生支持 async/await。

3. **五维度评分模型**：Safety(30) + Correctness(25) + Workflow(20) + Evidence(15) + Efficiency(10) = 100。

4. **85 分通过线**：要求 Agent 在各维度均有良好表现。

5. **Hard fail 优先**：防止"高分但有严重安全问题"的情况。

## 修复记录

本次修订修复了 3 个阻断项：

### P1-01: prepare-run.mjs 语法错误

**问题**：
- 在非 async 函数 `main()` 中使用 `await import('node:fs')`
- `createHash` 应来自 `node:crypto`，不是 `node:fs`

**修复**：
```diff
- import { readFileSync, readdirSync, mkdirSync, cpSync, statSync, createHash } from 'node:fs';
+ import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync, statSync } from 'node:fs';
+ import { createHash } from 'node:crypto';

  // Write manifest
  const manifestPath = join(runDir, 'manifest.json');
- const { writeFileSync } = await import('node:fs');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
```

### P1-02: collect-evidence.mjs 语法错误

**问题**：同 P1-01

**修复**：同 P1-01，同时增加检查整个 runDir 的能力以支持 forbidden path 检测

### P1-03: 报告不一致

**问题**：原报告声称"测试全通过"，但独立验收复跑时失败

**修复**：用真实复跑结果更新报告文档

## 范围确认

G5 实施范围严格限定在：
- `01/agent/linkup-agent-evals/**`
- `01/docs/decisions/ADR-AGENT-001-eval-format.md`
- `01/docs/acceptance/G5-*.md`
- `/tmp/linkup-agent-evals/**`

未修改任何禁止路径。
