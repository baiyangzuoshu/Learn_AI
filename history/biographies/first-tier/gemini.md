# Gemini 本纪

> **体例说明**：Gemini 是 Google DeepMind 的模型家族与产品体系，不等同于 Bard、Google AI Studio 或 Google Cloud 的单一产品。

## 史家总评

Gemini 的使命，是把 Google 长期积累的搜索、语言、视觉、语音、视频、TPU 和科学计算能力重新合并为一个多模态模型家族。它不是 Google 第一个大模型，却是 Google 在 ChatGPT 之后将研究组织、产品入口和算力体系重新统一的标志。

## 一、世系：从 Transformer 到 Google DeepMind

Google 既有 Transformer、BERT、T5、LaMDA、PaLM 等语言模型传统，也有图像、语音、视频和 AlphaGo/AlphaFold 等专用模型传统。2023 年 Google Brain 与 DeepMind 合并为 Google DeepMind，为 Gemini 的统一研发提供了组织基础。

Gemini 的技术思想不是简单地“给语言模型接一张图片”，而是让模型在训练阶段同时接触文字、图像、音频和视频等信息，形成更统一的模态表示和交互方式。

## 二、2023 年：PaLM 2 之后的集结

2023 年 5 月，Google 发布 PaLM 2，强化多语言、推理、代码和产品部署。PaLM 2 是 Gemini 的重要前身：它证明 Google 可以把大模型能力嵌入搜索、办公、云服务和开发者工具。

同年 12 月 6 日，Google DeepMind 发布 Gemini 1.0，分为 Ultra、Pro、Nano 三种规模：

- Ultra：面向复杂推理和高能力任务；
- Pro：面向通用产品与云服务；
- Nano：面向设备端和资源受限场景。

这种“同一模型家族、不同部署尺寸”的策略，兼顾了旗舰能力、服务成本和端侧隐私。

## 三、技术变法

### 1. 原生多模态

Gemini 的叙事重点是同时理解文本、图像、音频和视频，而不是在语言模型外面简单增加一个视觉问答模块。原生多模态的难点在于：不同模态的 token 形式、时间尺度、数据质量和对齐方式都不同。

### 2. 模型家族化

Gemini Ultra、Pro、Nano 形成从数据中心到手机的部署梯度。模型能力不再只有一个排行榜，而是要同时考虑延迟、能耗、成本、隐私和任务类型。

### 3. Google 产品化

Gemini 被接入 Bard、Google AI Studio、Vertex AI 和 Workspace 等产品。它的竞争优势不仅来自模型本身，还来自搜索索引、云计算、办公文档、移动设备和开发者分发渠道。

## 四、2024 年：长上下文、轻量模型与 Agent 方向

2024 年 2 月 15 日，Google 发布 Gemini 1.5 Pro 预览，采用 MoE 架构并展示最高 100 万 token 的上下文窗口；5 月又推出 Gemini 1.5 Flash，强调更低延迟和更低服务成本，同时展示 Project Astra 的实时视觉助手方向。

12 月，Gemini 2.0 预览把多模态、工具调用和 Agent 能力进一步合并。Gemini 的产品路线由“一个更强的模型”转为“旗舰模型、快速模型、端侧模型和 Agent 平台协同”。

## 五、2025 年：Gemini 2.5、Veo 3 与 Gemini 3

2025 年，Gemini 把“思考”变成模型家族的显式产品能力。3 月发布的 Gemini 2.5 将 thinking 作为核心模式，并覆盖 Pro、Flash 等不同速度与成本层级；5 月 Veo 3 与 Flow 将视频生成推进到带原生声音的创作工作流；11 月 Gemini 3 则把推理、多模态理解、代码和 Agent 方向重新汇合到统一模型家族。

## 六、关键战役与争议

Gemini 1.0 发布后，Google 将其定位为新一代多模态基础模型，并以 Ultra、Pro、Nano 分别应对复杂任务、通用服务和设备端部署。围绕 benchmark、演示视频、不同版本和实际产品表现的讨论，也提醒人们：模型宣传、实验室评测和用户真实体验必须分开记录。

Gemini 的长期问题包括知识新鲜度、事实可靠性、跨模态幻觉、产品权限和 Google 数据生态的隐私边界。

## 七、传记年表

| 时间 | 事件 | 本纪意义 |
|---|---|---|
| 2017 | Transformer 论文发表 | Google 的架构贡献成为后续基础模型共同底座。 |
| 2018 | BERT 发布 | 预训练—微调范式进入 NLP 主流。 |
| 2022 | PaLM、Flamingo 等研究 | 语言规模化与视觉语言融合持续积累。 |
| 2023-05-10 | PaLM 2 发布 | Google 将大模型推向多语言、代码和产品。 |
| 2023-12-06 | Gemini 1.0 发布 | Google DeepMind 以多模态模型家族回应 GPT-4 时代。 |
| 2024-02-15 | Gemini 1.5 Pro 发布 | MoE 与百万 token 长上下文进入公开预览。 |
| 2024-05-14 | Gemini 1.5 Flash 与 Project Astra | 低延迟多模态和实时助手方向成形。 |
| 2024-12 | Gemini 2.0 预览 | 多模态、工具调用和 Agent 能力合流。 |
| 2025-03 | Gemini 2.5 | 将 thinking 作为模型家族的核心能力。 |
| 2025-05-20 | Veo 3、Flow | 视频生成加入原生音频并进入创作工作流。 |
| 2025-11-18 | Gemini 3 | 以新一代模型统一推理、多模态、代码与 Agent 方向。 |
| 2026-05-19 | Gemini 3.5 Flash、Gemini Omni、Daily Brief、Gemini Spark | Gemini 应用转向主动简报、全天候协助和多模态 Agent。 |
| 2026 | 截至 8 月 15 日 | Gemini 与视频、音乐、开发工具、设备和 Agent 平台继续合流。 |

## 八、当年位置

2023 年底，Gemini 是 Google 对基础模型竞争的正式回答。它的历史价值不只在于与 GPT-4 对比，而在于把 Google 的语言、视觉、音频、视频、TPU、搜索和云平台重新组织成统一的 AI 发展路线。

### 2026 年（截至 8 月 15 日）

Gemini 的产品重心从“多模态助手”进一步转为主动式 Agent。Gemini 3.5 Flash 负责快速行动，Omni 连接文本、图像和视频生成，Daily Brief 与 Spark 则把模型嵌入日常计划和任务协助；Google 的优势越来越体现在模型、搜索、媒体、云和设备的系统联动。

## 九、史家曰

> Gemini 承 Google 百艺而出：有 Transformer 之骨、搜索之目、云端之力、移动之身。其难不在一时胜负，而在能否将诸艺合为一体，使多模态不止于演示，使巨量基础设施真正化为人人可用之智能。

## 参考资料

- [Google：PaLM 2](https://blog.google/innovation-and-ai/products/google-palm-2-ai-large-language-model/)
- [Google：Introducing Gemini](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/)
- [Google：Gemini 1.5](https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/)
- [Google：Gemini 1.5 Flash 与 Project Astra](https://blog.google/innovation-and-ai/products/google-gemini-update-flash-ai-assistant-io-2024/)
- [Google：Gemini 2.0 与 2024 年 AI 更新](https://blog.google/innovation-and-ai/products/google-ai-updates-december-2024/)
- [Gemini 1.0 Technical Report](https://deepmind.google/gemini/gemini_1_report.pdf)
- [Google：Gemini 2.5](https://blog.google/products-and-platforms/products/gemini/gemini-2-5-model-family-expands/)
- [Google：Veo 3 与 Flow](https://blog.google/innovation-and-ai/products/generative-media-models-io-2025/)
- [Google：Gemini 3](https://blog.google/products-and-platforms/products/gemini/gemini-3/)
- [Google：Gemini 应用升级（2026-05-19）](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)
- [Google I/O 2026](https://blog.google/intl/en-in/company-news/technology/sundar-pichai-io-2026/)
