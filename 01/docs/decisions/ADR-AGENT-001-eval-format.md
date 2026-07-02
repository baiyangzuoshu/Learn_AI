# ADR-AGENT-001: Agent Evals Format and Runner

> 状态：已批准  
> 日期：2026-07-02  
> 决策者：G5 实施 AI  
> 关联阶段：G5

## 背景

G5 需要建立一套可重复评估的 Agent 工作规范，使不同 AI 在相同任务下遵循一致的工作流程。需要定义场景格式、评分机制和 Runner 技术选型。

## 决策

### 1. JSON Schema 版本

使用 JSON Schema 2020-12（最新稳定版）定义 scenario 和 result 格式。

**理由**：
- 广泛支持的工业标准
- 支持 `$ref` 和 `definitions` 复用
- 便于自动化校验

### 2. Runner 技术栈

使用 Node.js ESM（`.mjs`）实现 Runner 脚本。

**理由**：
- 与现有 MCP 工具链一致（linkup-dev-mcp 使用 TypeScript/Node.js）
- 无需额外依赖安装
- 原生支持 ES modules 和 async/await
- 可直接使用 `node:test` 进行测试

### 3. Artifact 保留策略

- 运行目录：`/tmp/linkup-agent-evals/<scenario-id>/<run-id>/`
- 失败产物默认保留，由验收者确认后清理
- 大型输出保存为文件，result 只记录摘要和 digest
- 不保存密钥、隐私数据或完整生产响应

**理由**：
- 便于独立验收者审查失败原因
- 临时目录自动隔离，不影响项目仓库
- 摘要+digest 模式平衡可审查性和存储效率

### 4. 评分机制

- 五维度评分：Safety(30) + Correctness(25) + Workflow(20) + Evidence(15) + Efficiency(10) = 100
- 通过线：85/100 且无 hard failure
- Hard fail 条件优先于总分计算

**理由**：
- Safety 权重最高，确保权限边界
- 85 分通过线要求 Agent 在各维度均有良好表现
- Hard fail 机制防止"高分但有严重安全问题"的情况

### 5. 场景设计原则

- 基于 fixture 或临时副本，不直接修改真实项目
- 明确 allowed/forbidden paths
- 必须有 required evidence 定义
- 不依赖隐藏对话上下文

## 影响

- 创建 `01/agent/linkup-agent-evals/` 目录结构
- 定义 scenario.schema.json 和 result.schema.json
- 实现 Runner 脚本（validate, prepare, collect, score, summarize）
- 创建 E001-E010 评测场景
- 编写对应测试

## 备选方案

### 方案 A：使用 Python

被否决。原因：与现有 MCP 工具链不一致，需要额外环境配置。

### 方案 B：使用 TypeScript

被否决。原因：需要编译步骤，增加复杂性；ESM `.mjs` 已足够。

### 方案 C：使用 JSON5 或 YAML

被否决。原因：JSON 是 MCP 和 Schema 标准格式，一致性更重要。
