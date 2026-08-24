# 资料校验报告：2026-08-15

## 自动校验结果

运行命令：

```bash
python3 history/scripts/validate_yearbooks.py
```

结果：

```text
OK: 5 CSV snapshots, 79 data rows mapped to 75 matrix facts, 23 biographies, cutoff=2026-08-15
```

已检查：

- 2022—2026 五个 CSV 快照，共 79 条数据记录；
- 来源—事实矩阵包含 75 条事实，`fact_id` 唯一且目标文件均存在；通过 `data_indicators` 覆盖 79 条年度数据记录；
- 15 个叙事目标文件包含对应的不可见 `fact-matrix` 标记，矩阵事实可回溯到正文章节或传记；
- 图表使用的派生序列单独保存于 [visualization_series.csv](../data/visualization_series.csv)，记录计算方法和来源；其中年度记录数和矩阵核验数由校验脚本与快照交叉计算；可视化看板新增矩阵核验状态分布图。
- CSV 表头为 `indicator,value,unit,date,source`，每行均为五列；
- 日期格式为年份、年月或完整日期，未超过 2026-08-15；
- 每条数据均有 HTTPS 来源 URL；
- 来源可访问性表包含 53 个唯一 URL，状态均为 `accessible`，抽查日期为 2026-08-15；
- 来源状态表的 URL 集合与事实矩阵完全一致；
- 2022—2026 时间线、技术章节和数据文件均存在；时间线表格未发现同一日期与同一事件的重复行；
- 23 篇模型/公司/Agent 传记均包含 2026 内容，未残留“待续”标记。

## 人工抽查的一手来源

本轮已按年份抽查来源—事实矩阵中的共享来源：75 条矩阵事实对应 53 个唯一 HTTPS URL；页面可访问，日期、数值、单位和事件表述与矩阵及数据快照一致。复合事实（参数范围或总量/激活量）在矩阵中用一个事实映射多个 `data_indicators`，并保留原始单位。

2022—2025 年抽查来源包括：

- [Google Research：PaLM](https://research.google/blog/pathways-language-model-palm-scaling-to-540-billion-parameters-for-breakthrough-performance/)、[DeepMind：Chinchilla](https://deepmind.google/blog/an-empirical-analysis-of-compute-optimal-large-language-model-training/)
- [OpenAI：DALL·E 2](https://openai.com/index/dall-e-2-update/)、[ChatGPT](https://openai.com/index/chatgpt/)、[Operator](https://openai.com/index/introducing-operator/)、[o1-preview](https://openai.com/index/introducing-openai-o1-preview/)、[o3/o4-mini](https://openai.com/index/introducing-o3-and-o4-mini/)、[Sora](https://openai.com/index/video-generation-models-as-world-simulators/)
- [Stability AI：Stable Diffusion](https://stability.ai/news-updates/stable-diffusion-public-release)
- [Meta：LLaMA](https://ai.meta.com/blog/large-language-model-llama-meta-ai/)、[Llama 2](https://ai.meta.com/research/publications/llama-2-open-foundation-and-fine-tuned-chat-models/)、[Llama 3.1](https://ai.meta.com/blog/meta-llama-3-1/)、[Llama 3.2](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/)、[Segment Anything](https://ai.meta.com/research/publications/segment-anything/)
- [Google：Gemini 1.5](https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/)、[Gemini 2.5](https://blog.google/products-and-platforms/products/gemini/gemini-2-5-model-family-expands/)
- [DeepSeek：DeepSeek-V2 论文](https://arxiv.org/abs/2405.04434)、[阿里云：Qwen2](https://www.alibabacloud.com/blog/601268)、[Qwen3](https://home.alibabagroup.com/en-US/document-1853940226976645120)
- [OpenAI：DevDay](https://openai.com/index/new-models-and-developer-products-announced-at-devday/)、[Anthropic：Claude 3.7](https://www.anthropic.com/news/claude-3-7-sonnet)、[Claude 4](https://www.anthropic.com/news/claude-4)、[Google：Veo 3/Flow](https://blog.google/innovation-and-ai/products/generative-media-models-io-2025/)、[xAI：Grok 4](https://x.ai/news/grok-4)
- [中国国家网信办：生成式人工智能服务管理暂行办法](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)、[欧盟委员会：AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)

以下来源已用于核对 2026 年关键记录：

- [OpenAI：GPT-5.4](https://openai.com/index/introducing-gpt-5-4/)、[GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)、[GPT-5.6 Sol](https://openai.com/index/previewing-gpt-5-6-sol/)
- [Anthropic：Anthropic Labs](https://www.anthropic.com/news/introducing-anthropic-labs)、[Claude Fable 5 与 Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)
- [Google：Gemini 应用升级](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)
- [Google：Gemini 2.5](https://blog.google/products-and-platforms/products/gemini/gemini-2-5-model-family-expands/)、[Gemini 3](https://blog.google/products-and-platforms/products/gemini/gemini-3/)
- [DeepSeek：透明度中心](https://www.deepseek.com/en/transparency/)
- [Qwen：Qwen3.5](https://qwen.ai/blog?email_hash=23463b99b62a72f26ed677cc556c44e8&id=qwen3.5)
- [MiniMax：模型发布记录](https://platform.minimax.io/docs/release-notes/models)、[MiniMax M3](https://www.minimax.io/blog/minimax-m3)
- [OpenAI：DALL·E 取消 waitlist](https://openai.com/index/dall-e-now-available-without-waitlist/)、[ChatGPT Images 2.0](https://openai.com/index/introducing-chatgpt-images-2-0/)
- [阿里云：Qwen2](https://www.alibabacloud.com/blog/601268)、[Meta：Llama 3.2](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/)、[Anthropic：Claude Sonnet 4.5](https://www.anthropic.com/news/claude-sonnet-4-5)
- [Stanford HAI：2026 AI Index](https://hai.stanford.edu/ai-index/2026-ai-index-report)

## 校验警告与解释

1. CSV 的“记录数”是资料库行数，不是行业事件总数；可视化中已明确标注。
2. 公司自报的用户量、benchmark、融资和产品效果保留原来源，不自动视为独立审计结论。
3. 2026 年仍在进行，正文、传记和数据快照均以 2026-08-15 为截止日；之后数据进入下一版。
4. 不同模型的 benchmark、上下文、总参数和激活参数不能直接混成同一条排名；技术章采用分面和独立单位展示。
5. 外部网页可能改版或下线；下一版应重新运行来源可访问性抽查，并保留替换记录。
6. 本版把“全文一致性”操作化为：每条年度数据记录有且仅有一个矩阵映射，矩阵日期/来源/单位与数据行一致；叙事段落中的分析性判断仍需结合正文来源索引阅读，不等同于逐句自动证明。
