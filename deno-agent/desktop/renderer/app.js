const API = "/api";
const $ = (selector) => document.querySelector(selector);
const messages = $("#messages"), events = $("#events"), form = $("#composer");
const input = $("#prompt"), send = $("#send"), status = $("#status");
const modelSelect = $("#model-select"), settingsDialog = $("#settings-dialog");
const settingsForm = $("#settings-form"), modelsInput = $("#models"), defaultModel = $("#default-model");
let settings = {}, sessions = [], activeSessionId = null;

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
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
  if (previousWorkspace !== settings.workspace) loadSessions(); else renderWorkspaceTree();
}

async function connect(retries = 30) {
  try { if (!(await fetch(`${API}/health`)).ok) throw new Error(); status.textContent = "Deno Runtime 已连接 · s01 Agent Loop"; await loadSettings(); }
  catch { if (retries) setTimeout(() => connect(retries - 1), 300); else status.textContent = "Deno Runtime 连接失败"; }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); const prompt = input.value.trim(), session = activeSession(); if (!prompt || !session) return;
  const history = session.messages.slice(); session.messages.push({ role: "user", content: prompt });
  if (session.title === "新对话") session.title = prompt.slice(0, 24); saveSessions(); renderSessions(); addMessage("user", prompt);
  input.value = ""; send.disabled = true; status.textContent = "Agent 正在思考和行动…";
  try {
    const response = await fetch(`${API}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: prompt, model: modelSelect.value, history }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed");
    session.messages.push({ role: "assistant", content: data.answer || "任务已完成" }); saveSessions(); addMessage("agent", data.answer || "任务已完成");
    if (data.events?.length) { document.body.classList.add("has-events"); events.classList.remove("hidden"); events.innerHTML = data.events.map((e) => `<div class="event"><b>${e.name}</b><br>${escapeHtml(e.input)}${e.output ? `<span class="event-output">${escapeHtml(e.output)}</span>` : ""}</div>`).join(""); }
    status.textContent = "Deno Runtime 已连接 · s01 Agent Loop";
  } catch (error) { session.messages.push({ role: "assistant", content: `错误：${error.message}` }); saveSessions(); addMessage("agent", `错误：${error.message}`); status.textContent = "请求失败"; }
  finally { send.disabled = false; input.focus(); }
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
settingsForm.addEventListener("submit", async (event) => { if (event.submitter?.value === "cancel") return; event.preventDefault(); const button = $("#save-settings"); button.disabled = true; try { const response = await fetch(`${API}/settings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: $("#api-key").value, baseUrl: $("#base-url").value, models: modelsInput.value.split("\n"), defaultModel: defaultModel.value }) }), data = await response.json(); if (!response.ok) throw new Error(data.error); await loadSettings(); settingsDialog.close(); } catch (error) { $("#key-status").textContent = `错误：${error.message}`; } finally { button.disabled = false; } });
connect();
