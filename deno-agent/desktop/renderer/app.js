const API = "/api";
const $ = (selector) => document.querySelector(selector);
const messages = $("#messages"),
  events = $("#events"),
  eventsContent = $("#events-content"),
  form = $("#composer");
const input = $("#prompt"), send = $("#send"), status = $("#status");
const modelSelect = $("#model-select"), settingsDialog = $("#settings-dialog");
const permissionMode = $("#permission-mode"), permissionHint = $("#permission-hint");
const settingsForm = $("#settings-form"),
  modelsInput = $("#models"),
  defaultModel = $("#default-model");
let settings = {}, sessions = [], activeSessionId = null;
let generationController = null;
let cronSchedules = [];

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
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
async function updateRuntimeStatus() {
  const sessionMessages = activeSession()?.messages || [];
  const estimatedTokens = Math.ceil(
    sessionMessages.reduce((sum, item) => sum + item.content.length, 0) / 4,
  );
  $("#runtime-model").textContent = modelSelect.value || settings.defaultModel || "—";
  $("#runtime-workspace").textContent = settings.workspace || "未选择项目";
  $("#runtime-workspace").title = settings.workspace || "";
  $("#runtime-turns").textContent = `${
    sessionMessages.filter((item) => item.role === "user").length
  }轮`;
  $("#runtime-context").textContent = `${Math.min(100, Math.round(estimatedTokens / 1280))}%`;
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
  renderMessages();
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
    renderMessages();
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

function renderMessages() {
  const session = activeSession();
  messages.innerHTML = session?.messages.length
    ? ""
    : `<div class="welcome"><div class="orb">✦</div><h2>今天想一起构建什么？</h2><p>我可以读取代码、执行命令并完成工作区任务。</p><div class="suggestions"><button>解释这个项目的架构</button><button>检查当前代码并提出改进</button><button>创建一个新功能</button></div></div>`;
  session?.messages.forEach((message) =>
    addMessage(message.role === "assistant" ? "agent" : "user", message.content, false)
  );
  bindSuggestions();
  messages.scrollTop = messages.scrollHeight;
  updateRuntimeStatus();
}

function addMessage(kind, text, scroll = true) {
  $(".welcome")?.remove();
  const item = document.createElement("div");
  item.className = `message ${kind}`;
  item.textContent = text;
  messages.append(item);
  if (scroll) messages.scrollTop = messages.scrollHeight;
}

async function loadSettings() {
  const previousWorkspace = settings.workspace;
  settings = await (await fetch(`${API}/settings`)).json();
  fillModels(modelSelect, settings.models, settings.defaultModel);
  $("#base-url").value = settings.baseUrl;
  modelsInput.value = settings.models.join("\n");
  fillModels(defaultModel, settings.models, settings.defaultModel);
  $("#key-status").textContent = settings.hasApiKey ? "✓ 已配置 API Key" : "尚未配置 API Key";
  $("#developer-mode").checked = localStorage.getItem("deno-agent:developer-mode") === "true";
  if (previousWorkspace !== settings.workspace) await loadSessions();
  else renderWorkspaceTree();
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
  try {
    const thinking = document.createElement("div");
    thinking.className = "thinking-card";
    thinking.textContent = "正在分析任务…";
    messages.append(thinking);
    messages.scrollTop = messages.scrollHeight;
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
          thinking.textContent = `正在执行 ${data.event.name}…`;
          events.classList.remove("hidden");
          $("#toggle-events").classList.remove("hidden");
          eventsContent.insertAdjacentHTML("beforeend", renderToolEvent(data.event));
        }
        if (data.type === "hook") {
          events.classList.remove("hidden");
          $("#toggle-events").classList.remove("hidden");
          eventsContent.insertAdjacentHTML(
            "beforeend",
            `<div class="event hook-event"><b>Hook · ${
              escapeHtml(data.event.name)
            }</b><span class="hook-detail">${escapeHtml(data.event.detail)}</span></div>`,
          );
        }
        if (data.type === "answer") answer = data.answer || "任务已完成";
        if (data.type === "error") throw new Error(data.error);
      }
    }
    thinking.remove();
    const item = document.createElement("div");
    item.className = "message agent stream-cursor";
    messages.append(item);
    for (let i = 0; i < answer.length; i += 3) {
      item.textContent += answer.slice(i, i + 3);
      messages.scrollTop = messages.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, 7));
    }
    item.classList.remove("stream-cursor");
    session.messages.push({ role: "assistant", content: answer });
    await saveSessions();
    status.textContent = "Deno Runtime 已连接 · s20 Complete Harness";
  } catch (error) {
    const stopped = error.name === "AbortError";
    const text = stopped
      ? "已停止生成"
      : `执行失败\n\n阶段：流式响应或 Agent 执行\n原因：${
        error.message || String(error)
      }\n\n建议：检查网络、API Key 和模型配置后重试；如果错误持续出现，请打开工具面板查看最后一个操作。`;
    session.messages.push({ role: "assistant", content: text });
    await saveSessions();
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

$("#toggle-events").addEventListener("click", () => events.classList.toggle("hidden"));
$("#close-events").addEventListener("click", () => events.classList.add("hidden"));
eventsContent.addEventListener("click", async (event) => {
  const link = event.target.closest(".file-link");
  if (!link) return;
  const response = await fetch(`${API}/file/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: link.dataset.path }),
  });
  if (!response.ok) status.textContent = (await response.json()).error || "无法打开文件";
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
    renderMessages();
    return;
  }
  activeSessionId = item.dataset.id;
  renderSessions();
  renderMessages();
});
function bindSuggestions() {
  document.querySelectorAll(".suggestions button").forEach((button) =>
    button.addEventListener("click", () => {
      input.value = button.textContent;
      input.focus();
    })
  );
}
$("#new-workspace").addEventListener("click", async () => {
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
});
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
connect();
modelSelect.addEventListener("change", updateRuntimeStatus);
setInterval(updateRuntimeStatus, 3_000);
setInterval(() => {
  if (!generationController && settings.workspace) loadSessions(true).catch(() => {});
}, 10_000);
