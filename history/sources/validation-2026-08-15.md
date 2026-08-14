# 资料校验报告：2026-08-15

## 自动校验结果

运行命令：

```bash
python3 history/scripts/validate_yearbooks.py
```

结果：

```text
OK: 5 CSV snapshots, 23 biographies, cutoff=2026-08-15
```

已检查：

- 2022—2026 五个 CSV 快照，共 79 条数据记录；
- 图表使用的派生序列单独保存于 [visualization_series.csv](../data/visualization_series.csv)，记录计算方法和来源。
- CSV 表头为 `indicator,value,unit,date,source`，每行均为五列；
- 日期格式为年份、年月或完整日期，未超过 2026-08-15；
- 每条数据均有 HTTPS 来源 URL；
- 2022—2026 时间线、技术章节和数据文件均存在；
- 23 篇模型/公司/Agent 传记均包含 2026 内容，未残留“待续”标记。

## 人工抽查的一手来源

以下来源已用于核对 2026 年关键记录：

- [OpenAI：GPT-5.4](https://openai.com/index/introducing-gpt-5-4/)、[GPT-5.5](https://openai.com/index/introducing-gpt-5-5/)、[GPT-5.6 Sol](https://openai.com/index/previewing-gpt-5-6-sol/)
- [Anthropic：Anthropic Labs](https://www.anthropic.com/news/introducing-anthropic-labs)、[Claude Fable 5 与 Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)
- [Google：Gemini 应用升级](https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/)
- [DeepSeek：透明度中心](https://www.deepseek.com/en/transparency/)
- [Qwen：Qwen3.5](https://qwen.ai/blog?email_hash=23463b99b62a72f26ed677cc556c44e8&id=qwen3.5)
- [MiniMax：模型发布记录](https://platform.minimax.io/docs/release-notes/models)、[MiniMax M3](https://www.minimax.io/blog/minimax-m3)
- [Stanford HAI：2026 AI Index](https://hai.stanford.edu/ai-index/2026-ai-index-report)

## 校验警告与解释

1. CSV 的“记录数”是资料库行数，不是行业事件总数；可视化中已明确标注。
2. 公司自报的用户量、benchmark、融资和产品效果保留原来源，不自动视为独立审计结论。
3. 2026 年仍在进行，正文、传记和数据快照均以 2026-08-15 为截止日；之后数据进入下一版。
4. 不同模型的 benchmark、上下文、总参数和激活参数不能直接混成同一条排名；技术章采用分面和独立单位展示。
5. 外部网页可能改版或下线；下一版应重新运行来源可访问性抽查，并保留替换记录。
