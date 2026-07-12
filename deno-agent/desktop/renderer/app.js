const API = "/api";
const $ = (selector) => document.querySelector(selector);
const messages = $("#messages"), events = $("#events"), eventsContent = $("#events-content"), form = $("#composer");
const input = $("#prompt"), send = $("#send"), status = $("#status");
const modelSelect = $("#model-select"), settingsDialog = $("#settings-dialog");
const permissionMode = $("#permission-mode"), permissionHint = $("#permission-hint");
const settingsForm = $("#settings-form"), modelsInput = $("#models"), defaultModel = $("#default-model");
let settings = {}, sessions = [], activeSessionId = null;
let generationController = null;

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function renderToolEvent(event) {
  let input = {}; try { input = JSON.parse(event.input || "{}"); } catch { /* keep raw input */ }
  if (event.name === "todo_write" && Array.isArray(input.todos)) return `<div class="event todo-event"><b>Todo · 任务计划</b>${input.todos.map((todo) => `<div class="todo-row ${todo.status}"><span>${todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "▸" : "○"}</span>${escapeHtml(todo.content)}</div>`).join("")}</div>`;
  if (event.name === "subagent") return `<div class="event subagent-event"><b>Subagent · 隔离子任务</b><span class="subagent-task">${escapeHtml(input.task || "")}</span><span class="subagent-result">${escapeHtml(event.output || "")}</span></div>`;
  if (event.name === "list_skills") return `<div class="event skill-event"><b>Skills · 可用技能</b><span class="skill-list">${escapeHtml(event.output || "无可用技能")}</span></div>`;
  if (event.name === "load_skill") return `<div class="event skill-event"><b>Skill · ${escapeHtml(input.name || "")}</b><span class="skill-loaded">✓ 已按需加载 SKILL.md</span></div>`;
  const fileTool = ["read_file", "write_file", "edit_file"].includes(event.name) && input.path;
  if (fileTool) return `<div class="event"><b>${event.name}</b><button class="file-link" data-path="${escapeHtml(input.path)}">↗ ${escapeHtml(input.path)}</button></div>`;
  return `<div class="event"><b>${event.name}</b><br>${escapeHtml(event.input)}${event.output ? `<span class="event-output">${escapeHtml(event.output)}</span>` : ""}</div>`;
}
function fillModels(select, models, selected) { select.innerHTML = models.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join(""); select.value = selected || models[0]; }
function storageKey() { return `deno-agent:sessions:${settings.workspace || "none"}`; }
function activeSession() { return sessions.find((session) => session.id === activeSessionId); }
function saveSessions() { localStorage.setItem(storageKey(), JSON.stringify(sessions)); }

function createSession() {
  const session = { id: crypto.randomUUID(), title: "新对话", messages: [], createdAt: Date.now() };
  sessions.unshift(session); activeSessionId = session.id; saveSessions(); renderSessions(); renderMessages();
}

function loadSessions() {
  try { sessions = JSON.parse(localStorage.getItem(storageKey()) || "[]"); } catch { sessions = []; }
  if (!sessions.length) createSession(); else { activeSessionId = sessions[0].id; renderSessions(); renderMessages(); }
}

function renderSessions() {
  renderWorkspaceTree();
}

function renderWorkspaceTree() {
  $("#workspace-tree").innerHTML = (settings.workspaces || []).map((workspace) => {
    const active = workspace === settings.workspace;
    const children = active ? sessions.map((session) => `<div class="conversation-item ${session.id === activeSessionId ? "active" : ""}" data-id="${session.id}"><button class="conversation-open" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</button><button class="conversation-delete" title="删除对话">×</button></div>`).join("") : "";
    return `<div class="workspace-node ${active ? "active" : ""}" data-path="${escapeHtml(workspace)}"><div class="workspace-row"><button class="workspace-open" title="${escapeHtml(workspace)}">▾ ${escapeHtml(workspace.split("/").pop())}</button><button class="workspace-remove" title="从列表删除目录">×</button></div><div class="workspace-children">${children}</div></div>`;
  }).join("");
}

function renderMessages() {
  const session = activeSession();
  messages.innerHTML = session?.messages.length ? "" : `<div class="welcome"><div class="orb">✦</div><h2>今天想一起构建什么？</h2><p>我可以读取代码、执行命令并完成工作区任务。</p><div class="suggestions"><button>解释这个项目的架构</button><button>检查当前代码并提出改进</button><button>创建一个新功能</button></div></div>`;
  session?.messages.forEach((message) => addMessage(message.role === "assistant" ? "agent" : "user", message.content, false));
  bindSuggestions(); messages.scrollTop = messages.scrollHeight;
}

function addMessage(kind, text, scroll = true) {
  $(".welcome")?.remove(); const item = document.createElement("div");
  item.className = `message ${kind}`; item.textContent = text; messages.append(item);
  if (scroll) messages.scrollTop = messages.scrollHeight;
}

async function loadSettings() {
  const previousWorkspace = settings.workspace;
  settings = await (await fetch(`${API}/settings`)).json();
  fillModels(modelSelect, settings.models, settings.defaultModel); $("#base-url").value = settings.baseUrl;
  modelsInput.value = settings.models.join("\n"); fillModels(defaultModel, settings.models, settings.defaultModel);
  $("#key-status").textContent = settings.hasApiKey ? "✓ 已配置 API Key" : "尚未配置 API Key";
  $("#developer-mode").checked = localStorage.getItem("deno-agent:developer-mode") === "true";
  if (previousWorkspace !== settings.workspace) loadSessions(); else renderWorkspaceTree();
}

async function connect(retries = 30) {
  try { if (!(await fetch(`${API}/health`)).ok) throw new Error(); status.textContent = "Deno Runtime 已连接 · s08 Context Compact"; await loadSettings(); }
  catch { if (retries) setTimeout(() => connect(retries - 1), 300); else status.textContent = "Deno Runtime 连接失败"; }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); const prompt = input.value.trim(), session = activeSession(); if (!prompt || !session) return;
  const history = session.messages.slice(); session.messages.push({ role: "user", content: prompt });
  if (session.title === "新对话") session.title = prompt.slice(0, 24); saveSessions(); renderSessions(); addMessage("user", prompt);
  input.value = ""; generationController = new AbortController(); send.textContent = "■"; send.title = "停止生成"; status.textContent = "Agent 正在思考和行动…";
  try {
    const thinking = document.createElement("div"); thinking.className = "thinking-card"; thinking.textContent = "正在分析任务…"; messages.append(thinking); messages.scrollTop = messages.scrollHeight;
    const response = await fetch(`${API}/chat/stream`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: prompt, model: modelSelect.value, permissionMode: permissionMode.value, developerMode: $("#developer-mode").checked, history }), signal: generationController.signal });
    if (!response.ok || !response.body) throw new Error("无法建立执行流");
    let buffer = "", answer = ""; const decoder = new TextDecoder(), reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
      for (const line of lines) { if (!line) continue; const data = JSON.parse(line);
        if (data.type === "status") { thinking.textContent = data.message; status.textContent = data.message; }
        if (data.type === "tool") { thinking.textContent = `正在执行 ${data.event.name}…`; events.classList.remove("hidden"); $("#toggle-events").classList.remove("hidden"); eventsContent.insertAdjacentHTML("beforeend", renderToolEvent(data.event)); }
        if (data.type === "hook") { events.classList.remove("hidden"); $("#toggle-events").classList.remove("hidden"); eventsContent.insertAdjacentHTML("beforeend", `<div class="event hook-event"><b>Hook · ${escapeHtml(data.event.name)}</b><span class="hook-detail">${escapeHtml(data.event.detail)}</span></div>`); }
        if (data.type === "answer") answer = data.answer || "任务已完成";
        if (data.type === "error") throw new Error(data.error);
      }
    }
    thinking.remove(); const item = document.createElement("div"); item.className = "message agent stream-cursor"; messages.append(item);
    for (let i = 0; i < answer.length; i += 3) { item.textContent += answer.slice(i, i + 3); messages.scrollTop = messages.scrollHeight; await new Promise((resolve) => setTimeout(resolve, 7)); }
    item.classList.remove("stream-cursor"); session.messages.push({ role: "assistant", content: answer }); saveSessions();
    status.textContent = "Deno Runtime 已连接 · s08 Context Compact";
  } catch (error) { const stopped = error.name === "AbortError"; const text = stopped ? "已停止生成" : `执行失败\n\n阶段：流式响应或 Agent 执行\n原因：${error.message || String(error)}\n\n建议：检查网络、API Key 和模型配置后重试；如果错误持续出现，请打开工具面板查看最后一个操作。`; session.messages.push({ role: "assistant", content: text }); saveSessions(); addMessage("agent", text); status.textContent = stopped ? "生成已停止" : "请求失败 · 可重试"; }
  finally { generationController = null; send.textContent = "↑"; send.title = "发送"; input.focus(); }
});

send.addEventListener("click", (event) => {
  if (!generationController) return;
  event.preventDefault(); generationController.abort();
});

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!generationController && input.value.trim()) form.requestSubmit();
});

function updatePermissionMode() {
  const hints = { ask: "危险操作会请求确认", auto: "自动批准操作，系统级危险命令仍拦截", full: "警告：所有工具操作均直接执行" };
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
  const link = event.target.closest(".file-link"); if (!link) return;
  const response = await fetch(`${API}/file/open`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: link.dataset.path }) });
  if (!response.ok) status.textContent = (await response.json()).error || "无法打开文件";
});

$("#new-chat").addEventListener("click", createSession);
$("#workspace-tree").addEventListener("click", async (event) => {
  const workspaceNode = event.target.closest(".workspace-node"); if (!workspaceNode) return;
  const workspace = workspaceNode.dataset.path;
  if (event.target.closest(".workspace-remove")) {
    if (!confirm(`确定从列表中删除目录“${workspace.split("/").pop()}”吗？\n\n磁盘中的文件不会被删除。`)) return;
    const response = await fetch(`${API}/workspace/remove`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace }) });
    const data = await response.json(); if (!response.ok) return status.textContent = data.error;
    await loadSettings(); status.textContent = "目录已从列表移除"; return;
  }
  if (event.target.closest(".workspace-open") && workspace !== settings.workspace) {
    const response = await fetch(`${API}/workspace/activate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace }) });
    const data = await response.json(); if (!response.ok) return status.textContent = data.error;
    await loadSettings(); status.textContent = `工作目录：${workspace}`; return;
  }
  const item = event.target.closest(".conversation-item"); if (!item) return;
  if (event.target.closest(".conversation-delete")) { if (!confirm("确定删除这个对话吗？")) return; sessions = sessions.filter((s) => s.id !== item.dataset.id); if (!sessions.length) return createSession(); if (activeSessionId === item.dataset.id) activeSessionId = sessions[0].id; saveSessions(); renderSessions(); renderMessages(); return; }
  activeSessionId = item.dataset.id; renderSessions(); renderMessages();
});
function bindSuggestions() { document.querySelectorAll(".suggestions button").forEach((button) => button.addEventListener("click", () => { input.value = button.textContent; input.focus(); })); }
$("#new-workspace").addEventListener("click", async () => { status.textContent = "请选择工作目录…"; try { const response = await fetch(`${API}/workspace/select`, { method: "POST" }), data = await response.json(); if (!response.ok) throw new Error(data.error); await loadSettings(); status.textContent = `工作目录：${data.workspace}`; } catch (error) { status.textContent = error.message || "已取消选择目录"; } });
$("#settings-button").addEventListener("click", async () => { await loadSettings(); const data = await (await fetch(`${API}/settings/key`)).json(), key = $("#api-key"), toggle = $("#toggle-key"); key.value = data.apiKey || ""; key.type = "text"; toggle.textContent = "隐藏"; settingsDialog.showModal(); });
$("#toggle-key").addEventListener("click", () => { const key = $("#api-key"), hidden = key.type === "password"; key.type = hidden ? "text" : "password"; $("#toggle-key").textContent = hidden ? "隐藏" : "显示"; });
modelsInput.addEventListener("input", () => { const models = modelsInput.value.split("\n").map((x) => x.trim()).filter(Boolean); fillModels(defaultModel, models, models.includes(defaultModel.value) ? defaultModel.value : models[0]); });
settingsForm.addEventListener("submit", async (event) => { if (event.submitter?.value === "cancel") return; event.preventDefault(); const button = $("#save-settings"); button.disabled = true; try { localStorage.setItem("deno-agent:developer-mode", String($("#developer-mode").checked)); const response = await fetch(`${API}/settings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: $("#api-key").value, baseUrl: $("#base-url").value, models: modelsInput.value.split("\n"), defaultModel: defaultModel.value }) }), data = await response.json(); if (!response.ok) throw new Error(data.error); await loadSettings(); settingsDialog.close(); } catch (error) { $("#key-status").textContent = `错误：${error.message}`; } finally { button.disabled = false; } });
connect();
