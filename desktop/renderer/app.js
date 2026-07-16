const API = "/api";
const $ = (selector) => document.querySelector(selector);
const messages = $("#messages"),
  events = $("#events"),
  eventsContent = $("#events-content"),
  form = $("#composer");
const input = $("#prompt"), send = $("#send"), status = $("#status");
const modelSelect = $("#model-select"), settingsDialog = $("#settings-dialog");
const permissionMode = $("#permission-mode"), permissionHint = $("#permission-hint");
const navToggle = $("#nav-toggle"), workspacePanelToggle = $("#toggle-workspace-panel");
const workspacePanelRoot = $("#workspace-panel-root"),
  workspaceFilesStatus = $("#workspace-files-status"),
  workspaceFiles = $("#workspace-files"),
  workspaceGitStatus = $("#workspace-git-status"),
  workspaceGitSummary = $("#workspace-git-summary");
const composerStep = $("#composer-step"), composerChangeSummary = $("#composer-change-summary");
const settingsForm = $("#settings-form"),
  modelsInput = $("#models"),
  defaultModel = $("#default-model");
let settings = {}, sessions = [], activeSessionId = null;
let generationController = null;
let cronSchedules = [];
let runStep = 0, runToolCount = 0;
let startupUpdateCheckDone = false;
let lastUpdateCheck = null;
const AUTO_SCROLL_MARGIN = 96;
const APP_STARTED_AT = Date.now();
const CONTEXT_TOKEN_LIMIT = 1_000_000;
const CONTEXT_COMPACT_AT = 0.8;
let activeWorkspaceTab = localStorage.getItem("deno-agent:workspace-tab") || "overview";

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code) => {
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
  return html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => codeSpans[Number(index)] || "");
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
          (data.ok === true ? "全部检查通过" : data.ok === false ? "检查未通过" : "s20"),
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
function fillModels(select, models, selected) {
  select.innerHTML = models.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
    .join("");
  select.value = selected || models[0];
}
function storageKey() {
  return `deno-agent:sessions:${settings.workspace || "none"}`;
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
function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1_000));
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60), rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}分${rest}秒` : `${minutes}分`;
  const hours = Math.floor(minutes / 60), minuteRest = minutes % 60;
  return minuteRest ? `${hours}小时${minuteRest}分` : `${hours}小时`;
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
  localStorage.setItem("deno-agent:workspace-tab", activeWorkspaceTab);
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
  $("#overview-model").textContent = modelSelect.value || settings.defaultModel || "—";
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
  localStorage.setItem("deno-agent:nav-collapsed", String(collapsed));
}
function setWorkspacePanelOpen(open, { load = true } = {}) {
  document.body.classList.toggle("workspace-panel-open", open);
  workspacePanelToggle.classList.toggle("active", open);
  workspacePanelToggle.textContent = "工作区";
  workspacePanelToggle.title = open ? "收起右侧工作区" : "展开右侧工作区";
  localStorage.setItem("deno-agent:workspace-panel-open", String(open));
  if (open && load) refreshWorkspacePanel();
}
async function updateRuntimeStatus() {
  const estimatedTokens = estimatedSessionTokens();
  $("#runtime-model").textContent = modelSelect.value || settings.defaultModel || "—";
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
  fillModels(modelSelect, settings.models, settings.defaultModel);
  $("#base-url").value = settings.baseUrl;
  modelsInput.value = settings.models.join("\n");
  fillModels(defaultModel, settings.models, settings.defaultModel);
  $("#key-status").textContent = settings.hasApiKey ? "✓ 已配置 API Key" : "尚未配置 API Key";
  $("#developer-mode").checked = localStorage.getItem("deno-agent:developer-mode") === "true";
  if (previousWorkspace !== settings.workspace) await loadSessions();
  else renderWorkspaceTree();
  maybeCheckUpdateOnStartup();
}

async function connect(retries = 30) {
  try {
    if (!(await fetch(`${API}/health`)).ok) throw new Error();
    status.textContent = "Deno Runtime 已连接 · s20 Complete Harness";
    await loadSettings();
  } catch {
    if (retries) setTimeout(() => connect(retries - 1), 300);
    else status.textContent = "Deno Runtime 连接失败";
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
  setRunStep(1);
  try {
    const thinking = document.createElement("div");
    thinking.className = "thinking-card";
    thinking.textContent = "正在分析任务…";
    messages.append(thinking);
    scrollMessagesToBottom();
    const response = await fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        model: modelSelect.value,
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
        if (data.type === "tool") {
          runToolCount++;
          setRunStep(Math.min(3, 1 + runToolCount));
          thinking.textContent = `正在执行 ${data.event.name}…`;
          events.classList.remove("hidden");
          $("#toggle-events").classList.add("active");
          eventsContent.insertAdjacentHTML("beforeend", renderToolEvent(data.event));
        }
        if (data.type === "hook") {
          events.classList.remove("hidden");
          $("#toggle-events").classList.add("active");
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
    session.messages.push({ role: "assistant", content: answer });
    await saveSessions();
    await loadComposerGitSummary();
    if (document.body.classList.contains("workspace-panel-open")) await refreshWorkspacePanel();
    status.textContent = "Deno Runtime 已连接 · s20 Complete Harness";
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
  localStorage.setItem("deno-agent:permission-mode", permissionMode.value);
}
permissionMode.value = localStorage.getItem("deno-agent:permission-mode") || "ask";
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
$("#toggle-events").addEventListener("click", () => {
  events.classList.toggle("hidden");
  $("#toggle-events").classList.toggle("active", !events.classList.contains("hidden"));
});
$("#close-events").addEventListener("click", () => {
  events.classList.add("hidden");
  $("#toggle-events").classList.remove("active");
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
    fillModels($("#cron-model"), settings.models, settings.defaultModel);
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
    model: $("#cron-model").value,
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
  const data = await (await fetch(`${API}/settings/key`)).json(),
    key = $("#api-key"),
    toggle = $("#toggle-key");
  key.value = data.apiKey || "";
  key.type = "text";
  toggle.textContent = "隐藏";
  settingsDialog.showModal();
});
const settingsTabText = {
  model: ["模型", "密钥安全保存在 macOS Keychain"],
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
modelsInput.addEventListener("input", () => {
  const models = modelsInput.value.split("\n").map((x) => x.trim()).filter(Boolean);
  fillModels(
    defaultModel,
    models,
    models.includes(defaultModel.value) ? defaultModel.value : models[0],
  );
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
    localStorage.setItem("deno-agent:developer-mode", String($("#developer-mode").checked));
    const response = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: $("#api-key").value,
          baseUrl: $("#base-url").value,
          models: modelsInput.value.split("\n"),
          defaultModel: defaultModel.value,
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
setNavCollapsed(localStorage.getItem("deno-agent:nav-collapsed") === "true");
setWorkspaceTab(activeWorkspaceTab, { refresh: false });
setWorkspacePanelOpen(localStorage.getItem("deno-agent:workspace-panel-open") === "true", {
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
