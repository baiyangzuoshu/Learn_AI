# Project Summary

## Overview

This is the **learn-claude-code** tutorial series (Lesson 00), implemented in **Node.js + DeepSeek** (OpenAI-compatible API). It lives at `/Users/youjunmao/WORK/Learn_AI/00/`.

---

## Sections

### s01_agent_loop — Minimal Agent Loop
A basic AI agent loop that:
- Sends messages to DeepSeek's chat API
- Checks for `tool_calls` in the assistant response
- Executes tools and feeds results back into the loop
- Repeats until no more tool calls are requested

### s02_tool_use — Tool Dispatch System
Extends s01 by replacing hardcoded `bash` execution with a tool registry. Available tools:

| Tool | Purpose |
|------|---------|
| `bash` | Execute shell commands |
| `read_file` | Read workspace files |
| `write_file` | Write workspace files |
| `edit_file` | Replace exact text in a file |
| `glob` | Find files by glob pattern |

---

## requirements.txt

**Not found.** No `requirements.txt` exists in this workspace (this is a Node.js project, not Python).

---

## How to Run

1. `cp .env.example .env` — configure your `DEEPSEEK_API_KEY`
2. `npm start` — runs s01
3. `npm run s02` — runs s02
4. Uses Node.js 18+ built-in `fetch` (no external dependencies)
