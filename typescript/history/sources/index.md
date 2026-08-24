# AI 年鉴来源索引

本索引把年度时间线、技术章节、数据快照和模型传记使用的来源集中管理。原则是：关键日期、参数、价格、采用率和 benchmark 优先使用一手来源；公司的自报数据必须保留“自报”属性；无法核验的传闻不进入年鉴正文。

## 来源等级

| 等级 | 来源 | 用途 |
|---|---|---|
| A | 公司官方公告、官方文档、模型卡、系统卡 | 发布日期、产品范围、参数、上下文、价格和官方能力说明 |
| B | 论文、技术报告、监管文件、Stanford AI Index 等研究报告 | 架构、训练方法、评测、采用率、基础设施和治理数据 |
| C | 主流媒体、行业数据库和二手分析 | 补充背景、融资和争议；关键数字需回溯 A/B 级来源 |

## 核心来源与覆盖范围

| 机构/项目 | 主要覆盖 | 官方入口 |
|---|---|---|
| OpenAI | GPT、ChatGPT、Codex、Agent、图像、科学模型 | [OpenAI Research](https://openai.com/research/) |
| Anthropic | Claude、Claude Code、MCP、Agent、安全与科学工作流 | [Anthropic News](https://www.anthropic.com/news) |
| Google / DeepMind | Gemini、Veo、Imagen、AI 科学与设备生态 | [Google AI](https://blog.google/technology/ai/) |
| Meta | Llama、Meta AI、开放权重与端侧模型 | [Meta AI](https://ai.meta.com/blog/) |
| DeepSeek | V 系列、R 系列、模型卡与透明度 | [DeepSeek Transparency](https://www.deepseek.com/en/transparency/) |
| Alibaba / Qwen | Qwen 系列、开放权重、云服务与 Agent | [Qwen Blog](https://qwen.ai/blog) |
| MiniMax | 文本、语音、视频、音乐、全模态与 API | [MiniMax Models](https://platform.minimax.io/docs/release-notes/models) |
| xAI | Grok、实时信息、多模态与工具使用 | [xAI News](https://x.ai/news) |
| AWS | Bedrock、Nova、Knowledge Bases、企业 Agent | [AWS AI News](https://aws.amazon.com/blogs/machine-learning/) |
| Microsoft | Copilot、Azure AI、GitHub Copilot、企业 Agent | [Microsoft AI Blog](https://blogs.microsoft.com/ai/) |
| 百度 | 文心、千帆、ERNIE、多模态与产业部署 | [百度 AI](https://ernie.baidu.com/blog/) |
| 腾讯 | 混元、腾讯云、会议、文档与内容产品 | [腾讯混元](https://cloud.tencent.com/document/product/1729/97765) |
| Mistral | 开放模型、Le Chat、代码、语音与主权 AI | [Mistral News](https://mistral.ai/news/) |
| Stability AI | Stable Diffusion、图像/视频生成与开放生态 | [Stability AI News](https://stability.ai/news) |
| Stanford HAI | AI Index、能力、采用率、事故、能耗和经济数据 | [2026 AI Index](https://hai.stanford.edu/ai-index/2026-ai-index-report) |
| 欧盟委员会 | AI Act、GPAI、模型义务与治理时间表 | [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) |

## 年度文件交叉索引

- [2022 时间线](../timeline/2022.md) · [2022 技术章](../technology/2022.md) · [2022 数据](../data/2022_snapshot.csv)
- [2023 时间线](../timeline/2023.md) · [2023 技术章](../technology/2023.md) · [2023 数据](../data/2023_snapshot.csv)
- [2024 时间线](../timeline/2024.md) · [2024 技术章](../technology/2024.md) · [2024 数据](../data/2024_snapshot.csv)
- [2025 时间线](../timeline/2025.md) · [2025 技术章](../technology/2025.md) · [2025 数据](../data/2025_snapshot.csv)
- [2026 时间线](../timeline/2026.md) · [2026 技术章](../technology/2026.md) · [2026 数据](../data/2026_snapshot.csv)

最新校验记录：[2026-08-15 资料校验报告](validation-2026-08-15.md)。来源可访问性明细见 [source_status.csv](source_status.csv)，本版记录 53 个唯一 URL。

事实级追踪表：[fact_matrix.csv](fact_matrix.csv)。当前包含 75 条事实，覆盖年度快照的 79 条数据记录。每行使用唯一 `fact_id`，并通过 `data_indicators` 精确连接数据快照中的指标、来源等级、核验状态和目标文件；复合事实（如参数范围）可映射多个指标。正文目标文件末尾保留不可见的 `fact-matrix` 标记，便于脚本确认事实确实落入对应章节或传记。

## 核验规则

1. 日期必须能在官方公告、官方文档或论文中定位；发布日期、公开预览、API 可用和全面开放要分开记录。
2. 参数、上下文和 benchmark 必须保留单位、版本和测试条件；不能把总参数、激活参数和上下文 token 混为一谈。
3. 用户量、融资、采用率和事故数量标注统计机构与统计日期；公司自报数字不得改写成全行业事实。
4. 2026 年资料以 2026-08-15 为截止日；之后的事件进入下一次版本迭代。
5. 每个 CSV 数据行必须有来源 URL；来源失效时保留原 URL，并在下一版替换为可访问的官方镜像或存档。
6. 每个 CSV 指标必须在事实矩阵的 `data_indicators` 中出现且只出现一次；矩阵中的日期、来源和单值单位必须与对应数据行一致。

## 已知限制

- 模型公司常用自定义 benchmark，横向比较时不能只看百分比。
- AI 事故、采用率和成本的统计口径并不统一，年鉴只做来源明确的并列展示。
- “开放权重”不等于训练数据、代码、过滤流程和安全评测全部开放。
- 传记中的 2026 段落是阶段性记录，不代表全年结论。
