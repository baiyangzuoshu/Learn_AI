const API = "/api";
const $ = (selector) => document.querySelector(selector);
const messages = $("#messages"),
  eventsContent = $("#events-content"),
  form = $("#composer"),
  runtimeStatus = $("#runtime-status"),
  runtimeTraceDetails = $("#runtime-trace-details"),
  runtimeTraceSpans = $("#runtime-trace-spans"),
  runtimeTaskState = $("#runtime-task-state"),
  runtimeWorkerState = $("#runtime-worker-state"),
  runtimeHandoffState = $("#runtime-handoff-state"),
  runtimeDetailPanel = $("#runtime-detail-panel"),
  runtimeDetailTabs = [...document.querySelectorAll("[data-runtime-tab]")],
  runtimeDetailViews = [...document.querySelectorAll("[data-runtime-view]")];
const input = $("#prompt"), send = $("#send"), status = $("#status");
const modelSelect = $("#model-select"),
  settingsDialog = $("#settings-dialog"),
  testsDialog = $("#tests-dialog");
const permissionMode = $("#permission-mode"), permissionHint = $("#permission-hint");
const navToggle = $("#nav-toggle"), workspacePanelToggle = $("#toggle-workspace-panel");
const workspacePanelRoot = $("#workspace-panel-root"),
  workspaceFilesStatus = $("#workspace-files-status"),
  workspaceFiles = $("#workspace-files"),
  workspaceGitStatus = $("#workspace-git-status"),
  workspaceGitSummary = $("#workspace-git-summary");
const composerStep = $("#composer-step"), composerChangeSummary = $("#composer-change-summary");
const settingsForm = $("#settings-form"),
  providerSelect = $("#provider-select"),
  providerNameInput = $("#provider-name"),
  modelsInput = $("#models"),
  defaultModel = $("#default-model"),
  openLessonTestsButton = $("#open-lesson-tests"),
  showLessonTestsButton = $("#show-lesson-tests"),
  runAllLessonTestsButton = $("#run-all-lesson-tests"),
  lessonTestList = $("#lesson-test-list"),
  lessonTestSummary = $("#lesson-test-summary"),
  runtimeTestOutput = $("#runtime-test-output");
let settings = {}, sessions = [], activeSessionId = null;
let providerApiKeys = {}, activeProviderId = null;
let generationController = null;
let cronSchedules = [];
let runStep = 0, runToolCount = 0;
let lastBudgetUsage = null;
let startupUpdateCheckDone = false;
let lastUpdateCheck = null;
let lastBalanceAt = 0;
let lastBalanceProviderId = "";
const AUTO_SCROLL_MARGIN = 96;
const APP_STARTED_AT = Date.now();
const CONTEXT_TOKEN_LIMIT = 1_000_000;
const CONTEXT_COMPACT_AT = 0.8;
let activeWorkspaceTab = localStorage.getItem("ai-agent:workspace-tab") || "overview";
let activeRuntimeDetail = null;

function syncRuntimeStatusHeight() {
  if (!runtimeStatus) return;
  document.documentElement.style.setProperty(
    "--runtime-status-height",
    `${runtimeStatus.getBoundingClientRect().height}px`,
  );
}
if (runtimeStatus && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(syncRuntimeStatusHeight).observe(runtimeStatus);
}
window.addEventListener("resize", syncRuntimeStatusHeight);
syncRuntimeStatusHeight();

function setRuntimeDetailTab(tab) {
  const next = tab && activeRuntimeDetail !== tab ? tab : activeRuntimeDetail === tab ? null : tab;
  activeRuntimeDetail = next;
  if (runtimeDetailPanel) runtimeDetailPanel.hidden = !next;
  runtimeDetailTabs.forEach((button) => {
    const active = Boolean(next && button.dataset.runtimeTab === next);
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  runtimeDetailViews.forEach((view) => {
    view.hidden = view.dataset.runtimeView !== next;
  });
  syncRuntimeStatusHeight();
}

runtimeDetailTabs.forEach((button) => {
  button.addEventListener("click", () => setRuntimeDetailTab(button.dataset.runtimeTab));
});

function formatBudgetNumber(value) {
  const number = Number(value || 0);
  return number >= 1000 ? `${(number / 1000).toFixed(1)}k` : String(number);
}
function formatBudgetUsage(usage, compact = false) {
  const used = usage?.used || {}, limit = usage?.limit || {};
  if (compact) {
    return `${formatBudgetNumber(used.iterations)}/${formatBudgetNumber(limit.iterations)}轮 · ${
      formatBudgetNumber(used.toolCalls)
    }/${formatBudgetNumber(limit.toolCalls)}工具 · ${formatBudgetNumber(used.outputChars)}/${
      formatBudgetNumber(limit.outputChars)
    }字 · ${formatBudgetNumber(used.cost)}/${formatBudgetNumber(limit.cost)}成本`;
  }
  return `迭代 ${formatBudgetNumber(used.iterations)}/${
    formatBudgetNumber(limit.iterations)
  } · 工具 ${formatBudgetNumber(used.toolCalls)}/${formatBudgetNumber(limit.toolCalls)}\n输出 ${
    formatBudgetNumber(used.outputChars)
  }/${formatBudgetNumber(limit.outputChars)} 字符 · 成本 ${formatBudgetNumber(used.cost)}/${
    formatBudgetNumber(limit.cost)
  } 单位`;
}
function renderBudgetUsage(usage) {
  lastBudgetUsage = usage;
  const used = usage?.used || {}, limit = usage?.limit || {};
  $("#runtime-budget-iterations").textContent = `${formatBudgetNumber(used.iterations)}/${
    formatBudgetNumber(limit.iterations)
  }`;
  $("#runtime-budget-tools").textContent = `${formatBudgetNumber(used.toolCalls)}/${
    formatBudgetNumber(limit.toolCalls)
  }`;
  $("#runtime-budget-output").textContent = `${formatBudgetNumber(used.outputChars)}/${
    formatBudgetNumber(limit.outputChars)
  }`;
  $("#runtime-budget-cost").textContent = `${formatBudgetNumber(used.cost)}/${
    formatBudgetNumber(limit.cost)
  }`;
}
function appendBudgetResult(container = messages) {
  if (!lastBudgetUsage) return;
  const card = document.createElement("div");
  card.className = "budget-result";
  card.innerHTML = `<b>本次对话预算</b><span>${
    formatBudgetUsage(lastBudgetUsage)
  }</span><small>剩余 ${formatBudgetNumber(lastBudgetUsage.remaining?.iterations)} 轮 / ${
    formatBudgetNumber(lastBudgetUsage.remaining?.toolCalls)
  } 次工具调用</small>`;
  container.append(card);
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  const images = [];
  let html = escapeHtml(value).replace(
    /!\[([^\]\n]*)\]\((\/api\/workspace\/image\?path=(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~-])+)\)/g,
    (_, alt, src) => {
      const index = images.push(
        `<img class="generated-image" src="${src}" alt="${alt}" loading="lazy" />`,
      ) - 1;
      return `\u0000IMAGE${index}\u0000`;
    },
  ).replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codeSpans.push(`<code>${code}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });
  html = html.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, href) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`,
  );
  html = html
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  return html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => codeSpans[Number(index)] || "")
    .replace(/\u0000IMAGE(\d+)\u0000/g, (_, index) => images[Number(index)] || "");
}

function splitMarkdownTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let html = "", listType = "", inCode = false, codeLang = "";
  let paragraph = [], codeLines = [];

  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>`;
    listType = "";
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`;
    paragraph = [];
  };
  const openList = (type) => {
    flushParagraph();
    if (listType === type) return;
    closeList();
    html += `<${type}>`;
    listType = type;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim();

    if (inCode) {
      if (/^\s*```\s*$/.test(line)) {
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        html += `<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
        inCode = false;
        codeLang = "";
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const fence = line.match(/^\s*```([A-Za-z0-9_-]+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      inCode = true;
      codeLang = fence[1] || "";
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (i + 1 < lines.length && trimmed.includes("|") && isMarkdownTableSeparator(lines[i + 1])) {
      flushParagraph();
      closeList();
      const header = splitMarkdownTableRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(splitMarkdownTableRow(lines[i]));
        i++;
      }
      i--;
      html += `<table><thead><tr>${
        header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")
      }</tr></thead><tbody>${
        rows.map((row) =>
          `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`
        ).join("")
      }</tbody></table>`;
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      const quoteLines = [];
      while (i < lines.length) {
        const match = lines[i].match(/^\s*>\s?(.*)$/);
        if (!match) break;
        quoteLines.push(match[1]);
        i++;
      }
      i--;
      html += `<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html += "<hr>";
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      openList("ul");
      html += `<li>${renderInlineMarkdown(unordered[1])}</li>`;
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html += `<li>${renderInlineMarkdown(ordered[1])}</li>`;
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCode) html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
  flushParagraph();
  closeList();
  return html;
}

function renderToolEvent(event) {
  let input = {};
  try {
    input = JSON.parse(event.input || "{}");
  } catch { /* keep raw input */ }
  if (event.name === "todo_write" && Array.isArray(input.todos)) {
    return `<div class="event todo-event"><b>Todo · 任务计划</b>${
      input.todos.map((todo) =>
        `<div class="todo-row ${todo.status}"><span>${
          todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "▸" : "○"
        }</span>${escapeHtml(todo.content)}</div>`
      ).join("")
    }</div>`;
  }
  if (event.name === "task_graph_write" && Array.isArray(input.nodes)) {
    return `<div class="event task-graph-event"><b>Task Graph · 持久化任务图</b>${
      input.nodes.map((node) =>
        `<div class="graph-node ${escapeHtml(node.status)}"><span>${
          node.status === "completed"
            ? "✓"
            : node.status === "in_progress"
            ? "▸"
            : node.status === "blocked"
            ? "!"
            : "○"
        }</span><div><strong>${escapeHtml(node.id)}</strong> ${escapeHtml(node.title)}${
          node.dependsOn?.length
            ? `<small>依赖：${escapeHtml(node.dependsOn.join(", "))}</small>`
            : ""
        }</div></div>`
      ).join("")
    }</div>`;
  }
  if (event.name.startsWith("cron_")) {
    let result = [];
    try {
      const parsed = JSON.parse(event.output || "[]");
      result = Array.isArray(parsed) ? parsed : parsed.schedule ? [parsed.schedule] : [];
    } catch { /* show raw output */ }
    return `<div class="event cron-event"><b>Cron · ${escapeHtml(event.name)}</b>${
      result.map((schedule) =>
        `<div class="cron-schedule ${schedule.enabled ? "enabled" : "disabled"}"><strong>${
          escapeHtml(schedule.id)
        }</strong><span>${schedule.enabled ? "已启用" : "已停用"}</span><small>${
          escapeHtml(schedule.title || "")
        } · ${
          escapeHtml(schedule.workspace ? schedule.workspace.split("/").pop() : "默认全局项目")
        } · 每 ${escapeHtml(schedule.intervalSeconds)} 秒</small><code>${
          escapeHtml(schedule.prompt || "")
        }</code>${
          schedule.lastConversationId
            ? `<em>最近对话：${escapeHtml(schedule.lastConversationId)}</em>`
            : ""
        }</div>`
      ).join("")
    }${
      !result.length ? `<span class="event-output">${escapeHtml(event.output)}</span>` : ""
    }</div>`;
  }
  if (event.name.startsWith("background_")) {
    let result = {};
    try {
      result = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    const jobList = Array.isArray(result) ? result : [result];
    return `<div class="event background-event"><b>Background · ${escapeHtml(event.name)}</b>${
      jobList.map((job) =>
        job.id
          ? `<div class="background-job ${escapeHtml(job.status)}"><strong>${
            escapeHtml(job.id)
          }</strong><span>${escapeHtml(job.status)}</span>${
            job.command ? `<small>${escapeHtml(job.command)}</small>` : ""
          }${job.output ? `<pre>${escapeHtml(job.output)}</pre>` : ""}</div>`
          : ""
      ).join("")
    }${
      !jobList.some((job) => job.id)
        ? `<span class="event-output">${escapeHtml(event.output)}</span>`
        : ""
    }</div>`;
  }
  if (event.name === "subagent") {
    return `<div class="event subagent-event"><b>Subagent · 隔离子任务</b><span class="subagent-task">${
      escapeHtml(input.task || "")
    }</span><span class="subagent-result">${escapeHtml(event.output || "")}</span></div>`;
  }
  if (event.name === "team_run") {
    let team = { members: [] };
    try {
      team = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    return `<div class="event team-event"><b>Agent Team · 并行团队</b><span class="team-objective">${
      escapeHtml(team.objective || input.objective || "")
    }</span>${
      (team.members || []).map((member) =>
        `<div class="team-member ${escapeHtml(member.status)}"><div><strong>${
          escapeHtml(member.role)
        }</strong><span>${escapeHtml(member.status)}</span></div><small>${
          escapeHtml(member.task)
        }</small><pre>${escapeHtml(member.result || "")}</pre></div>`
      ).join("")
    }</div>`;
  }
  if (event.name === "team_protocol_run") {
    let team = { members: [], messages: [] };
    try {
      team = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    return `<div class="event team-event protocol-event"><b>Team Protocol · ${
      escapeHtml(team.teamId || "")
    }</b><span class="team-objective">${
      escapeHtml(team.objective || input.objective || "")
    }</span><div class="protocol-messages">${
      (team.messages || []).map((message) =>
        `<div><strong>${escapeHtml(message.from)} → ${escapeHtml(message.to)}</strong><span>${
          escapeHtml(message.kind)
        }</span><p>${escapeHtml(message.content)}</p></div>`
      ).join("")
    }</div>${
      (team.members || []).map((member) =>
        `<div class="team-member ${escapeHtml(member.status)}"><div><strong>${
          escapeHtml(member.role)
        }</strong><span>${escapeHtml(member.status)}</span></div><small>${
          escapeHtml(member.task)
        }</small><pre>${escapeHtml(member.result || "")}</pre></div>`
      ).join("")
    }</div>`;
  }
  if (event.name === "autonomous_run") {
    let run = { iterations: [] };
    try {
      run = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    return `<div class="event autonomy-event"><b>Autonomy · ${
      escapeHtml(run.status || "")
    }</b><span class="team-objective">${escapeHtml(run.objective || input.objective || "")}</span>${
      (run.iterations || []).map((item) =>
        `<div class="autonomy-iteration ${
          item.completed ? "completed" : "continue"
        }"><strong>Iteration ${escapeHtml(item.iteration)}</strong><span>${
          item.completed ? "完成" : "继续"
        }</span><pre>${escapeHtml(item.output || "")}</pre></div>`
      ).join("")
    }</div>`;
  }
  if (event.name.startsWith("worktree_")) {
    let data = {};
    try {
      data = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    const items = Array.isArray(data) ? data : [data];
    return `<div class="event worktree-event"><b>Git Worktree · ${escapeHtml(event.name)}</b>${
      items.map((item) =>
        item.id
          ? `<div class="worktree-card"><strong>${escapeHtml(item.id)}</strong><span>${
            escapeHtml(item.branch || (item.removed ? "已移除" : ""))
          }</span>${item.path ? `<small>${escapeHtml(item.path)}</small>` : ""}${
            item.status ? `<pre>${escapeHtml(item.status)}</pre>` : ""
          }${item.result ? `<pre>${escapeHtml(item.result)}</pre>` : ""}</div>`
          : ""
      ).join("")
    }</div>`;
  }
  if (event.name.startsWith("mcp_")) {
    return `<div class="event mcp-event"><b>MCP · ${
      escapeHtml(event.name)
    }</b><span class="mcp-target">${escapeHtml(input.server || "工作区服务器")}${
      input.tool ? ` / ${escapeHtml(input.tool)}` : ""
    }</span><pre>${escapeHtml(event.output || "")}</pre></div>`;
  }
  if (event.name.startsWith("harness_")) {
    let data = {};
    try {
      data = JSON.parse(event.output || "{}");
    } catch { /* show raw output */ }
    return `<div class="event harness-event"><b>Harness · ${
      escapeHtml(event.name)
    }</b><span class="mcp-target">${
      escapeHtml(
        data.stage ||
          (data.ok === true ? "全部检查通过" : data.ok === false ? "检查未通过" : "s21"),
      )
    }</span><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
  }
  if (event.name === "list_skills") {
    return `<div class="event skill-event"><b>Skills · 可用技能</b><span class="skill-list">${
      escapeHtml(event.output || "无可用技能")
    }</span></div>`;
  }
  if (event.name === "load_skill") {
    return `<div class="event skill-event"><b>Skill · ${
      escapeHtml(input.name || "")
    }</b><span class="skill-loaded">✓ 已按需加载 SKILL.md</span></div>`;
  }
  const fileTool = ["read_file", "write_file", "edit_file"].includes(event.name) && input.path;
  if (fileTool) {
    return `<div class="event"><b>${event.name}</b><button class="file-link" data-path="${
      escapeHtml(input.path)
    }">↗ ${escapeHtml(input.path)}</button></div>`;
  }
  return `<div class="event"><b>${event.name}</b><br>${escapeHtml(event.input)}${
    event.output ? `<span class="event-output">${escapeHtml(event.output)}</span>` : ""
  }</div>`;
}
function providerList() {
  if (Array.isArray(settings.providers) && settings.providers.length) return settings.providers;
  return [{
    id: settings.defaultProviderId || "deepseek",
    name: "DeepSeek 官方",
    protocol: "openai",
    baseUrl: settings.baseUrl || "https://api.deepseek.com",
    models: settings.models || [],
    defaultModel: settings.defaultModel,
    hasApiKey: Boolean(settings.hasApiKey),
    builtIn: true,
  }];
}
function modelOptionValue(providerId, model) {
  return `${encodeURIComponent(providerId)}:${encodeURIComponent(model)}`;
}
function selectedModel(select) {
  const option = select.selectedOptions?.[0];
  return {
    providerId: option?.dataset.providerId || settings.defaultProviderId || providerList()[0]?.id,
    model: option?.dataset.model || select.value || settings.defaultModel,
  };
}
function selectedModelLabel(select) {
  const option = select.selectedOptions?.[0];
  return option?.textContent || settings.defaultModel || "—";
}
function fillModels(select, selected = {}) {
  const providers = providerList();
  const selectedProviderId = typeof selected === "object" && selected.providerId
    ? selected.providerId
    : settings.defaultProviderId || providers[0]?.id;
  const selectedModelName = typeof selected === "string" ? selected : selected.model ||
    providers.find((provider) => provider.id === selectedProviderId)?.defaultModel;
  select.innerHTML = providers.map((provider) =>
    `<optgroup label="${escapeHtml(provider.name)}">${
      (provider.models || []).map((model) =>
        `<option value="${escapeHtml(modelOptionValue(provider.id, model))}" data-provider-id="${
          escapeHtml(provider.id)
        }" data-model="${escapeHtml(model)}">${escapeHtml(model)}</option>`
      ).join("")
    }</optgroup>`
  ).join("");
  const selectedValue = modelOptionValue(selectedProviderId, selectedModelName || "");
  select.value = selectedValue;
  if (!select.value && select.options.length) select.selectedIndex = 0;
}
function activeProvider() {
  return providerList().find((provider) => provider.id === activeProviderId) || providerList()[0];
}
function fillDefaultModel(provider) {
  const models = (provider?.models || []).filter(Boolean);
  defaultModel.innerHTML = models.map((model) =>
    `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  defaultModel.value = provider?.defaultModel && models.includes(provider.defaultModel)
    ? provider.defaultModel
    : models[0] || "";
}
function syncActiveProviderDraft() {
  if (!activeProviderId) return;
  const providers = providerList().map((provider) => ({ ...provider }));
  const provider = providers.find((item) => item.id === activeProviderId);
  if (!provider) return;
  provider.name = providerNameInput.value.trim() || provider.name;
  provider.baseUrl = $("#base-url").value.trim();
  provider.models = modelsInput.value.split("\n").map((item) => item.trim()).filter(Boolean);
  provider.defaultModel = defaultModel.value || provider.models[0] || "";
  provider.protocol = "openai";
  providerApiKeys[provider.id] = $("#api-key").value.trim();
  settings.providers = providers;
}
function renderProviderEditor() {
  const providers = providerList();
  activeProviderId = activeProviderId && providers.some((item) => item.id === activeProviderId)
    ? activeProviderId
    : settings.defaultProviderId || providers[0]?.id;
  providerSelect.innerHTML = providers.map((provider) =>
    `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`
  ).join("");
  providerSelect.value = activeProviderId;
  const provider = activeProvider();
  providerNameInput.value = provider?.name || "";
  $("#base-url").value = provider?.baseUrl || "";
  modelsInput.value = (provider?.models || []).join("\n");
  fillDefaultModel(provider);
  $("#api-key").value = providerApiKeys[provider?.id] || "";
  $("#key-status").textContent = provider?.hasApiKey || providerApiKeys[provider?.id]
    ? `✓ ${provider.name} 已配置 API Key`
    : `${provider?.name || "当前供应商"} 尚未配置 API Key`;
  $("#remove-provider").disabled = providers.length <= 1;
}
function collectProvidersForSave() {
  syncActiveProviderDraft();
  return providerList().map((provider) => ({
    id: provider.id,
    name: provider.name,
    protocol: "openai",
    baseUrl: provider.baseUrl,
    models: provider.models || [],
    defaultModel: provider.defaultModel,
    builtIn: provider.builtIn,
    apiKey: providerApiKeys[provider.id] || "",
  }));
}
function storageKey() {
  return `ai-agent:sessions:${settings.workspace || "none"}`;
}
function activeSession() {
  return sessions.find((session) => session.id === activeSessionId);
}
function isMessagesNearBottom() {
  return messages.scrollHeight - messages.scrollTop - messages.clientHeight <= AUTO_SCROLL_MARGIN;
}
function scrollMessagesToBottom() {
  messages.scrollTop = messages.scrollHeight;
}
function formatNumber(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "—";
}
function formatCost(value, currency = "USD") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const prefix = currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `;
  if (amount === 0) return `${prefix}0`;
  return `${prefix}${Math.abs(amount) < 0.01 ? amount.toFixed(4) : amount.toFixed(3)}`;
}
function formatBalance(data) {
  const balances = Array.isArray(data?.balanceInfos) ? data.balanceInfos : [];
  const balance = balances.find((item) => item.currency === "CNY") || balances[0];
  if (!balance) return "—";
  const amount = Number(balance.totalBalance);
  if (!Number.isFinite(amount)) return "—";
  const prefix = balance.currency === "CNY" ? "¥" : "US$";
  return `${prefix}${amount.toFixed(2)}`;
}
function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}分${rest}秒` : `${minutes}分`;
  const hours = Math.floor(minutes / 60), minuteRest = minutes % 60;
  return minuteRest ? `${hours}小时${minuteRest}分` : `${hours}小时`;
}
function formatTraceDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return "—";
  return value < 1_000 ? `${Math.max(0, Math.round(value))}ms` : formatDuration(value);
}
function traceStatusLabel(status) {
  return status === "ok"
    ? "完成"
    : status === "cancelled"
    ? "已取消"
    : status === "error"
    ? "失败"
    : "运行中";
}
function traceKindLabel(kind) {
  return kind === "provider" ? "Provider" : kind === "tool" ? "工具" : "运行";
}
function shortTraceId(value) {
  const id = String(value || "");
  return id ? id.slice(-12) : "—";
}
function taskStateLabel(state) {
  return state === "planned"
    ? "计划中"
    : state === "running"
    ? "执行中"
    : state === "verified"
    ? "已验证"
    : "已阻塞";
}
function syncTaskDetailEmpty() {
  const empty = $("#runtime-task-empty");
  if (!empty) return;
  const hasTask = Boolean(runtimeTaskState && !runtimeTaskState.hidden);
  const hasWorker = Boolean(runtimeWorkerState && !runtimeWorkerState.hidden);
  const hasHandoff = Boolean(runtimeHandoffState && !runtimeHandoffState.hidden);
  empty.hidden = hasTask || hasWorker || hasHandoff;
}
function renderTaskState(task) {
  if (!runtimeTaskState) return;
  if (!task || typeof task !== "object") {
    runtimeTaskState.hidden = true;
    runtimeTaskState.classList.remove(
      "task-planned",
      "task-running",
      "task-verified",
      "task-blocked",
    );
    syncTaskDetailEmpty();
    return;
  }
  $("#runtime-task-id").textContent = shortTraceId(task.id);
  $("#runtime-task-status").textContent = taskStateLabel(task.state);
  $("#runtime-task-revision").textContent = formatBudgetNumber(task.revision);
  $("#runtime-task-evidence").textContent = formatBudgetNumber(
    Number.isFinite(Number(task.evidenceCount))
      ? Number(task.evidenceCount)
      : Array.isArray(task.evidence)
      ? task.evidence.length
      : 0,
  );
  $("#runtime-task-goal").textContent = String(task.goal || "—");
  runtimeTaskState.hidden = false;
  runtimeTaskState.classList.remove(
    "task-planned",
    "task-running",
    "task-verified",
    "task-blocked",
  );
  runtimeTaskState.classList.add(`task-${String(task.state || "planned")}`);
  syncTaskDetailEmpty();
}
function workerStatusLabel(status) {
  return status === "queued"
    ? "排队"
    : status === "leased"
    ? "执行中"
    : status === "done"
    ? "完成"
    : status === "dead"
    ? "Dead Letter"
    : "—";
}
function workerLeaseLabel(leaseUntil) {
  if (!leaseUntil) return "—";
  const remaining = new Date(leaseUntil).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "已过期";
  return `${Math.ceil(remaining / 1_000)}秒`;
}
function workerRetryLabel(worker) {
  if (worker.status !== "queued" || Number(worker.attempts) <= 0) return "—";
  const next = Date.parse(String(worker.nextAttemptAt || ""));
  if (Number.isFinite(next) && next > Date.now()) {
    return `等待 ${Math.ceil((next - Date.now()) / 1_000)}秒`;
  }
  return "可重试";
}
function renderWorkerState(worker) {
  if (!runtimeWorkerState) return;
  const classes = ["worker-queued", "worker-leased", "worker-done", "worker-dead"];
  if (!worker || typeof worker !== "object") {
    runtimeWorkerState.hidden = true;
    runtimeWorkerState.classList.remove(...classes);
    syncTaskDetailEmpty();
    return;
  }
  $("#runtime-worker-id").textContent = shortTraceId(worker.id);
  $("#runtime-worker-status").textContent = workerStatusLabel(worker.status);
  $("#runtime-worker-lease").textContent = workerLeaseLabel(worker.leaseUntil);
  $("#runtime-worker-attempts").textContent = `${formatBudgetNumber(worker.attempts)}/${
    formatBudgetNumber(worker.maxAttempts)
  }`;
  $("#runtime-worker-retry").textContent = workerRetryLabel(worker);
  $("#runtime-worker-dead").textContent = worker.status === "dead" ? "是" : "否";
  runtimeWorkerState.hidden = false;
  runtimeWorkerState.classList.remove(...classes);
  runtimeWorkerState.classList.add(`worker-${String(worker.status || "queued")}`);
  syncTaskDetailEmpty();
}
function handoffStatusLabel(state) {
  return state === "submitted"
    ? "已提交"
    : state === "running"
    ? "交接中"
    : state === "complete"
    ? "已完成"
    : state === "failed"
    ? "失败"
    : "—";
}
function renderHandoffState(handoff) {
  if (!runtimeHandoffState) return;
  const classes = ["handoff-submitted", "handoff-running", "handoff-complete", "handoff-failed"];
  if (!handoff || typeof handoff !== "object") {
    runtimeHandoffState.hidden = true;
    runtimeHandoffState.classList.remove(...classes);
    syncTaskDetailEmpty();
    return;
  }
  $("#runtime-handoff-id").textContent = shortTraceId(handoff.id);
  $("#runtime-handoff-tenant").textContent = String(handoff.tenant || "—");
  $("#runtime-handoff-role").textContent = String(handoff.role || "—");
  $("#runtime-handoff-status").textContent = handoffStatusLabel(handoff.state);
  $("#runtime-handoff-trace").textContent = shortTraceId(handoff.traceId);
  $("#runtime-handoff-evidence").textContent = formatBudgetNumber(
    Array.isArray(handoff.evidence) ? handoff.evidence.length : 0,
  );
  runtimeHandoffState.hidden = false;
  runtimeHandoffState.classList.remove(...classes);
  runtimeHandoffState.classList.add(`handoff-${String(handoff.state || "submitted")}`);
  syncTaskDetailEmpty();
}
function renderTraceDetails(summary) {
  if (!runtimeTraceDetails || !runtimeTraceSpans) return;
  const spans = Array.isArray(summary?.spans) ? summary.spans : [];
  const root = spans.find((span) => span.spanId === summary.rootSpanId) || spans[0];
  const rootStartedAt = Number(root?.startedAt);
  $("#runtime-trace-id").textContent = String(summary.traceId || "—");
  $("#runtime-trace-status").textContent = traceStatusLabel(summary.status);
  $("#runtime-trace-root").textContent = shortTraceId(summary.rootSpanId);
  $("#runtime-trace-provider").textContent = formatBudgetNumber(summary.providerCalls);
  $("#runtime-trace-tools").textContent = formatBudgetNumber(summary.toolCalls);
  $("#runtime-trace-errors").textContent = formatBudgetNumber(summary.errorSpans);
  runtimeTraceSpans.innerHTML = spans.length
    ? spans.map((span, index) => {
      const startedAt = Number(span.startedAt);
      const offset = Number.isFinite(startedAt) && Number.isFinite(rootStartedAt)
        ? `+${Math.max(0, Math.round(startedAt - rootStartedAt))}ms`
        : "—";
      const status = traceStatusLabel(span.status);
      const statusClass = span.status === "error"
        ? "trace-span-error"
        : span.status === "cancelled"
        ? "trace-span-cancelled"
        : "trace-span-ok";
      return `<div class="runtime-trace-span ${statusClass}" title="Span ${
        escapeHtml(String(span.spanId || ""))
      }">
        <span class="trace-span-index">${index + 1}</span>
        <span class="trace-span-kind">${escapeHtml(traceKindLabel(span.kind))}</span>
        <span class="trace-span-name">${escapeHtml(String(span.name || "未命名 Span"))}</span>
        <span class="trace-span-parent">父级 ${escapeHtml(shortTraceId(span.parentSpanId))}</span>
        <span class="trace-span-offset">${offset}</span>
        <span class="trace-span-duration">${formatTraceDuration(span.durationMs)}</span>
        <span class="trace-span-status">${status}</span>
      </div>`;
    }).join("")
    : `<div class="runtime-trace-empty">没有可展示的 Span 明细</div>`;
}
function renderTraceSummary(summary) {
  const target = $("#runtime-trace");
  if (!target) return;
  if (!summary || typeof summary !== "object") {
    target.textContent = "—";
    target.title = "";
    target.classList.remove("trace-error", "trace-cancelled");
    if (runtimeTraceSpans) runtimeTraceSpans.replaceChildren();
    renderTaskState(null);
    renderWorkerState(null);
    renderHandoffState(null);
    setRuntimeDetailTab(null);
    return;
  }
  const traceId = String(summary.traceId || "");
  const shortId = traceId ? traceId.slice(-8) : "未知";
  const status = summary.status === "ok"
    ? "完成"
    : summary.status === "cancelled"
    ? "已取消"
    : "失败";
  target.textContent = `${shortId} · ${formatTraceDuration(summary.durationMs)} · ${
    formatBudgetNumber(summary.spanCount)
  } spans · ${formatBudgetNumber(summary.errorSpans)} 错误`;
  target.title = `Trace ${traceId || "未知"} · ${status} · Provider ${
    formatBudgetNumber(summary.providerCalls)
  } · 工具 ${formatBudgetNumber(summary.toolCalls)}`;
  target.classList.toggle("trace-error", summary.status === "error");
  target.classList.toggle("trace-cancelled", summary.status === "cancelled");
  renderTraceDetails(summary);
}
function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
function setRunStep(step) {
  runStep = Math.max(0, Math.min(4, step));
  composerStep.textContent = `第${runStep}/4步`;
  composerStep.classList.toggle("active", runStep > 0 && runStep < 4);
  composerStep.classList.toggle("done", runStep === 4);
}
function formatGitChangeSummary(stats = {}) {
  const files = Number(stats.changedFiles || 0);
  const additions = Number(stats.additions || 0);
  const deletions = Number(stats.deletions || 0);
  if (!files) return "工作区干净";
  return `${files}个文件已更改 +${additions} -${deletions}`;
}
function updateComposerChangeSummary(stats = {}) {
  composerChangeSummary.textContent = formatGitChangeSummary(stats);
  composerChangeSummary.classList.toggle("dirty", Number(stats.changedFiles || 0) > 0);
}
async function loadComposerGitSummary() {
  if (!settings.workspace) {
    composerChangeSummary.textContent = "未选择工作区";
    composerChangeSummary.classList.remove("dirty");
    return;
  }
  try {
    const response = await fetch(`${API}/workspace/git`), data = await response.json();
    if (!response.ok || !data.isRepo) throw new Error(data.error || "当前工作区不是 Git 仓库");
    updateComposerChangeSummary(data.stats);
  } catch {
    composerChangeSummary.textContent = "Git 状态不可用";
    composerChangeSummary.classList.remove("dirty");
  }
}
function estimatedSessionTokens() {
  const sessionMessages = activeSession()?.messages || [];
  return Math.ceil(sessionMessages.reduce((sum, item) => sum + item.content.length, 0) / 4);
}
function sessionTurnCount() {
  return (activeSession()?.messages || []).filter((item) => item.role === "user").length;
}
function cacheRate(data) {
  const cacheTotal = (data.cacheHitTokens || 0) + (data.cacheMissTokens || 0);
  return cacheTotal ? Math.round((data.cacheHitTokens || 0) / cacheTotal * 100) : 0;
}
function setWorkspaceTab(tab, { refresh = true } = {}) {
  activeWorkspaceTab = ["overview", "files", "changes"].includes(tab) ? tab : "overview";
  localStorage.setItem("ai-agent:workspace-tab", activeWorkspaceTab);
  document.querySelectorAll("[data-workspace-tab]").forEach((button) =>
    button.classList.toggle("active", button.dataset.workspaceTab === activeWorkspaceTab)
  );
  document.querySelectorAll("[data-workspace-panel]").forEach((panel) =>
    panel.classList.toggle("active", panel.dataset.workspacePanel === activeWorkspaceTab)
  );
  if (refresh && document.body.classList.contains("workspace-panel-open")) refreshWorkspacePanel();
}
function refreshWorkspacePanel() {
  if (activeWorkspaceTab === "files") return loadWorkspaceFiles();
  if (activeWorkspaceTab === "changes") return loadWorkspaceGit();
  return loadWorkspaceOverview();
}
function renderWorkspaceOverview(telemetry = {}) {
  workspacePanelRoot.textContent = settings.workspace?.split("/").pop() || "未选择项目";
  workspacePanelRoot.title = settings.workspace || "";
  const used = estimatedSessionTokens();
  const contextPercent = Math.min(100, Math.round(used / CONTEXT_TOKEN_LIMIT * 100));
  const compactAt = Math.round(CONTEXT_TOKEN_LIMIT * CONTEXT_COMPACT_AT);
  const remaining = Math.max(0, compactAt - used);
  const hitRate = cacheRate(telemetry);
  $("#overview-context-state").textContent = contextPercent < 80 ? "上下文充足" : "接近压缩";
  $("#overview-context-used").textContent = `${formatNumber(used)}/${
    formatNumber(CONTEXT_TOKEN_LIMIT)
  }`;
  $("#overview-context-remaining").textContent = formatNumber(remaining);
  $("#overview-context-meter").style.width = `${contextPercent}%`;
  $("#overview-avg-hit").textContent = hitRate ? `${hitRate}%` : "—";
  $("#overview-requests").textContent = formatNumber(telemetry.calls || 0);
  $("#overview-session-tokens").textContent = formatNumber(telemetry.totalTokens || 0);
  $("#overview-turns").textContent = `${sessionTurnCount()}轮`;
  $("#overview-last-tokens").textContent = formatNumber(telemetry.lastTotalTokens || 0);
  $("#overview-runtime").textContent = formatDuration(Date.now() - APP_STARTED_AT);
  $("#overview-model").textContent = selectedModelLabel(modelSelect);
  $("#overview-cache-meter").style.width = `${hitRate}%`;
  $("#overview-cache-hit").textContent = formatNumber(telemetry.cacheHitTokens || 0);
  $("#overview-cache-miss").textContent = formatNumber(telemetry.cacheMissTokens || 0);
}
async function loadWorkspaceOverview() {
  try {
    renderWorkspaceOverview(await (await fetch(`${API}/telemetry`)).json());
  } catch {
    renderWorkspaceOverview({});
  }
}
function setNavCollapsed(collapsed) {
  document.body.classList.toggle("nav-collapsed", collapsed);
  navToggle.textContent = "导航";
  navToggle.classList.toggle("active", !collapsed);
  navToggle.title = collapsed ? "展开左侧导航" : "收起左侧导航";
  localStorage.setItem("ai-agent:nav-collapsed", String(collapsed));
}
function setWorkspacePanelOpen(open, { load = true } = {}) {
  document.body.classList.toggle("workspace-panel-open", open);
  workspacePanelToggle.classList.toggle("active", open);
  workspacePanelToggle.textContent = "工作区";
  workspacePanelToggle.title = open ? "收起右侧工作区" : "展开右侧工作区";
  localStorage.setItem("ai-agent:workspace-panel-open", String(open));
  if (open && load) refreshWorkspacePanel();
}
async function updateRuntimeStatus() {
  const estimatedTokens = estimatedSessionTokens();
  $("#runtime-model").textContent = selectedModelLabel(modelSelect);
  $("#runtime-workspace").textContent = settings.workspace || "未选择项目";
  $("#runtime-workspace").title = settings.workspace || "";
  $("#runtime-turns").textContent = `${sessionTurnCount()}轮`;
  $("#runtime-context").textContent = `${
    Math.min(100, Math.round(estimatedTokens / CONTEXT_TOKEN_LIMIT * 100))
  }%`;
  try {
    const data = await (await fetch(`${API}/telemetry`)).json();
    $("#runtime-session-tokens").textContent = data.totalTokens?.toLocaleString() || "—";
    $("#runtime-last-tokens").textContent = data.lastTotalTokens?.toLocaleString() || "—";
    $("#runtime-last-cost").textContent = formatCost(data.lastCost, data.costCurrency);
    $("#runtime-session-cost").textContent = formatCost(data.totalCost, data.costCurrency);
    const lastTotal = data.lastTotalTokens || 0;
    $("#runtime-hit").textContent = lastTotal
      ? `${Math.round((data.lastCacheHitTokens || 0) / lastTotal * 100)}%`
      : "—";
    const cacheTotal = (data.cacheHitTokens || 0) + (data.cacheMissTokens || 0);
    $("#runtime-avg-hit").textContent = cacheTotal
      ? `${Math.round(data.cacheHitTokens / cacheTotal * 100)}%`
      : "—";
    if (document.body.classList.contains("workspace-panel-open")) renderWorkspaceOverview(data);
  } catch { /* keep the last telemetry values */ }
  void updateRuntimeBalance();
}
async function updateRuntimeBalance(force = false) {
  const providerId = selectedModel(modelSelect).providerId || "";
  const now = Date.now();
  if (!force && providerId === lastBalanceProviderId && now - lastBalanceAt < 60_000) return;
  lastBalanceProviderId = providerId;
  lastBalanceAt = now;
  try {
    const response = await fetch(`${API}/balance?providerId=${encodeURIComponent(providerId)}`);
    if (!response.ok) throw new Error("balance unavailable");
    const data = await response.json();
    $("#runtime-balance").textContent = data.supported ? formatBalance(data) : "—";
  } catch {
    $("#runtime-balance").textContent = "—";
  }
}
async function saveSessions() {
  localStorage.setItem(storageKey(), JSON.stringify(sessions));
  try {
    const response = await fetch(`${API}/conversations`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessions }),
    });
    if (!response.ok) {
      const data = await response.json();
      status.textContent = `聊天记录保存失败：${data.error || "未知错误"}`;
    }
  } catch (error) {
    status.textContent = `聊天记录将在本地暂存：${error.message}`;
  }
}

function createSession() {
  const session = { id: crypto.randomUUID(), title: "新对话", messages: [], createdAt: Date.now() };
  sessions.unshift(session);
  activeSessionId = session.id;
  saveSessions();
  renderSessions();
  renderMessages({ forceScroll: true });
}

async function loadSessions(preserveActive = false) {
  const previousActive = activeSessionId;
  let localSessions = [];
  try {
    localSessions = JSON.parse(localStorage.getItem(storageKey()) || "[]");
  } catch {
    localSessions = [];
  }
  try {
    const response = await fetch(`${API}/conversations`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取聊天记录失败");
    sessions = data.sessions || [];
    if (!sessions.length && localSessions.length) {
      sessions = localSessions;
      await saveSessions();
    }
  } catch (error) {
    sessions = localSessions;
    status.textContent = `使用本地聊天记录：${error.message}`;
  }
  if (!sessions.length) createSession();
  else {
    activeSessionId = preserveActive && sessions.some((item) => item.id === previousActive)
      ? previousActive
      : sessions[0].id;
    renderSessions();
    renderMessages({ forceScroll: !preserveActive });
  }
}

function renderSessions() {
  renderWorkspaceTree();
}

function renderWorkspaceTree() {
  $("#workspace-tree").innerHTML = (settings.workspaces || []).map((workspace) => {
    const active = workspace === settings.workspace;
    const children = active
      ? sessions.map((session) =>
        `<div class="conversation-item ${
          session.id === activeSessionId ? "active" : ""
        }" data-id="${session.id}"><button class="conversation-open" title="${
          escapeHtml(session.title)
        }">${
          escapeHtml(session.title)
        }</button><button class="conversation-delete" title="删除对话">×</button></div>`
      ).join("")
      : "";
    return `<div class="workspace-node ${active ? "active" : ""}" data-path="${
      escapeHtml(workspace)
    }"><div class="workspace-row"><button class="workspace-open" title="${
      escapeHtml(workspace)
    }">▾ ${
      escapeHtml(workspace.split("/").pop())
    }</button><button class="workspace-remove" title="从列表删除目录">×</button></div><div class="workspace-children">${children}</div></div>`;
  }).join("");
}

function renderFileNode(node, depth = 0) {
  const children = Array.isArray(node.children) && node.children.length
    ? `<ul>${node.children.map((child) => renderFileNode(child, depth + 1)).join("")}</ul>`
    : "";
  const collapsed = node.type === "directory" && depth > 0 ? " collapsed" : "";
  const icon = node.type === "directory" ? "▾" : node.type === "symlink" ? "↪" : "·";
  return `<li class="file-node ${escapeHtml(node.type)}${collapsed}" data-path="${
    escapeHtml(node.path)
  }"><button class="file-node-button" data-type="${escapeHtml(node.type)}" data-path="${
    escapeHtml(node.path)
  }" title="${
    escapeHtml(node.path)
  }"><span class="file-node-icon">${icon}</span><span class="file-node-name">${
    escapeHtml(node.name)
  }</span></button>${children}</li>`;
}

function renderWorkspaceFiles(data) {
  workspacePanelRoot.textContent = data.rootName || settings.workspace?.split("/").pop() ||
    "当前项目";
  workspacePanelRoot.title = data.workspace || settings.workspace || "";
  workspaceFiles.innerHTML = data.entries?.length
    ? data.entries.map((node) => renderFileNode(node)).join("")
    : `<li class="workspace-empty">当前项目没有可显示文件</li>`;
  workspaceFilesStatus.textContent = data.truncated
    ? `文件较多，已显示前 ${data.limit} 项；已忽略 .git、node_modules、dist 等目录`
    : "点击目录可折叠/展开，点击文件会用系统默认应用打开";
}

async function loadWorkspaceFiles() {
  if (!document.body.classList.contains("workspace-panel-open")) return;
  workspacePanelRoot.textContent = settings.workspace?.split("/").pop() || "未选择项目";
  workspacePanelRoot.title = settings.workspace || "";
  if (!settings.workspace) {
    workspaceFiles.innerHTML = "";
    workspaceFilesStatus.textContent = "请先点击左侧“新目录”选择工作目录";
    return;
  }
  workspaceFilesStatus.textContent = "正在读取文件树…";
  try {
    const response = await fetch(`${API}/workspace/tree`), data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取文件树");
    renderWorkspaceFiles(data);
  } catch (error) {
    workspaceFiles.innerHTML = "";
    workspaceFilesStatus.textContent = error.message || "无法读取文件树";
  }
}

function gitKindLabel(kind) {
  return {
    added: "新增",
    modified: "修改",
    deleted: "删除",
    renamed: "重命名",
    untracked: "未跟踪",
    changed: "变更",
  }[kind] || "变更";
}

function renderWorkspaceGit(data) {
  workspacePanelRoot.textContent = settings.workspace?.split("/").pop() || "当前项目";
  workspacePanelRoot.title = settings.workspace || "";
  if (!data.isRepo) {
    workspaceGitStatus.textContent = "当前工作区不是 Git 仓库";
    workspaceGitSummary.innerHTML = `<div class="workspace-empty">没有可显示的 Git 信息</div>`;
    updateComposerChangeSummary({});
    return;
  }
  updateComposerChangeSummary(data.stats);
  workspaceGitStatus.textContent = data.changes.length
    ? `${data.branch || "detached"} · ${formatGitChangeSummary(data.stats)}`
    : `${data.branch || "detached"} · 工作区干净`;
  workspaceGitSummary.innerHTML = `
    <div class="git-head-card">
      <div><span>分支</span><b>${escapeHtml(data.branch || "detached")}</b></div>
      <div><span>HEAD</span><b>${escapeHtml(data.shortHead || "—")}</b></div>
      <div><span>状态</span><b>${
    escapeHtml(data.aheadBehind || (data.changes.length ? "有改动" : "干净"))
  }</b></div>
    </div>
    <div class="workspace-card">
      <div class="workspace-card-title"><strong>未提交改动</strong><span>${data.changes.length}</span></div>
      <div class="git-change-list">${
    data.changes.length
      ? data.changes.map((item) =>
        `<button class="git-change-item ${escapeHtml(item.kind)}" data-path="${
          escapeHtml(item.path)
        }"><span>${escapeHtml(gitKindLabel(item.kind))}</span><b>${
          escapeHtml(item.displayPath)
        }</b><code>${escapeHtml(item.code)}</code></button>`
      ).join("")
      : `<div class="workspace-empty">没有未提交改动</div>`
  }</div>
    </div>
    <div class="workspace-card">
      <div class="workspace-card-title"><strong>最近提交</strong><span>${data.commits.length}</span></div>
      <div class="git-commit-list">${
    data.commits.length
      ? data.commits.map((commit) =>
        `<div class="git-commit-item"><code>${escapeHtml(commit.hash)}</code><b>${
          escapeHtml(commit.subject)
        }</b><span>${escapeHtml(commit.relativeDate)} · ${escapeHtml(commit.author)}</span></div>`
      ).join("")
      : `<div class="workspace-empty">当前仓库还没有提交记录</div>`
  }</div>
    </div>`;
}

async function loadWorkspaceGit() {
  if (!document.body.classList.contains("workspace-panel-open")) return;
  workspacePanelRoot.textContent = settings.workspace?.split("/").pop() || "未选择项目";
  workspacePanelRoot.title = settings.workspace || "";
  if (!settings.workspace) {
    workspaceGitSummary.innerHTML = "";
    workspaceGitStatus.textContent = "请先点击左侧“新目录”选择工作目录";
    return;
  }
  workspaceGitStatus.textContent = "正在读取 Git 信息…";
  try {
    const response = await fetch(`${API}/workspace/git`), data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取 Git 信息");
    renderWorkspaceGit(data);
  } catch (error) {
    workspaceGitSummary.innerHTML = "";
    workspaceGitStatus.textContent = error.message || "无法读取 Git 信息";
  }
}

function renderUpdateSettings(data) {
  const update = data.update || {};
  $("#update-check-on-startup").checked = Boolean(update.checkOnStartup);
  $("#update-url").value = update.updateUrl || "";
  $("#update-current-version").textContent = data.version || "—";
  $("#update-latest-version").textContent = update.latestVersion || "—";
  $("#update-last-check").textContent = formatDateTime(update.lastCheckAt);
  $("#update-settings-path").textContent = data.settingsPath || settings.settingsPath || "—";
  $("#update-settings-path").title = data.settingsPath || settings.settingsPath || "";
  setInstallUpdateAvailability(lastUpdateCheck);
}

async function loadUpdateSettings() {
  const response = await fetch(`${API}/update/settings`), data = await response.json();
  if (!response.ok) throw new Error(data.error || "无法读取更新设置");
  renderUpdateSettings(data);
  return data;
}

async function saveUpdateSettingsFromForm({ quiet = false } = {}) {
  const response = await fetch(`${API}/update/settings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      checkOnStartup: $("#update-check-on-startup").checked,
      updateUrl: $("#update-url").value.trim(),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "无法保存更新设置");
  settings.update = data.update;
  settings.settingsPath = data.settingsPath;
  renderUpdateSettings(data);
  if (!quiet) $("#update-status").textContent = "✓ 更新设置已保存";
  return data;
}

function setInstallUpdateAvailability(data) {
  const button = $("#install-update");
  if (!button) return;
  const canInstall = Boolean(data?.updateAvailable && data?.downloadUrl);
  button.disabled = !canInstall;
  button.title = canInstall
    ? "下载更新包，退出当前 App，替换后自动重新打开"
    : "先检查更新；GitHub Release 需要包含 macOS arm64 .zip 资产";
}

function renderUpdateCheckResult(data, { silent = false } = {}) {
  lastUpdateCheck = data;
  setInstallUpdateAvailability(data);
  $("#update-current-version").textContent = data.currentVersion || "—";
  $("#update-latest-version").textContent = data.latestVersion || "—";
  $("#update-last-check").textContent = formatDateTime(data.checkedAt);
  if (silent && !data.updateAvailable) return;
  let message = data.releaseUrl
    ? `${escapeHtml(data.message)} · <a href="${
      escapeHtml(data.releaseUrl)
    }" target="_blank" rel="noreferrer">查看发布页</a>`
    : escapeHtml(data.message);
  if (data.updateAvailable && !data.downloadUrl) {
    message += " · 未找到可自动安装的 .zip 资产";
  }
  $("#update-status").innerHTML = message;
}

async function checkForUpdates({ silent = false } = {}) {
  if (!silent) {
    $("#update-status").textContent = "正在检查更新…";
    await saveUpdateSettingsFromForm({ quiet: true });
  }
  const response = await fetch(`${API}/update/check`, { method: "POST" }),
    data = await response.json();
  if (!response.ok) throw new Error(data.error || "检查更新失败");
  renderUpdateCheckResult(data, { silent });
  await loadUpdateSettings();
  return data;
}

async function installUpdate() {
  const button = $("#install-update");
  button.disabled = true;
  $("#update-status").textContent = "正在下载更新包，完成后会退出并重新打开…";
  const response = await fetch(`${API}/update/install`, { method: "POST" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "安装更新失败");
  $("#update-status").textContent = data.message || "更新已准备完成，应用即将重启…";
  return data;
}

function maybeCheckUpdateOnStartup() {
  const update = settings.update || {};
  if (startupUpdateCheckDone || !update.checkOnStartup || !update.updateUrl) return;
  startupUpdateCheckDone = true;
  checkForUpdates({ silent: true }).catch(() => {
    // Startup checks should never block normal app use.
  });
}

function renderMessages({ forceScroll = false } = {}) {
  const session = activeSession();
  const shouldFollowBottom = forceScroll || isMessagesNearBottom();
  const previousScrollTop = messages.scrollTop;
  $("#conversation-title").textContent = session?.title || "新的任务";
  messages.innerHTML = session?.messages.length
    ? ""
    : `<div class="welcome"><div class="orb">✦</div><h2>今天想一起构建什么？</h2><p>我可以读取代码、执行命令并完成工作区任务。</p><div class="suggestions"><button>解释这个项目的架构</button><button>检查当前代码并提出改进</button><button>创建一个新功能</button></div></div>`;
  session?.messages.forEach((message) =>
    addMessage(message.role === "assistant" ? "agent" : "user", message.content, false)
  );
  bindSuggestions();
  if (shouldFollowBottom) scrollMessagesToBottom();
  else messages.scrollTop = previousScrollTop;
  updateRuntimeStatus();
}

function addMessage(kind, text, scroll = true) {
  $(".welcome")?.remove();
  const item = document.createElement("div");
  item.className = `message ${kind}`;
  if (kind === "agent") item.innerHTML = renderMarkdown(text);
  else item.textContent = text;
  messages.append(item);
  if (scroll) scrollMessagesToBottom();
}

async function loadSettings() {
  const previousWorkspace = settings.workspace;
  settings = await (await fetch(`${API}/settings`)).json();
  renderUpdateSettings({
    version: "—",
    settingsPath: settings.settingsPath,
    update: settings.update || {},
  });
  await loadComposerGitSummary();
  if (document.body.classList.contains("workspace-panel-open")) await refreshWorkspacePanel();
  activeProviderId = settings.defaultProviderId;
  fillModels(modelSelect, { providerId: settings.defaultProviderId, model: settings.defaultModel });
  renderProviderEditor();
  $("#developer-mode").checked = localStorage.getItem("ai-agent:developer-mode") === "true";
  if (previousWorkspace !== settings.workspace) await loadSessions();
  else renderWorkspaceTree();
  maybeCheckUpdateOnStartup();
}

async function connect(retries = 30) {
  try {
    if (!(await fetch(`${API}/health`)).ok) throw new Error();
    status.textContent = "Agent Runtime 已连接 · Bounded Runtime";
    await loadSettings();
  } catch {
    if (retries) setTimeout(() => connect(retries - 1), 300);
    else status.textContent = "Agent Runtime 连接失败";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = input.value.trim(), session = activeSession();
  if (!prompt || !session) return;
  const history = session.messages.slice();
  session.messages.push({ role: "user", content: prompt });
  if (session.title === "新对话") session.title = prompt.slice(0, 24);
  await saveSessions();
  renderSessions();
  addMessage("user", prompt);
  input.value = "";
  generationController = new AbortController();
  send.textContent = "■";
  send.title = "停止生成";
  status.textContent = "Agent 正在思考和行动…";
  runToolCount = 0;
  lastBudgetUsage = null;
  eventsContent.replaceChildren();
  renderTraceSummary(null);
  $("#runtime-trace").textContent = "运行中…";
  $("#runtime-budget-iterations").textContent = "运行中…";
  $("#runtime-budget-tools").textContent = "—";
  $("#runtime-budget-output").textContent = "—";
  $("#runtime-budget-cost").textContent = "—";
  setRunStep(1);
  try {
    const thinking = document.createElement("div");
    thinking.className = "thinking-card";
    thinking.textContent = "正在分析任务…";
    messages.append(thinking);
    scrollMessagesToBottom();
    const chosenModel = selectedModel(modelSelect);
    const response = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        providerId: chosenModel.providerId,
        model: chosenModel.model,
        permissionMode: permissionMode.value,
        developerMode: $("#developer-mode").checked,
        history,
      }),
      signal: generationController.signal,
    });
    if (!response.ok || !response.body) throw new Error("无法建立执行流");
    let buffer = "", answer = "";
    const decoder = new TextDecoder(), reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line) continue;
        const data = JSON.parse(line);
        if (data.type === "status") {
          thinking.textContent = data.message;
          status.textContent = data.message;
        }
        if (data.type === "budget") {
          renderBudgetUsage(data.usage);
          thinking.textContent = `本次预算：${formatBudgetUsage(data.usage, true)}`;
        }
        if (data.type === "trace") {
          renderTraceSummary(data.summary);
          thinking.textContent = `追踪完成：${$("#runtime-trace").textContent}`;
        }
        if (data.type === "task") {
          renderTaskState(data.task);
          thinking.textContent = `任务状态：${$("#runtime-task-status").textContent}`;
        }
        if (data.type === "worker") {
          renderWorkerState(data.worker);
          thinking.textContent = `Worker：${$("#runtime-worker-status").textContent}`;
        }
        if (data.type === "handoff") {
          renderHandoffState(data.handoff);
          thinking.textContent = `A2A 交接：${$("#runtime-handoff-status").textContent}`;
        }
        if (data.type === "tool") {
          runToolCount++;
          setRunStep(Math.min(3, 1 + runToolCount));
          thinking.textContent = `正在执行 ${data.event.name}…`;
          eventsContent.insertAdjacentHTML("beforeend", renderToolEvent(data.event));
        }
        if (data.type === "hook") {
          eventsContent.insertAdjacentHTML(
            "beforeend",
            `<div class="event hook-event"><b>Hook · ${
              escapeHtml(data.event.name)
            }</b><span class="hook-detail">${escapeHtml(data.event.detail)}</span></div>`,
          );
        }
        if (data.type === "answer") {
          answer = data.answer || "任务已完成";
          setRunStep(4);
        }
        if (data.type === "error") throw new Error(data.error);
      }
    }
    if (!answer) answer = "任务已完成";
    setRunStep(4);
    thinking.remove();
    const item = document.createElement("div");
    item.className = "message agent stream-cursor";
    messages.append(item);
    for (let i = 0; i < answer.length; i += 3) {
      const shouldFollowBottom = isMessagesNearBottom();
      item.textContent += answer.slice(i, i + 3);
      if (shouldFollowBottom) scrollMessagesToBottom();
      await new Promise((resolve) => setTimeout(resolve, 7));
    }
    item.classList.remove("stream-cursor");
    item.innerHTML = renderMarkdown(answer);
    appendBudgetResult();
    session.messages.push({ role: "assistant", content: answer });
    await saveSessions();
    await loadComposerGitSummary();
    if (document.body.classList.contains("workspace-panel-open")) await refreshWorkspacePanel();
    status.textContent = "Agent Runtime 已连接 · Bounded Runtime";
  } catch (error) {
    setRunStep(4);
    const stopped = error.name === "AbortError";
    const text = stopped
      ? "已停止生成"
      : `执行失败\n\n阶段：流式响应或 Agent 执行\n原因：${
        error.message || String(error)
      }\n\n建议：检查网络、API Key 和模型配置后重试；如果错误持续出现，请打开工具面板查看最后一个操作。`;
    session.messages.push({ role: "assistant", content: text });
    await saveSessions();
    await loadComposerGitSummary();
    addMessage("agent", text);
    appendBudgetResult();
    status.textContent = stopped ? "生成已停止" : "请求失败 · 可重试";
  } finally {
    generationController = null;
    send.textContent = "↑";
    send.title = "发送";
    input.focus();
  }
});

send.addEventListener("click", (event) => {
  if (!generationController) return;
  event.preventDefault();
  generationController.abort();
});

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!generationController && input.value.trim()) form.requestSubmit();
});

function updatePermissionMode() {
  const hints = {
    ask: "危险操作会请求确认",
    auto: "自动批准操作，系统级危险命令仍拦截",
    full: "警告：所有工具操作均直接执行",
  };
  permissionHint.textContent = hints[permissionMode.value];
  document.body.classList.toggle("permission-full", permissionMode.value === "full");
  localStorage.setItem("ai-agent:permission-mode", permissionMode.value);
}
permissionMode.value = localStorage.getItem("ai-agent:permission-mode") || "ask";
permissionMode.addEventListener("change", updatePermissionMode);
updatePermissionMode();

async function openWorkspacePath(path) {
  const response = await fetch(`${API}/file/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error((await response.json()).error || "无法打开文件");
}

navToggle.addEventListener(
  "click",
  () => setNavCollapsed(!document.body.classList.contains("nav-collapsed")),
);
workspacePanelToggle.addEventListener(
  "click",
  () => setWorkspacePanelOpen(!document.body.classList.contains("workspace-panel-open")),
);
$("#close-workspace-panel").addEventListener("click", () => setWorkspacePanelOpen(false));
$("#refresh-workspace-tree").addEventListener("click", () => refreshWorkspacePanel());
document.querySelectorAll("[data-workspace-tab]").forEach((button) =>
  button.addEventListener("click", () => setWorkspaceTab(button.dataset.workspaceTab))
);
workspaceFiles.addEventListener("click", async (event) => {
  const button = event.target.closest(".file-node-button");
  if (!button) return;
  const node = button.closest(".file-node");
  if (button.dataset.type === "directory") {
    node?.classList.toggle("collapsed");
    return;
  }
  workspaceFilesStatus.textContent = `正在打开 ${button.dataset.path}…`;
  try {
    await openWorkspacePath(button.dataset.path);
    workspaceFilesStatus.textContent = `已打开 ${button.dataset.path}`;
  } catch (error) {
    workspaceFilesStatus.textContent = error.message || "无法打开文件";
  }
});
workspaceGitSummary.addEventListener("click", async (event) => {
  const button = event.target.closest(".git-change-item");
  if (!button || button.classList.contains("deleted")) return;
  workspaceGitStatus.textContent = `正在打开 ${button.dataset.path}…`;
  try {
    await openWorkspacePath(button.dataset.path);
    workspaceGitStatus.textContent = `已打开 ${button.dataset.path}`;
  } catch (error) {
    workspaceGitStatus.textContent = error.message || "无法打开文件";
  }
});
eventsContent.addEventListener("click", async (event) => {
  const link = event.target.closest(".file-link");
  if (!link) return;
  try {
    await openWorkspacePath(link.dataset.path);
  } catch (error) {
    status.textContent = error.message || "无法打开文件";
  }
});

$("#new-chat").addEventListener("click", createSession);
$("#workspace-tree").addEventListener("click", async (event) => {
  const workspaceNode = event.target.closest(".workspace-node");
  if (!workspaceNode) return;
  const workspace = workspaceNode.dataset.path;
  if (event.target.closest(".workspace-remove")) {
    if (
      !confirm(
        `确定从列表中删除目录“${workspace.split("/").pop()}”吗？\n\n磁盘中的文件不会被删除。`,
      )
    ) return;
    const response = await fetch(`${API}/workspace/remove`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    const data = await response.json();
    if (!response.ok) return status.textContent = data.error;
    await loadSettings();
    status.textContent = "目录已从列表移除";
    return;
  }
  if (event.target.closest(".workspace-open") && workspace !== settings.workspace) {
    const response = await fetch(`${API}/workspace/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    const data = await response.json();
    if (!response.ok) return status.textContent = data.error;
    await loadSettings();
    status.textContent = `工作目录：${workspace}`;
    return;
  }
  const item = event.target.closest(".conversation-item");
  if (!item) return;
  if (event.target.closest(".conversation-delete")) {
    if (!confirm("确定删除这个对话吗？")) return;
    sessions = sessions.filter((s) => s.id !== item.dataset.id);
    if (!sessions.length) return createSession();
    if (activeSessionId === item.dataset.id) activeSessionId = sessions[0].id;
    saveSessions();
    renderSessions();
    renderMessages({ forceScroll: true });
    return;
  }
  activeSessionId = item.dataset.id;
  renderSessions();
  renderMessages({ forceScroll: true });
});
function bindSuggestions() {
  document.querySelectorAll(".suggestions button").forEach((button) =>
    button.addEventListener("click", () => {
      input.value = button.textContent;
      input.focus();
    })
  );
}
async function chooseWorkspace() {
  status.textContent = "请选择工作目录…";
  try {
    const response = await fetch(`${API}/workspace/select`, { method: "POST" }),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    await loadSettings();
    status.textContent = `工作目录：${data.workspace}`;
  } catch (error) {
    status.textContent = error.message || "已取消选择目录";
  }
}
$("#new-workspace").addEventListener("click", chooseWorkspace);
function renderCronSchedules() {
  const list = $("#cron-list");
  list.innerHTML = cronSchedules.length
    ? cronSchedules.map((schedule) =>
      `<div class="cron-manage-card ${schedule.enabled ? "enabled" : "disabled"}" data-id="${
        escapeHtml(schedule.id)
      }"><div><strong>${escapeHtml(schedule.title)}</strong><span>${
        schedule.enabled ? "已启用" : "已停用"
      }</span></div><code>${escapeHtml(schedule.prompt)}</code><small>${
        escapeHtml(schedule.workspace ? schedule.workspace.split("/").pop() : "默认全局项目")
      } · ${escapeHtml(cronFrequencyLabel(schedule))} · 超时 ${
        escapeHtml(schedule.timeoutSeconds)
      } 秒${
        schedule.nextRunAt
          ? ` · 下次 ${escapeHtml(new Date(schedule.nextRunAt).toLocaleString())}`
          : ""
      }${
        schedule.lastConversationId ? ` · 最近对话 ${escapeHtml(schedule.lastConversationId)}` : ""
      }</small><div class="cron-card-actions"><button data-action="run">立即运行</button><button data-action="toggle">${
        schedule.enabled ? "停用" : "启用"
      }</button><button data-action="delete" class="danger">删除</button></div></div>`
    ).join("")
    : `<div class="cron-empty">当前工作区还没有定时任务</div>`;
}
function cronFrequencyLabel(schedule) {
  if (schedule.frequency === "daily") return `每天 ${schedule.time}`;
  if (schedule.frequency === "weekly") {
    return `每周 ${["日", "一", "二", "三", "四", "五", "六"][schedule.weekday]} ${schedule.time}`;
  }
  if (schedule.frequency === "monthly") return `每月 ${schedule.dayOfMonth} 日 ${schedule.time}`;
  if (schedule.frequency === "yearly") {
    return `每年 ${schedule.month} 月 ${schedule.dayOfMonth} 日 ${schedule.time}`;
  }
  return `每 ${schedule.intervalSeconds} 秒`;
}
function updateCronFrequencyFields() {
  const frequency = $("#cron-frequency").value;
  $("#cron-interval-field").classList.toggle("hidden", frequency !== "interval");
  $("#cron-calendar-fields").classList.toggle("hidden", frequency === "interval");
  $("#cron-weekday-field").classList.toggle("hidden", frequency !== "weekly");
  $("#cron-day-field").classList.toggle("hidden", !["monthly", "yearly"].includes(frequency));
  $("#cron-month-field").classList.toggle("hidden", frequency !== "yearly");
}
$("#cron-frequency").addEventListener("change", updateCronFrequencyFields);
updateCronFrequencyFields();
async function loadCronSchedules() {
  const response = await fetch(`${API}/cron`), data = await response.json();
  if (!response.ok) throw new Error(data.error || "读取定时任务失败");
  cronSchedules = data.schedules || [];
  renderCronSchedules();
}
async function persistCronSchedules() {
  const response = await fetch(`${API}/cron`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schedules: cronSchedules }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "保存定时任务失败");
  cronSchedules = data.schedules || [];
  renderCronSchedules();
}
$("#cron-button").addEventListener("click", async () => {
  try {
    $("#cron-workspace").innerHTML = `<option value="global">默认全局项目</option>${
      (settings.workspaces || []).map((workspace) =>
        `<option value="${escapeHtml(workspace)}">${
          escapeHtml(workspace.split("/").pop())
        }</option>`
      ).join("")
    }`;
    fillModels($("#cron-model"), {
      providerId: settings.defaultProviderId,
      model: settings.defaultModel,
    });
    await loadCronSchedules();
    $("#cron-status").textContent = "";
    $("#cron-dialog").showModal();
  } catch (error) {
    status.textContent = error.message;
  }
});
$("#close-cron").addEventListener("click", () => $("#cron-dialog").close());
$("#cron-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = $("#cron-prompt").value.trim();
  if (!confirm(`确认创建定时AI对话任务？\n\n${prompt}`)) return;
  const title = $("#cron-title").value.trim();
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "task";
  const cronModel = selectedModel($("#cron-model"));
  cronSchedules.push({
    id: `${base}-${Date.now().toString(36)}`,
    title,
    prompt,
    workspace: $("#cron-workspace").value === "global" ? null : $("#cron-workspace").value,
    intervalSeconds: Number($("#cron-interval").value),
    frequency: $("#cron-frequency").value,
    time: $("#cron-time").value,
    weekday: Number($("#cron-weekday").value),
    dayOfMonth: Number($("#cron-day").value),
    month: Number($("#cron-month").value),
    timeoutSeconds: Number($("#cron-timeout").value),
    providerId: cronModel.providerId,
    model: cronModel.model,
    permissionMode: $("#cron-permission").value,
    enabled: $("#cron-enabled").checked,
  });
  try {
    await persistCronSchedules();
    event.target.reset();
    $("#cron-interval").value = "3600";
    $("#cron-timeout").value = "600";
    $("#cron-enabled").checked = true;
    updateCronFrequencyFields();
    $("#cron-status").textContent = "✓ 定时任务已创建";
  } catch (error) {
    cronSchedules.pop();
    $("#cron-status").textContent = `错误：${error.message}`;
  }
});
$("#cron-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button"), card = event.target.closest(".cron-manage-card");
  if (!button || !card) return;
  const schedule = cronSchedules.find((item) => item.id === card.dataset.id);
  if (!schedule) return;
  try {
    if (button.dataset.action === "run") {
      const response = await fetch(`${API}/cron/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: schedule.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "运行失败");
      $("#cron-status").textContent = `✓ 已生成项目对话 ${data.conversationId}`;
      await loadCronSchedules();
      if (!schedule.workspace || schedule.workspace === settings.workspace) {
        await loadSessions(true);
      }
      return;
    }
    if (button.dataset.action === "delete") {
      if (!confirm(`确定删除定时任务“${schedule.title}”吗？`)) return;
      cronSchedules = cronSchedules.filter((item) => item.id !== schedule.id);
    } else if (button.dataset.action === "toggle") schedule.enabled = !schedule.enabled;
    await persistCronSchedules();
  } catch (error) {
    $("#cron-status").textContent = `错误：${error.message}`;
    await loadCronSchedules();
  }
});
$("#settings-button").addEventListener("click", async () => {
  await loadSettings();
  await loadUpdateSettings();
  $("#mcp-workspace").textContent = settings.workspace || "尚未选择工作区";
  const toggle = $("#toggle-key");
  providerApiKeys = {};
  renderProviderEditor();
  $("#api-key").type = "password";
  toggle.textContent = "显示";
  $("#image-api-key").value = "";
  $("#image-api-key").type = "password";
  $("#toggle-image-key").textContent = "显示";
  $("#image-model").value = settings.imageGeneration?.model || "doubao-seedream-4-5-251128";
  $("#image-base-url").value = settings.imageGeneration?.baseUrl ||
    "https://ark.cn-beijing.volces.com/api/v3";
  $("#image-key-status").textContent = settings.imageGeneration?.hasApiKey
    ? "✓ 文生图 API Key 已配置"
    : "尚未配置文生图 API Key";
  settingsDialog.showModal();
});
const settingsTabText = {
  model: ["模型", "密钥安全保存在 macOS Keychain"],
  image: ["图片生成", "配置火山方舟 Seedream 文生图能力"],
  mcp: ["MCP与工具", "管理工作区插件与工具连接"],
  general: ["通用", "运行时、开发者模式与本地数据"],
  update: ["更新", "检查软件更新并查看版本信息"],
};
document.querySelectorAll("[data-settings-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    const tab = button.dataset.settingsTab;
    document.querySelectorAll("[data-settings-tab]").forEach((item) =>
      item.classList.toggle("active", item === button)
    );
    document.querySelectorAll("[data-settings-panel]").forEach((panel) =>
      panel.classList.toggle("active", panel.dataset.settingsPanel === tab)
    );
    $("#settings-title").textContent = settingsTabText[tab][0];
    $("#settings-subtitle").textContent = settingsTabText[tab][1];
  })
);
$("#save-update-settings").addEventListener("click", async () => {
  try {
    await saveUpdateSettingsFromForm();
  } catch (error) {
    $("#update-status").textContent = `错误：${error.message}`;
  }
});
$("#check-update").addEventListener("click", async () => {
  const button = $("#check-update");
  button.disabled = true;
  try {
    await checkForUpdates();
  } catch (error) {
    $("#update-status").textContent = `错误：${error.message}`;
  } finally {
    button.disabled = false;
  }
});
$("#install-update").addEventListener("click", async () => {
  try {
    await installUpdate();
  } catch (error) {
    $("#update-status").textContent = `错误：${error.message}`;
    setInstallUpdateAvailability(lastUpdateCheck);
  }
});
$("#toggle-key").addEventListener("click", () => {
  const key = $("#api-key"), hidden = key.type === "password";
  key.type = hidden ? "text" : "password";
  $("#toggle-key").textContent = hidden ? "隐藏" : "显示";
});
$("#toggle-image-key").addEventListener("click", () => {
  const key = $("#image-api-key"), hidden = key.type === "password";
  key.type = hidden ? "text" : "password";
  $("#toggle-image-key").textContent = hidden ? "隐藏" : "显示";
});
providerSelect.addEventListener("change", () => {
  syncActiveProviderDraft();
  activeProviderId = providerSelect.value;
  renderProviderEditor();
});
$("#add-provider").addEventListener("click", () => {
  syncActiveProviderDraft();
  const id = `custom-${Date.now().toString(36)}`;
  settings.providers = [...providerList(), {
    id,
    name: "自定义供应商",
    protocol: "openai",
    baseUrl: "https://api.example.com/v1",
    models: ["model-name"],
    defaultModel: "model-name",
    hasApiKey: false,
  }];
  providerApiKeys[id] = "";
  activeProviderId = id;
  renderProviderEditor();
});
$("#remove-provider").addEventListener("click", () => {
  const providers = providerList();
  if (providers.length <= 1) return;
  const provider = activeProvider();
  if (!confirm(`确定移除供应商“${provider.name}”吗？\n\n已保存的 Keychain 密钥不会被删除。`)) {
    return;
  }
  settings.providers = providers.filter((item) => item.id !== provider.id);
  delete providerApiKeys[provider.id];
  activeProviderId = settings.providers[0]?.id;
  renderProviderEditor();
});
modelsInput.addEventListener("input", () => {
  const models = modelsInput.value.split("\n").map((x) => x.trim()).filter(Boolean);
  fillDefaultModel({
    models,
    defaultModel: models.includes(defaultModel.value) ? defaultModel.value : models[0],
  });
});
settingsForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const button = $("#save-settings");
  button.disabled = true;
  try {
    const activeTab = document.querySelector("[data-settings-tab].active")?.dataset.settingsTab;
    if (activeTab === "update") {
      await saveUpdateSettingsFromForm();
      return;
    }
    localStorage.setItem("ai-agent:developer-mode", String($("#developer-mode").checked));
    const response = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          defaultProviderId: activeProviderId,
          providers: collectProvidersForSave(),
          imageGeneration: {
            apiKey: $("#image-api-key").value.trim(),
            model: $("#image-model").value.trim(),
          },
        }),
      }),
      data = await response.json();
    if (!response.ok) throw new Error(data.error);
    await loadSettings();
    settingsDialog.close();
  } catch (error) {
    $("#key-status").textContent = `错误：${error.message}`;
  } finally {
    button.disabled = false;
  }
});
let lessonTests = [];
function renderLessonTests(cases) {
  lessonTests = cases;
  lessonTestList.innerHTML = cases.map((test) =>
    `<div class="lesson-test-row" data-lesson="${test.lesson}"><div><b>${
      String(test.lesson).padStart(2, "0")
    } · ${escapeHtml(test.title)}</b><small>${
      escapeHtml(test.description)
    }</small><span data-test-state>未测试</span></div><button type="button" data-run-lesson="${test.lesson}">测试</button></div>`
  ).join("");
}
function renderLessonReport(report) {
  lessonTestSummary.classList.toggle("passed", report.ok);
  lessonTestSummary.classList.toggle("failed", !report.ok);
  lessonTestSummary.textContent = `${report.ok ? "✓ 验收通过" : "✗ 验收失败"} · ${report.passed}/${
    report.passed + report.failed
  } 通过`;
  for (const result of report.results) {
    const row = lessonTestList.querySelector(`[data-lesson="${result.lesson}"]`),
      state = row?.querySelector("[data-test-state]");
    if (!row || !state) continue;
    row.classList.toggle("passed", result.status === "passed");
    row.classList.toggle("failed", result.status === "failed");
    state.textContent = `${
      result.status === "passed" ? "✓ 通过" : "✗ 失败"
    } · ${result.durationMs}ms${result.detail ? ` · ${result.detail}` : ""}`;
  }
  runtimeTestOutput.textContent = [
    `${report.ok ? "✓" : "✗"} ${report.suite}: ${report.passed} passed / ${report.failed} failed`,
    ...report.results.map((result) =>
      `${
        result.status === "passed" ? "✓" : "✗"
      } ${result.id} · ${result.title} (${result.durationMs}ms)` +
      (result.detail ? "\n  " + result.detail : "")
    ),
  ].join("\n");
}
async function runLessonTest(lesson) {
  const row = lessonTestList.querySelector(`[data-lesson="${lesson}"]`),
    state = row?.querySelector("[data-test-state]");
  if (row && state) {
    row.classList.remove("passed", "failed");
    state.textContent = "⟳ 测试中…";
  }
  lessonTestSummary.classList.remove("passed", "failed");
  lessonTestSummary.textContent = `正在测试第 ${lesson} 课…`;
  runtimeTestOutput.textContent = `正在运行 21test-${String(lesson).padStart(2, "0")}…`;
  const response = await fetch(`${API}/tests/lessons`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lesson }),
  });
  const report = await response.json();
  if (!response.ok) throw new Error(report.error || "验收请求失败");
  renderLessonReport(report);
}
openLessonTestsButton.addEventListener("click", () => {
  testsDialog.showModal();
  if (!lessonTests.length) showLessonTestsButton.click();
});
$("#close-tests").addEventListener("click", () => testsDialog.close());
showLessonTestsButton.addEventListener("click", async () => {
  showLessonTestsButton.disabled = true;
  runtimeTestOutput.textContent = "正在加载课程测试用例…";
  try {
    const response = await fetch(`${API}/tests/lessons`), data = await response.json();
    if (!response.ok) throw new Error(data.error || "测试用例加载失败");
    renderLessonTests(data.cases || []);
    runAllLessonTestsButton.disabled = lessonTests.length === 0;
    lessonTestSummary.classList.remove("passed", "failed");
    lessonTestSummary.textContent =
      `已加载 ${lessonTests.length} 个用例；现在可以单独测试或一键测试全部。`;
    runtimeTestOutput.textContent =
      `已加载 ${lessonTests.length} 个测试用例；点击每行“测试”运行单课验收。`;
  } catch (error) {
    lessonTestSummary.classList.add("failed");
    lessonTestSummary.textContent = "✗ 测试用例加载失败";
    runtimeTestOutput.textContent = `✗ 测试用例加载失败：${error.message || String(error)}`;
  } finally {
    showLessonTestsButton.disabled = false;
  }
});
lessonTestList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-run-lesson]");
  if (!button) return;
  button.disabled = true;
  const lesson = Number(button.dataset.runLesson);
  try {
    await runLessonTest(lesson);
  } catch (error) {
    lessonTestSummary.classList.add("failed");
    lessonTestSummary.textContent = `✗ 第 ${lesson} 课测试失败`;
    runtimeTestOutput.textContent = `✗ 第 ${lesson} 课测试失败：${error.message || String(error)}`;
  } finally {
    button.disabled = false;
  }
});
runAllLessonTestsButton.addEventListener("click", async () => {
  runAllLessonTestsButton.disabled = true;
  lessonTestSummary.classList.remove("passed", "failed");
  lessonTestSummary.textContent = "⟳ 正在运行全部课程测试…";
  runtimeTestOutput.textContent = "正在运行全部课程测试…";
  try {
    const response = await fetch(`${API}/tests/lessons`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "验收请求失败");
    renderLessonReport(report);
  } catch (error) {
    lessonTestSummary.classList.add("failed");
    lessonTestSummary.textContent = "✗ 全部测试失败";
    runtimeTestOutput.textContent = `✗ 全部测试失败：${error.message || String(error)}`;
  } finally {
    runAllLessonTestsButton.disabled = false;
  }
});
setNavCollapsed(localStorage.getItem("ai-agent:nav-collapsed") === "true");
setWorkspaceTab(activeWorkspaceTab, { refresh: false });
setWorkspacePanelOpen(localStorage.getItem("ai-agent:workspace-panel-open") === "true", {
  load: false,
});
connect();
modelSelect.addEventListener("change", updateRuntimeStatus);
setInterval(updateRuntimeStatus, 3_000);
setInterval(() => {
  if (!generationController && settings.workspace) {
    loadSessions(true).catch(() => {});
    loadComposerGitSummary().catch(() => {});
  }
}, 10_000);
