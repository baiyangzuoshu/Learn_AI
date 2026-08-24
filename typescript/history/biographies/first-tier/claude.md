# Claude 本纪

> **体例说明**：Claude 是 Anthropic 的助手与模型家族。本篇同时记录 Claude 的技术、安全研究、API 和企业生态。

## 史家总评

Claude 的独特身份，来自“安全研究先于产品扩张”的组织叙事。它以 Constitutional AI 为精神血统，把有害性、诚实、可控性和长上下文作为产品竞争的一部分；后来又以长文档、企业 API、工具调用和代码能力进入主流市场。

## 一、世系：Anthropic 与 Constitutional AI

Anthropic 于 2021 年成立，研究重点包括可解释性、可控性和可靠的通用 AI。2022 年，团队发表 Constitutional AI：让模型依据一组明确原则进行自我批评、改写，并通过 AI 反馈训练更安全的助手。

这套方法并不意味着“没有人参与”，而是把人工监督从逐条判断所有输出，部分转移到设计原则、评审规则、红队测试和部署策略。

## 二、2023 年：Claude 从封闭测试走向公开助手

### 1. Claude 初次出世

2023 年 3 月 14 日，Anthropic 公开介绍 Claude。此前它已与 Notion、Quora、DuckDuckGo 等伙伴进行封闭测试，随后通过聊天界面和 API 扩大使用。

Claude 的产品定位是 helpful、honest、harmless：在自然语言任务上提供帮助，同时尽量减少有害输出、过度自信和不可控行为。

### 2. 100K 上下文

2023 年 5 月，Anthropic 将 Claude 的上下文窗口扩展到 100K tokens，使用户可以提交长篇书籍、技术文档和多份材料进行总结、问答与比较。

长上下文改变了 Claude 的使用场景：它不再只是短问短答，而开始成为文档分析器、合同阅读器、代码库助手和研究资料整理器。

### 3. Claude 2

2023 年 7 月 11 日，Claude 2 发布，改进代码、数学、推理、长文本和安全表现，并通过 claude.ai 面向美国和英国用户开放。

### 4. Claude 2.1

2023 年 11 月 21 日，Claude 2.1 将上下文提升到 200K tokens，同时推出系统提示和工具使用 beta。Anthropic 将减少幻觉、长文档理解和工具调用作为企业使用的关键能力。

## 三、技术变法

### 1. Constitutional AI

Claude 的安全方法强调明确的价值原则、自我批评、修订、AI 反馈和红队测试。它希望让模型更少依赖逐条人工标注，同时让“为什么拒绝”更容易被解释和调整。

### 2. 长上下文优先

Claude 很早把长上下文作为产品能力，而非单纯实验指标。长上下文的挑战不仅是把更多 token 放进窗口，还要保持对关键事实的定位、引用和一致性。

### 3. 有限度的工具化

Claude 2.1 的工具使用允许模型调用开发者定义的函数、搜索来源和私有知识库。Anthropic 的路线强调：模型应当决定何时需要工具，但真正执行仍应由应用验证权限和参数。

## 四、2024 年：Claude 3、Sonnet 与 Computer Use

2024 年 3 月 4 日，Anthropic 发布 Claude 3 家族，按 Opus、Sonnet、Haiku 分层，分别对应高能力、平衡性能和低延迟成本。Claude 3 把视觉输入、结构化输出和企业 API 纳入更成熟的产品体系。

6 月 20 日，Claude 3.5 Sonnet 发布，在代码、视觉理解和复杂任务上继续提升。10 月 22 日，Anthropic 发布 computer use beta，允许模型读取屏幕、移动鼠标、点击和输入文字，Claude 从“调用函数”走向“操作电脑”。

11 月 25 日，Anthropic 发布 Model Context Protocol（MCP），把 Claude 与数据源、业务工具和开发环境的连接抽象为开放标准。MCP 解决的是连接互操作问题，不等于模型自动拥有可靠规划和执行能力。

## 五、2025 年：混合推理、Claude 4 与长程 Agent

2025 年，Claude 从长文本助手进一步转向编码与长程任务代理。Claude 3.7 Sonnet 首次把快速回答与可见的 extended thinking 放在同一模型中，并以 Claude Code 将终端、代码库和测试纳入工作流。5 月 Claude Opus 4 与 Sonnet 4 强化复杂推理和持续编码，9 月 Sonnet 4.5 又把长时间运行、工具使用和企业级代码 Agent 推向更高强度。

## 六、功与过

### 功

- 推动 Constitutional AI 和 AI 反馈研究；
- 长文档、合同、代码库和企业知识分析能力突出；
- 在“承认不知道”和降低不当自信方面持续投入；
- 为安全政策、红队和责任扩展提供了较完整的公开讨论。

### 过

- 安全策略有时会过度拒答，影响正常任务；
- 长上下文不等于每一处信息都能准确检索；
- 模型仍会产生幻觉，企业使用仍需外部核验；
- “安全”包含价值判断，不可能脱离文化和组织背景。

## 七、传记年表

| 时间 | 事件 | 本纪意义 |
|---|---|---|
| 2021 | Anthropic 成立 | 以安全、可控和可解释研究为组织核心。 |
| 2022-12-15 | Constitutional AI 论文 | 奠定 Claude 的价值原则和 AI 反馈血统。 |
| 2023-03-14 | Claude 公开介绍 | 从封闭伙伴测试走向聊天和 API。 |
| 2023-05-11 | 100K 上下文窗口 | 长文档理解成为核心产品路线。 |
| 2023-07-11 | Claude 2 发布 | 改进代码、数学、推理和安全。 |
| 2023-11-21 | Claude 2.1 发布 | 200K 上下文、系统提示和工具使用。 |
| 2024-03-04 | Claude 3 家族发布 | Opus、Sonnet、Haiku 形成能力与成本分层。 |
| 2024-06-20 | Claude 3.5 Sonnet 发布 | 代码、视觉和复杂任务能力提升。 |
| 2024-10-22 | Computer Use beta | 模型开始尝试通过屏幕操作电脑。 |
| 2024-11-25 | MCP 发布 | AI 应用与工具、数据源的连接开始标准化。 |
| 2025-02-24 | Claude 3.7 Sonnet、Claude Code | 混合推理与终端编码 Agent 同时进入产品。 |
| 2025-05-22 | Claude Opus 4、Sonnet 4 | 面向复杂推理和持续编码任务的新一代模型。 |
| 2025-09-29 | Claude Sonnet 4.5 | 长程编码、工具使用与企业 Agent 能力继续增强。 |
| 2026-01-13 | Anthropic Labs | 将 Claude Code、MCP、Skills、Chrome 与 Cowork 放入 Agent 产品化框架。 |
| 2026-06-09 | Claude Fable 5、Mythos 5 | 以视觉、长程编码、科学与环境交互展示新一代能力分层。 |
| 2026 | 截至 8 月 15 日 | 继续推进 Claude 的长程 Agent、科学工作流与企业部署。 |

## 八、当年位置

2023 年底，Claude 是 GPT-4 之外最重要的闭源助手之一。它没有把所有竞争都押在“更像人”上，而是把长上下文、稳定风格、减少有害输出和企业可靠性变成品牌核心。

### 2026 年（截至 8 月 15 日）

Claude 的传记在 2026 年进入“模型—工具—组织”合一阶段。Anthropic Labs 把 Claude Code、MCP、Skills、浏览器和 Cowork 组织成 Agent 体系；Fable 5 与 Mythos 5 则把视觉、代码、科学和环境交互纳入能力分层。能力越强，安全评估、对齐和企业部署的责任也越重。

## 九、史家曰

> Claude 以宪法为冠，以长卷为剑。其所争者，不独答得多，而在答有所守、长文不乱、遇疑能止。然宪法虽明，价值仍由人定；长卷虽广，真伪仍须外证。后世论 Claude，当观其如何在有用与克制之间立身。

## 参考资料

- [Anthropic：Constitutional AI](https://www.anthropic.com/news/constitutional-ai-harmlessness-from-ai-feedback)
- [Anthropic：Introducing Claude](https://www.anthropic.com/news/introducing-claude)
- [Anthropic：100K Context Windows](https://www.anthropic.com/news/100k-context-windows)
- [Anthropic：Claude 2](https://www.anthropic.com/news/claude-2)
- [Anthropic：Claude 2.1](https://www.anthropic.com/news/claude-2-1)
- [Anthropic：Claude 3](https://www.anthropic.com/news/claude-3-family)
- [Anthropic：Claude 3.5 与 Computer Use](https://www.anthropic.com/news/3-5-models-and-computer-use)
- [Anthropic：Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- [Anthropic：Claude 3.7 Sonnet（2025-02-24）](https://www.anthropic.com/news/claude-3-7-sonnet)
- [Anthropic：Claude 4（2025-05-22）](https://www.anthropic.com/news/claude-4)
- [Anthropic：Claude Sonnet 4.5（2025-09-29）](https://www.anthropic.com/news/claude-sonnet-4-5)
- [Anthropic：Anthropic Labs（2026-01-13）](https://www.anthropic.com/news/introducing-anthropic-labs)
- [Anthropic：Claude Fable 5 与 Mythos 5（2026-06-09）](https://www.anthropic.com/news/claude-fable-5-mythos-5)

<!-- fact-matrix: F2025-003,F2026-001,F2026-011 -->
