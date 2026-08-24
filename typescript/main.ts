import { AgentRuntime } from "./agent.ts";
import { createBashTool, formatToolEvent, ToolRegistry } from "./tools.ts";
import type { Message, ProviderConfig } from "./types.ts";

const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");

const workspace = Deno.env.get("DEEPSEEK_WORKSPACE") || Deno.cwd();
const provider: ProviderConfig = {
  apiKey,
  baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
  model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat",
};
const tools = new ToolRegistry();
tools.register(createBashTool(workspace));
const runtime = new AgentRuntime(provider, tools, {
  maxIterations: 8,
  onToolEvent: (call, result) => console.log(`\n${formatToolEvent(call, result)}\n`),
});
const messages: Message[] = [{
  role: "system",
  content:
    `You are a coding agent working in ${workspace}. Use the bash tool to inspect and modify this workspace.`,
}];

console.log(`DeepSeek TypeScript Agent\n模型：${provider.model}\n工作区：${workspace}`);
console.log("输入 /help 查看命令，输入 /quit 退出。\n");

for await (const line of consoleReadLines()) {
  const input = line.trim();
  if (!input) continue;
  if (input === "/quit" || input === "/exit") break;
  if (input === "/help") {
    console.log("/help  显示帮助\n/clear 清空对话\n/quit  退出");
    continue;
  }
  if (input === "/clear") {
    messages.splice(1);
    console.log("对话历史已清空。\n");
    continue;
  }
  console.log(`你：${input}`);
  console.log(`DeepSeek：${await runtime.runTurn(messages, input)}\n`);
}

async function* consoleReadLines(): AsyncGenerator<string> {
  let pending = "";
  for await (const chunk of Deno.stdin.readable.pipeThrough(new TextDecoderStream())) {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) yield line;
  }
  if (pending) yield pending;
}
