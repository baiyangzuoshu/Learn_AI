# AI 模型列传体系

这一部分采用《史记》的叙事方式，为重要模型、公司和 AI 产品分别建立独立传记。年度时间线记录“时代发生了什么”，传记则记录“一个模型/组织如何成长、竞争和改变时代”。

当前已将第一档本纪、第二档世家与列传统一补写至 2026-08-15；由于 2026 年尚未结束，各篇均以“截至 8 月 15 日”的阶段性事实为边界，后续事件待年度更新时补入。

## 体例设计

### 第一档：本纪

第一档采用“本纪”体例，分别记录具有全球基础模型影响力、改变行业方向或形成完整产品生态的模型/平台：

- [ChatGPT 本纪](first-tier/chatgpt.md)
- [Gemini 本纪](first-tier/gemini.md)
- [DeepSeek 本纪](first-tier/deepseek.md)
- [豆包本纪](first-tier/doubao.md)
- [Claude 本纪](first-tier/claude.md)

“本纪”不是简单的产品介绍，而是记录一个 AI 系统的完整生命史：技术血统、初次问世、关键版本、竞争战役、商业化、生态扩张、争议和历史影响。

### 第二档：世家与列传

第二档按地区、组织和产品方向建立“世家/列传”：

#### 美国及其他美国 AI

- [Meta AI / Llama](second-tier/usa/meta-ai-llama.md)
- [xAI / Grok](second-tier/usa/xai-grok.md)
- [Microsoft AI / Copilot](second-tier/usa/microsoft-copilot.md)
- Anthropic（组织世家，与 Claude 本纪互链）
- [Amazon AI / Bedrock / Nova](second-tier/usa/amazon-ai.md)

#### 中国 AI

- [通义千问 / 阿里云](second-tier/china/qwen.md)
- [百度文心 / 百度 AI](second-tier/china/baidu-ernie.md)
- [腾讯混元 / 腾讯 AI](second-tier/china/tencent-hunyuan.md)
- [智谱 GLM](second-tier/china/zhipu-glm.md)、[月之暗面 / Kimi](second-tier/china/moonshot-kimi.md)、[MiniMax](second-tier/china/minimax.md)

#### Agent 与新兴产品

- [Manus](second-tier/agent/manus.md)
- [AutoGPT](second-tier/agent/autogpt.md)、[Devin](second-tier/agent/devin.md)、[Cursor](second-tier/agent/cursor.md)

#### 欧洲 AI

- [Mistral AI](second-tier/europe/mistral.md)
- [Aleph Alpha](second-tier/europe/aleph-alpha.md)
- [DeepL](second-tier/europe/deepl.md)
- [Stability AI](second-tier/europe/stability-ai.md)（总部和团队跨地区，按研究与产业影响归类）

第二档不代表技术价值低，而是表示其历史叙事更适合从组织、地区、生态或具体产品角度展开；分档可以随着资料和影响力变化而调整。

## 单篇传记模板

每篇传记遵循相同结构，便于横向比较：

1. **名号与身世**：公司、团队、模型家族、成立背景和名称由来。
2. **师承与血统**：前身模型、训练方法、数据和基础设施来源。
3. **初次出世**：首次发布、公开方式、初始能力和用户反应。
4. **成长与变法**：关键版本、预训练、后训练、对齐、多模态、工具调用和推理能力变化。
5. **关键战役**：与其他模型的竞争、重要 benchmark、产品突破和市场事件。
6. **入世与建制**：API、订阅、企业服务、开发者生态、开源/闭源策略和商业化。
7. **功与过**：技术贡献、用户价值、幻觉、安全、版权、隐私和治理争议。
8. **门客与诸侯**：合作伙伴、投资者、云平台、开源社区和衍生模型。
9. **当年位置**：截至对应年份的模型能力、产品状态和历史位置。
10. **史家曰**：用《史记》式的短评总结其真正改变了什么，以及没有改变什么。

## 写作原则

- 史料和评论分开：事实写日期、版本、来源；判断标注为“分析”或放入“史家曰”。
- 不把公司宣传语直接当作模型能力结论；重要 benchmark 记录测试条件。
- 区分模型、产品、公司和 API：ChatGPT 不等于 GPT 模型本身，Gemini 也不等于 Google 的全部 AI 产品。
- 记录失败、撤回、争议和组织危机，它们同样是发展史的一部分。
- 传记之间互相链接到年度时间线，避免重复叙述同一事件。
- 每年增加“当年位置”，防止用后来的能力倒推早期模型。

## 文件命名

使用小写英文文件名，中文标题放在文件内部，方便链接和脚本处理：

```text
history/biographies/
├── README.md
├── first-tier/
│   ├── chatgpt.md
│   ├── gemini.md
│   ├── deepseek.md
│   ├── doubao.md
│   └── claude.md
└── second-tier/
    ├── usa/
    ├── china/
    ├── agent/
    └── europe/
```
