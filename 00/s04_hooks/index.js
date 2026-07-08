#!/usr/bin/env node
"use strict";

const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const projectRoot = path.resolve(__dirname, "..");

loadEnv(path.join(projectRoot, ".env"));

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = stripTrailingSlash(
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
);
const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

if (!apiKey) {
  console.error("Error: DEEPSEEK_API_KEY is required. Copy .env.example to .env first.");
  process.exit(1);
}

const system = `You are a coding agent at ${projectRoot}. Use tools to solve tasks. Act, don't explain.`;

const tools = [
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to run." },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read file contents from the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the workspace." },
          limit: {
            type: "integer",
            description: "Optional maximum number of lines to return.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the workspace." },
          content: { type: "string", description: "File contents to write." },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Replace exact text in a file once.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the workspace." },
          old_text: { type: "string", description: "Exact text to replace." },
          new_text: { type: "string", description: "Replacement text." },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description: "Find files matching a glob pattern in the workspace.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern such as **/*.js or s04_hooks/*.md.",
          },
        },
        required: ["pattern"],
      },
    },
  },
];

const toolHandlers = {
  bash: ({ command }) => runBash(String(command || "")),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text: oldText, new_text: newText }) =>
    runEdit(filePath, oldText, newText),
  glob: ({ pattern }) => runGlob(pattern),
};

const hooks = {
  UserPromptSubmit: [],
  PreToolUse: [],
  PostToolUse: [],
  Stop: [],
};

const denyList = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if="];
const destructivePatterns = ["rm ", "> /etc/", "chmod 777"];

let terminal;

function registerHook(event, callback) {
  hooks[event].push(callback);
}

async function triggerHooks(event, ...args) {
  for (const callback of hooks[event]) {
    const result = await callback(...args);
    if (result !== undefined && result !== null) {
      return result;
    }
  }
  return null;
}

async function permissionHook(toolCall) {
  if (toolCall.name === "bash") {
    const command = String(toolCall.input.command || "");
    const denied = denyList.find((pattern) => command.includes(pattern));
    if (denied) {
      console.log(`\n\x1b[31mBlocked: '${denied}'\x1b[0m`);
      return "Permission denied by deny list";
    }

    const destructive = destructivePatterns.find((pattern) => command.includes(pattern));
    if (destructive) {
      console.log("\n\x1b[33mPotentially destructive command\x1b[0m");
      console.log(`   Tool: ${toolCall.name}(${JSON.stringify(toolCall.input)})`);
      const choice = await terminal.question("   Allow? [y/N] ");
      if (!["y", "yes"].includes(choice.trim().toLowerCase())) {
        return "Permission denied by user";
      }
    }
  }

  if (["write_file", "edit_file"].includes(toolCall.name)) {
    if (pathEscapesWorkspace(toolCall.input.path)) {
      console.log("\n\x1b[33mWriting outside workspace\x1b[0m");
      console.log(`   Tool: ${toolCall.name}(${JSON.stringify(toolCall.input)})`);
      const choice = await terminal.question("   Allow? [y/N] ");
      if (!["y", "yes"].includes(choice.trim().toLowerCase())) {
        return "Permission denied by user";
      }
    }
  }

  return null;
}

function logHook(toolCall) {
  const preview = JSON.stringify(toolCall.input).slice(0, 80);
  console.log(`\x1b[90m[HOOK] ${toolCall.name}(${preview})\x1b[0m`);
  return null;
}

function largeOutputHook(toolCall, result) {
  const size = String(result).length;
  if (size > 100_000) {
    console.log(`\x1b[33m[HOOK] Large output from ${toolCall.name}: ${size} chars\x1b[0m`);
  }
  return null;
}

function contextInjectHook() {
  console.log(`\x1b[90m[HOOK] UserPromptSubmit: working in ${projectRoot}\x1b[0m`);
  return null;
}

function summaryHook(messages) {
  const toolCount = messages.filter((message) => message.role === "tool").length;
  console.log(`\x1b[90m[HOOK] Stop: session used ${toolCount} tool calls\x1b[0m`);
  return null;
}

registerHook("UserPromptSubmit", contextInjectHook);
registerHook("PreToolUse", permissionHook);
registerHook("PreToolUse", logHook);
registerHook("PostToolUse", largeOutputHook);
registerHook("Stop", summaryHook);

async function main() {
  console.log("s04: Hooks (Node.js + DeepSeek)");
  console.log("输入问题，回车发送。输入 q 退出。\n");

  terminal = readline.createInterface({ input, output });
  const messages = [{ role: "system", content: system }];

  while (true) {
    const query = await terminal.question("\x1b[36ms04 >> \x1b[0m");
    if (["", "q", "exit"].includes(query.trim().toLowerCase())) break;

    await triggerHooks("UserPromptSubmit", query);
    messages.push({ role: "user", content: query });
    await agentLoop(messages);

    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content) {
      console.log(last.content);
    }
    console.log();
  }

  terminal.close();
}

async function agentLoop(messages) {
  while (true) {
    const response = await chat(messages);
    const message = response.choices?.[0]?.message;

    if (!message) {
      throw new Error(`Malformed DeepSeek response: ${JSON.stringify(response)}`);
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    });

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      const force = await triggerHooks("Stop", messages);
      if (force) {
        messages.push({ role: "user", content: String(force) });
        continue;
      }
      return;
    }

    for (const rawToolCall of toolCalls) {
      const result = await runTool(rawToolCall);
      messages.push({
        role: "tool",
        tool_call_id: rawToolCall.id,
        content: result,
      });
    }
  }
}

async function chat(messages) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 8000,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`DeepSeek returned non-JSON response (${res.status}): ${text}`);
  }

  if (!res.ok) {
    throw new Error(`DeepSeek API error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function runTool(rawToolCall) {
  const name = rawToolCall.function?.name;
  const handler = toolHandlers[name];
  if (!handler) return `Error: Unknown tool ${name || "(missing)"}`;

  const args = parseToolArguments(rawToolCall.function.arguments);
  if (args.error) return args.error;

  const toolCall = { id: rawToolCall.id, name, input: args.value };
  const blocked = await triggerHooks("PreToolUse", toolCall);
  if (blocked) return String(blocked);

  const result = await handler(args.value);
  await triggerHooks("PostToolUse", toolCall, result);
  console.log(String(result).slice(0, 200));
  return String(result);
}

function parseToolArguments(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
    return { value };
  } catch (error) {
    return { error: `Error: Invalid tool arguments: ${error.message}` };
  }
}

function runBash(command) {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: projectRoot,
        timeout: 120_000,
        maxBuffer: 50_000,
        shell: process.env.SHELL || "/bin/sh",
      },
      (error, stdout, stderr) => {
        const out = `${stdout || ""}${stderr || ""}`.trim();

        if (error?.killed) {
          resolve("Error: Timeout (120s)");
          return;
        }

        resolve(out ? out.slice(0, 50_000) : "(no output)");
      },
    );
  });
}

function runRead(filePath, limit) {
  try {
    const fullPath = safePath(filePath);
    let lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    const maxLines = Number(limit);

    if (Number.isInteger(maxLines) && maxLines > 0 && maxLines < lines.length) {
      lines = lines.slice(0, maxLines).concat(`... (${lines.length - maxLines} more lines)`);
    }

    return lines.join("\n").slice(0, 50_000);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function runWrite(filePath, content) {
  try {
    const fullPath = safePath(filePath);
    const text = String(content ?? "");
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, text, "utf8");
    return `Wrote ${Buffer.byteLength(text, "utf8")} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function runEdit(filePath, oldText, newText) {
  try {
    const fullPath = safePath(filePath);
    const oldValue = String(oldText ?? "");
    const newValue = String(newText ?? "");
    const text = fs.readFileSync(fullPath, "utf8");

    if (!text.includes(oldValue)) {
      return `Error: text not found in ${filePath}`;
    }

    fs.writeFileSync(fullPath, text.replace(oldValue, newValue), "utf8");
    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function runGlob(pattern) {
  try {
    const normalizedPattern = normalizeRelativePath(String(pattern || ""));
    const matcher = globToRegExp(normalizedPattern);
    const results = walkFiles(projectRoot)
      .map((file) => normalizeRelativePath(path.relative(projectRoot, file)))
      .filter((file) => matcher.test(file))
      .sort();

    return results.length ? results.join("\n").slice(0, 50_000) : "(no matches)";
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function safePath(filePath) {
  const fullPath = path.resolve(projectRoot, String(filePath || ""));
  const relative = path.relative(projectRoot, fullPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${filePath}`);
  }

  return fullPath;
}

function pathEscapesWorkspace(filePath) {
  try {
    safePath(filePath);
    return false;
  } catch {
    return true;
  }
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function globToRegExp(pattern) {
  let source = "^";

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(char);
    }
  }

  return new RegExp(`${source}$`);
}

function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
