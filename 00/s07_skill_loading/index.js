#!/usr/bin/env node
"use strict";

const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const projectRoot = path.resolve(__dirname, "..");
const skillsDir = path.join(projectRoot, "skills");

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

const skillRegistry = scanSkills();
const system = buildSystem();

const subSystem =
  `You are a coding agent at ${projectRoot}. ` +
  "Complete the task you were given, then return a concise summary. " +
  "Do not delegate further.";

let currentTodos = [];
let roundsSinceTodo = 0;
let terminal;

function makeBaseTools() {
  return [
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
              description: "Glob pattern such as **/*.js or s07_skill_loading/*.md.",
            },
          },
          required: ["pattern"],
        },
      },
    },
  ];
}

const baseTools = makeBaseTools();

const tools = [
  ...baseTools,
  {
    type: "function",
    function: {
      name: "todo_write",
      description: "Create and manage a task list for your current coding session.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string", description: "Task description." },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                },
              },
              required: ["content", "status"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task",
      description: "Launch a subagent to handle a complex subtask. Returns only the final conclusion.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "The subtask for the subagent." },
        },
        required: ["description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description: "Load the full content of a skill by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name from the available skills catalog." },
        },
        required: ["name"],
      },
    },
  },
];

const baseToolHandlers = {
  bash: ({ command }) => runBash(String(command || "")),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text: oldText, new_text: newText }) =>
    runEdit(filePath, oldText, newText),
  glob: ({ pattern }) => runGlob(pattern),
};

const toolHandlers = {
  ...baseToolHandlers,
  todo_write: ({ todos }) => runTodoWrite(todos),
  task: ({ description }) => spawnSubagent(String(description || "")),
  load_skill: ({ name }) => loadSkill(String(name || "")),
};

const hooks = {
  UserPromptSubmit: [],
  PreToolUse: [],
  PostToolUse: [],
  Stop: [],
};

const denyList = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if="];

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

function permissionHook(toolCall) {
  if (toolCall.name !== "bash") return null;

  const command = String(toolCall.input.command || "");
  const denied = denyList.find((pattern) => command.includes(pattern));
  if (!denied) return null;

  console.log(`\n\x1b[31mBlocked: '${denied}'\x1b[0m`);
  return "Permission denied";
}

function logHook(toolCall) {
  const prefix = toolCall.subagent ? "[sub hook]" : "[HOOK]";
  console.log(`\x1b[90m${prefix} ${toolCall.name}\x1b[0m`);
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
registerHook("Stop", summaryHook);

async function main() {
  console.log("s07: Skill Loading (Node.js + DeepSeek)");
  console.log("输入问题，回车发送。输入 q 退出。\n");

  terminal = readline.createInterface({ input, output });
  const messages = [{ role: "system", content: system }];

  while (true) {
    const query = await terminal.question("\x1b[36ms07 >> \x1b[0m");
    if (["", "q", "exit"].includes(query.trim().toLowerCase())) break;

    await triggerHooks("UserPromptSubmit", query);
    messages.push({ role: "user", content: query });
    await agentLoop(messages, tools, toolHandlers, false);

    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content) {
      console.log(last.content);
    }
    console.log();
  }

  terminal.close();
}

async function agentLoop(messages, availableTools, handlers, isSubagent, maxTurns = Infinity) {
  let turns = 0;
  while (true) {
    if (turns >= maxTurns) return;
    turns += 1;

    if (!isSubagent && roundsSinceTodo >= 3 && messages.length > 0) {
      messages.push({
        role: "user",
        content: "<reminder>Update your todos.</reminder>",
      });
      roundsSinceTodo = 0;
    }

    const response = await chat(messages, availableTools);
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
      if (!isSubagent) {
        const force = await triggerHooks("Stop", messages);
        if (force) {
          messages.push({ role: "user", content: String(force) });
          continue;
        }
      }
      return;
    }

    if (!isSubagent) roundsSinceTodo += 1;

    for (const rawToolCall of toolCalls) {
      const result = await runTool(rawToolCall, handlers, isSubagent);
      messages.push({
        role: "tool",
        tool_call_id: rawToolCall.id,
        content: result,
      });
    }
  }
}

async function spawnSubagent(description) {
  console.log("\n\x1b[35m[Subagent spawned]\x1b[0m");

  const messages = [
    { role: "system", content: subSystem },
    { role: "user", content: description },
  ];

  await agentLoop(messages, baseTools, baseToolHandlers, true, 30);

  let result = extractFinalText(messages);
  if (!result) {
    result = "Subagent stopped after 30 turns without final answer.";
  }

  console.log("\x1b[35m[Subagent done]\x1b[0m");
  return result;
}

async function chat(messages, availableTools) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: availableTools,
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

async function runTool(rawToolCall, handlers, isSubagent) {
  const name = rawToolCall.function?.name;
  const handler = handlers[name];
  if (!handler) return `Error: Unknown tool ${name || "(missing)"}`;

  const args = parseToolArguments(rawToolCall.function.arguments);
  if (args.error) return args.error;

  const toolCall = { id: rawToolCall.id, name, input: args.value, subagent: isSubagent };
  const blocked = await triggerHooks("PreToolUse", toolCall);
  if (blocked) return String(blocked);

  const result = await handler(args.value);
  await triggerHooks("PostToolUse", toolCall, result);

  if (!isSubagent && name === "todo_write") {
    roundsSinceTodo = 0;
  }

  const preview = String(result).slice(0, isSubagent ? 100 : 200);
  if (isSubagent) {
    console.log(`  \x1b[90m[sub] ${name}: ${preview}\x1b[0m`);
  } else {
    console.log(preview);
  }
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

function extractFinalText(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && message.content) {
      return extractText(message.content);
    }
  }
  return "";
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  return content
    .filter((block) => block?.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
}

function loadSkill(name) {
  const skill = skillRegistry.get(name);
  if (!skill) return `Skill not found: ${name}`;
  return skill.content;
}

function buildSystem() {
  return (
    `You are a coding agent at ${projectRoot}. ` +
    `Skills available:\n${listSkills()}\n` +
    "Use load_skill to get full details when needed."
  );
}

function listSkills() {
  if (skillRegistry.size === 0) return "(no skills found)";
  return Array.from(skillRegistry.values())
    .map((skill) => `- **${skill.name}**: ${skill.description}`)
    .join("\n");
}

function scanSkills() {
  const registry = new Map();
  if (!fs.existsSync(skillsDir)) return registry;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(manifestPath)) continue;

    const content = fs.readFileSync(manifestPath, "utf8");
    const { meta } = parseFrontmatter(content);
    const name = meta.name || entry.name;
    const description =
      meta.description || firstMarkdownHeading(content) || "(no description)";

    registry.set(name, { name, description, content });
  }

  return registry;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---")) return { meta: {}, body: content };

  const end = content.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: content };

  const rawMeta = content.slice(3, end).trim();
  const body = content.slice(end + 4).trim();
  const meta = parseSimpleYaml(rawMeta);
  return { meta, body };
}

function parseSimpleYaml(rawMeta) {
  const meta = {};
  const lines = rawMeta.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = match[2];

    if (value === "|") {
      const block = [];
      index += 1;
      while (index < lines.length && /^\s+/.test(lines[index])) {
        block.push(lines[index].replace(/^\s{2}/, ""));
        index += 1;
      }
      index -= 1;
      meta[key] = block.join("\n").trim();
    } else {
      meta[key] = value.replace(/^['"]|['"]$/g, "").trim();
    }
  }

  return meta;
}

function firstMarkdownHeading(content) {
  const line = content
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith("#"));
  return line ? line.replace(/^#+\s*/, "").trim() : "";
}

function runTodoWrite(todosInput) {
  const normalized = normalizeTodos(todosInput);
  if (normalized.error) return normalized.error;

  currentTodos = normalized.todos;

  const lines = ["\n\x1b[33m## Current Tasks\x1b[0m"];
  for (const todo of currentTodos) {
    const icon = {
      pending: " ",
      in_progress: "\x1b[36m>\x1b[0m",
      completed: "\x1b[32m✓\x1b[0m",
    }[todo.status];
    lines.push(`  [${icon}] ${todo.content}`);
  }

  console.log(lines.join("\n"));
  return `Updated ${currentTodos.length} tasks`;
}

function normalizeTodos(todosInput) {
  let todos = todosInput;

  if (typeof todos === "string") {
    try {
      todos = JSON.parse(todos);
    } catch {
      return { error: "Error: todos must be a list or JSON array string" };
    }
  }

  if (!Array.isArray(todos)) {
    return { error: "Error: todos must be a list" };
  }

  for (let index = 0; index < todos.length; index += 1) {
    const todo = todos[index];
    if (!todo || typeof todo !== "object" || Array.isArray(todo)) {
      return { error: `Error: todos[${index}] must be an object` };
    }
    if (!("content" in todo) || !("status" in todo)) {
      return { error: `Error: todos[${index}] missing 'content' or 'status'` };
    }
    if (!["pending", "in_progress", "completed"].includes(todo.status)) {
      return { error: `Error: todos[${index}] has invalid status '${todo.status}'` };
    }
  }

  return { todos };
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
