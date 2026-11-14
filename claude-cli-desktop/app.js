const $ = (selector) => document.querySelector(selector);

const state = {
  bootstrap: undefined,
  sessions: [],
  currentSessionId: undefined,
  activeSessionId: undefined,
  renamingSessionId: undefined,
  collapsedProjects: new Set(),
  messageElements: new Map(),
  messageRawText: new Map(),
  settings: undefined,
  hasApiKey: false,
  clearApiKey: false,
  pendingPermissionMode: undefined,
  toastTimer: undefined,
};

const bridge = window.claudeDesktop;
const sessionList = $("#session-list");
const welcomeState = $("#welcome-state");
const messageList = $("#message-list");
const promptInput = $("#prompt-input");
const sendButton = $("#send-button");
const stopButton = $("#stop-button");

bridge.onEvent((event) => {
  void handleAppEvent(event);
});

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
}

function setStatus() {
  const bootstrap = state.bootstrap;
  if (!bootstrap) return;
  const hasCli = Boolean(bootstrap.cliPath);
  const indicator = $("#cli-indicator");
  indicator.querySelector(".indicator-dot").classList.toggle("ready", hasCli);
  indicator.querySelector("span:last-child").textContent = hasCli
    ? `Claude CLI ${bootstrap.cliVersion ?? "已连接"}`
    : "Claude CLI 未安装";
  $("#cli-version-detail").textContent = hasCli
    ? `${bootstrap.cliVersion} · ${bootstrap.cliPath}`
    : bootstrap.cliError ?? "没有检测到 Claude Code CLI";
  $("#key-state").textContent = state.hasApiKey ? "密钥已保存在本机" : "尚未配置密钥";
  $("#provider-dot").classList.toggle("ready", state.hasApiKey);
  $("#key-saved-state").textContent = state.hasApiKey ? "密钥已保存" : "尚未保存";
  $("#key-saved-state").classList.toggle("saved", state.hasApiKey);
  $("#model-chip span:last-child").textContent = state.settings?.model || "DeepSeek";
  renderPermissionMode();
  $("#composer-context").textContent = hasCli ? "Claude Code CLI · 本机运行" : "等待安装 Claude Code CLI";
  updateControls();
}

function permissionLabel(mode) {
  if (mode === "acceptEdits") return "自动接受文件编辑";
  if (mode === "bypassPermissions") return "完全放开";
  return "询问权限";
}

function permissionHelp(mode) {
  if (mode === "acceptEdits") return "自动接受文件编辑；命令等其他操作仍会询问。";
  if (mode === "bypassPermissions") return "所有工具权限确认都会跳过。";
  return "需要授权的操作会在对话中询问。";
}

function renderPermissionMode() {
  const mode = state.settings?.permissionMode ?? "default";
  $("#permission-mode-trigger").dataset.mode = mode;
  $("#permission-mode-label").textContent = permissionLabel(mode);
  $("#permission-mode-description").textContent = permissionHelp(mode);
  $("#composer-note").textContent = mode === "bypassPermissions"
    ? "完全放开会跳过权限确认；Claude Code 可能访问项目外文件、运行任意命令或访问网络。"
    : mode === "acceptEdits"
    ? "文件编辑会自动接受；命令和其他需要授权的操作仍会询问。"
    : "Claude CLI 会在所选目录中工作。需要授权的命令会在对话中询问。";
  for (const option of document.querySelectorAll("[data-permission-mode]")) {
    const selected = option.dataset.permissionMode === mode;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("selected", selected);
  }
}

function updateControls() {
  const hasSession = Boolean(state.currentSessionId);
  const ready = Boolean(state.bootstrap?.cliPath && state.hasApiKey);
  const isRunning = Boolean(state.activeSessionId);
  promptInput.disabled = !hasSession || !ready || isRunning;
  sendButton.disabled = !hasSession || !ready || isRunning || !promptInput.value.trim();
  stopButton.hidden = state.activeSessionId !== state.currentSessionId;
  $("#composer-context").textContent = state.activeSessionId
    ? "任务运行中 · 模式切换即时生效"
    : state.bootstrap?.cliPath ? "Claude Code CLI · 本机运行" : "等待安装 Claude Code CLI";
  if (!hasSession) promptInput.placeholder = "先选择一个项目文件夹…";
  else if (!state.bootstrap?.cliPath) promptInput.placeholder = "请先安装 Claude Code CLI…";
  else if (!state.hasApiKey) promptInput.placeholder = "先在设置中保存 DeepSeek API Key…";
  else promptInput.placeholder = "描述你想完成的改动…";
}

function renderSessions() {
  sessionList.replaceChildren();
  if (!state.sessions.length) {
    $("#session-count").textContent = "0";
    const empty = document.createElement("div");
    empty.className = "empty-sidebar project-empty";
    const icon = document.createElement("span");
    icon.className = "empty-project-icon";
    icon.textContent = "▰";
    const title = document.createElement("strong");
    title.textContent = "还没有项目";
    const description = document.createElement("span");
    description.textContent = "打开一个本地文件夹开始工作";
    empty.append(icon, title, description);
    sessionList.append(empty);
    return;
  }

  const projects = new Map();
  for (const session of state.sessions) {
    const sessions = projects.get(session.cwd) ?? [];
    sessions.push(session);
    projects.set(session.cwd, sessions);
  }
  $("#session-count").textContent = String(projects.size);

  for (const [cwd, sessions] of projects) {
    const name = directoryName(cwd);
    const group = document.createElement("section");
    group.className = "workspace-group";
    if (sessions.some((session) => session.id === state.currentSessionId)) group.classList.add("active");

    const header = document.createElement("div");
    header.className = "workspace-group-header";
    const openProject = document.createElement("button");
    openProject.type = "button";
    openProject.className = "workspace-select";
    openProject.title = `打开 ${cwd} 中最近的会话`;
    const folderIcon = document.createElement("span");
    folderIcon.className = "workspace-folder-icon";
    folderIcon.textContent = "▰";
    const projectCopy = document.createElement("span");
    projectCopy.className = "workspace-copy";
    const projectName = document.createElement("strong");
    projectName.textContent = name;
    const projectPath = document.createElement("span");
    projectPath.textContent = compactPath(cwd);
    projectCopy.append(projectName, projectPath);
    const projectCount = document.createElement("span");
    projectCount.className = "workspace-count";
    projectCount.textContent = String(sessions.length);
    openProject.append(folderIcon, projectCopy, projectCount);
    openProject.addEventListener("click", () => void selectSession(sessions[0].id));

    const collapsed = state.collapsedProjects.has(cwd);
    const addSession = document.createElement("button");
    addSession.type = "button";
    addSession.className = "workspace-add-session";
    addSession.title = `在 ${name} 中新建会话`;
    addSession.setAttribute("aria-label", `在 ${name} 中新建会话`);
    addSession.textContent = "+";
    addSession.addEventListener("click", () => void startSessionInWorkspace(sessions[0].id));

    const disclosure = document.createElement("button");
    disclosure.type = "button";
    disclosure.className = "workspace-disclosure";
    disclosure.setAttribute("aria-expanded", String(!collapsed));
    disclosure.setAttribute("aria-label", `${collapsed ? "展开" : "折叠"} ${name} 的会话`);
    disclosure.textContent = collapsed ? "›" : "⌄";
    disclosure.addEventListener("click", () => {
      if (state.collapsedProjects.has(cwd)) state.collapsedProjects.delete(cwd);
      else state.collapsedProjects.add(cwd);
      renderSessions();
    });
    header.append(openProject, addSession, disclosure);

    const conversations = document.createElement("div");
    conversations.className = "workspace-conversations";
    conversations.hidden = collapsed;
    for (const session of sessions) {
      const row = document.createElement("div");
      row.className = "session-row";
      if (state.renamingSessionId === session.id) {
        const form = document.createElement("form");
        form.className = "session-rename-form";
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 80;
        input.value = session.title;
        input.dataset.sessionRename = session.id;
        input.setAttribute("aria-label", "会话名称");
        const save = document.createElement("button");
        save.type = "submit";
        save.className = "session-rename-action save";
        save.title = "保存名称";
        save.setAttribute("aria-label", "保存名称");
        save.textContent = "✓";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "session-rename-action";
        cancel.title = "取消重命名";
        cancel.setAttribute("aria-label", "取消重命名");
        cancel.textContent = "×";
        form.append(input, save, cancel);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          void saveSessionName(session.id, input);
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelRenameSession();
          }
        });
        cancel.addEventListener("click", cancelRenameSession);
        row.append(form);
      } else {
        const button = document.createElement("button");
        button.className = `session-item${session.id === state.currentSessionId ? " active" : ""}`;
        button.type = "button";
        button.title = `${session.title} · ${cwd}`;
        const icon = document.createElement("span");
        icon.className = "session-item-icon";
        icon.textContent = session.id === state.currentSessionId ? "●" : "○";
        const copy = document.createElement("span");
        copy.className = "session-item-copy";
        const title = document.createElement("strong");
        title.textContent = session.title;
        copy.append(title);
        button.append(icon, copy);
        button.addEventListener("click", () => void selectSession(session.id));

        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "session-row-menu";
        rename.title = "重命名会话";
        rename.setAttribute("aria-label", `重命名会话：${session.title}`);
        rename.textContent = "···";
        rename.addEventListener("click", () => beginRenameSession(session.id));
        row.append(button, rename);
      }
      conversations.append(row);
    }
    group.append(header, conversations);
    sessionList.append(group);
  }
}

function compactPath(path) {
  const home = path.replace(/^\/Users\/[^/]+/, "~");
  const parts = home.split("/").filter(Boolean);
  return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : home;
}

function directoryName(path) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}

function beginRenameSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  state.renamingSessionId = sessionId;
  state.collapsedProjects.delete(session.cwd);
  renderSessions();
  requestAnimationFrame(() => {
    const input = sessionList.querySelector("input[data-session-rename]");
    input?.focus();
    input?.select();
  });
}

function cancelRenameSession() {
  state.renamingSessionId = undefined;
  renderSessions();
}

async function saveSessionName(sessionId, input) {
  const title = input.value.trim().replace(/\s+/g, " ");
  if (!title || title.length > 80) {
    showToast("会话名称需为 1 到 80 个字符");
    input.focus();
    return;
  }
  try {
    const renamed = await bridge.renameSession(sessionId, title);
    state.sessions = state.sessions.map((session) => session.id === sessionId ? renamed : session);
    if (state.bootstrap) state.bootstrap.sessions = state.sessions;
    state.renamingSessionId = undefined;
    if (state.currentSessionId === sessionId) $("#project-title").textContent = renamed.title;
    renderSessions();
    showToast("会话名称已更新");
  } catch (error) {
    showToast(error.message || "无法重命名会话");
    input.focus();
  }
}

function setActiveSession(session) {
  state.currentSessionId = session?.id;
  $("#project-title").textContent = session?.title ?? "选择一个项目";
  $("#project-path").textContent = session?.cwd ?? "Claude CLI 在本机运行";
  welcomeState.hidden = Boolean(session);
  messageList.hidden = !session;
  if (!session) messageList.replaceChildren();
  renderSessions();
  updateControls();
}

async function selectSession(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  setActiveSession(session);
  state.messageElements.clear();
  state.messageRawText.clear();
  messageList.replaceChildren();
  try {
    const history = await bridge.loadHistory(sessionId);
    if (state.currentSessionId !== sessionId) return;
    for (const message of history) renderStoredMessage(message);
    scrollToBottom();
  } catch (error) {
    showToast(error.message || "无法载入会话");
  }
}

function addMessageShell(role, messageId, timestamp = new Date().toISOString()) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.dataset.messageId = messageId;
  article.dataset.timestamp = timestamp;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "你" : role === "tool" ? "↳" : "C";
  const content = document.createElement("div");
  content.className = "message-content";
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "你" : role === "tool" ? "本地工具" : "Claude";
  const text = document.createElement("div");
  text.className = role === "assistant" ? "message-text markdown-body" : "message-text";
  content.append(label, text);
  article.append(avatar, content);
  messageList.append(article);
  state.messageElements.set(messageId, article);
  if (role === "assistant") state.messageRawText.set(messageId, "");
  return { article, text };
}

function renderStoredMessage(message) {
  if (message.role === "tool") {
    renderToolMessage(message.toolName ?? "工具调用", message.text, message.id, message.createdAt);
    return;
  }
  const { article, text } = addMessageShell(message.role, message.id, message.createdAt);
  if (message.role === "assistant") {
    state.messageRawText.set(message.id, message.text);
    window.claudeMarkdown.render(text, message.text);
  } else {
    text.textContent = message.text;
  }
  if (message.role === "assistant" && !message.text) addTypingIndicator(text);
  if (message.role === "assistant") article.dataset.role = "assistant";
}

function addTypingIndicator(container) {
  const dots = document.createElement("span");
  dots.className = "typing-indicator";
  for (let index = 0; index < 3; index += 1) dots.append(document.createElement("i"));
  container.append(dots);
}

function renderToolMessage(name, input, id = crypto.randomUUID(), timestamp) {
  const { article, text } = addMessageShell("tool", id, timestamp);
  article.querySelector(".message-role")?.remove();
  const details = document.createElement("details");
  details.className = "tool-details";
  const summary = document.createElement("summary");
  const icon = document.createElement("span");
  icon.className = "tool-summary-icon";
  icon.textContent = "↳";
  const toolName = document.createElement("strong");
  toolName.textContent = name;
  const hint = document.createElement("span");
  hint.className = "tool-summary-hint";
  hint.textContent = "查看调用详情";
  summary.append(icon, toolName, hint);
  const preview = document.createElement("pre");
  preview.textContent = input;
  details.append(summary, preview);
  text.remove();
  article.querySelector(".message-content").append(details);
  return article;
}

function renderPermissionRequest(event) {
  if (messageList.querySelector(`[data-request-id="${CSS.escape(event.requestId)}"]`)) return;
  const card = document.createElement("section");
  card.className = "permission-card";
  card.dataset.requestId = event.requestId;
  const head = document.createElement("div");
  head.className = "permission-head";
  const badge = document.createElement("div");
  badge.className = "permission-badge";
  badge.textContent = "!";
  const copy = document.createElement("div");
  const title = document.createElement("div");
  title.className = "permission-title";
  title.textContent = `允许 Claude 使用 ${event.toolName}？`;
  const subtitle = document.createElement("div");
  subtitle.className = "permission-subtitle";
  subtitle.textContent = "此请求只对当前工具调用生效";
  copy.append(title, subtitle);
  head.append(badge, copy);
  const preview = document.createElement("pre");
  preview.textContent = event.inputPreview;
  const actions = document.createElement("div");
  actions.className = "permission-actions";
  const deny = document.createElement("button");
  deny.type = "button";
  deny.textContent = "拒绝";
  const allow = document.createElement("button");
  allow.type = "button";
  allow.className = "allow-button";
  allow.textContent = "允许一次";
  const decide = async (approved) => {
    deny.disabled = true;
    allow.disabled = true;
    await bridge.resolvePermission(event.requestId, approved);
    card.remove();
  };
  deny.addEventListener("click", () => void decide(false));
  allow.addEventListener("click", () => void decide(true));
  actions.append(deny, allow);
  card.append(head, preview, actions);
  messageList.append(card);
  scrollToBottom();
}

async function handleAppEvent(event) {
  if (event.type === "permission-request") {
    if (state.currentSessionId !== event.sessionId) {
      const session = state.sessions.find((item) => item.id === event.sessionId);
      if (!session) {
        await bridge.resolvePermission(event.requestId, false);
        return;
      }
      await selectSession(session.id);
    }
    renderPermissionRequest(event);
    return;
  }
  if (event.type === "turn-start") {
    state.activeSessionId = event.sessionId;
    const session = state.sessions.find((item) => item.id === event.sessionId);
    if (session && state.currentSessionId !== session.id) await selectSession(session.id);
    if (state.currentSessionId !== event.sessionId) {
      updateControls();
      return;
    }
    if (!state.messageElements.has(event.userMessageId)) {
      renderStoredMessage({ id: event.userMessageId, role: "user", text: event.text, createdAt: new Date().toISOString() });
    }
    let assistant = state.messageElements.get(event.assistantMessageId);
    if (!assistant) {
      assistant = addMessageShell("assistant", event.assistantMessageId).article;
    }
    const text = assistant.querySelector(".message-text");
    if (text && !text.textContent) addTypingIndicator(text);
    updateControls();
    scrollToBottom();
    return;
  }
  if (event.type === "turn-complete" || event.type === "turn-error" || event.type === "turn-stopped") {
    if (state.activeSessionId === event.sessionId) state.activeSessionId = undefined;
    updateControls();
  }
  if (state.currentSessionId !== event.sessionId) return;
  if (event.type === "text-delta") {
    const article = state.messageElements.get(event.messageId);
    const text = article?.querySelector(".message-text");
    if (!text) return;
    text.querySelector(".typing-indicator")?.remove();
    const source = (state.messageRawText.get(event.messageId) ?? "") + event.text;
    state.messageRawText.set(event.messageId, source);
    window.claudeMarkdown.render(text, source);
    scrollToBottom();
    return;
  }
  if (event.type === "tool-call") {
    renderToolMessage(event.toolName, event.inputPreview);
    scrollToBottom();
    return;
  }
  if (event.type === "turn-complete") {
    const article = state.messageElements.get(event.messageId);
    const text = article?.querySelector(".message-text");
    text?.querySelector(".typing-indicator")?.remove();
    if (text && event.result && state.messageRawText.get(event.messageId) !== event.result) {
      state.messageRawText.set(event.messageId, event.result);
      window.claudeMarkdown.render(text, event.result);
    }
    refreshSessionSummaries();
    scrollToBottom();
    return;
  }
  if (event.type === "turn-error") {
    const article = state.messageElements.get(event.messageId);
    const text = article?.querySelector(".message-text");
    text?.querySelector(".typing-indicator")?.remove();
    if (text) text.textContent = event.message;
    article?.classList.add("error");
    scrollToBottom();
    return;
  }
  if (event.type === "turn-stopped") {
    const article = state.messageElements.get(event.messageId);
    const text = article?.querySelector(".message-text");
    text?.querySelector(".typing-indicator")?.remove();
    if (text && !text.textContent) text.textContent = "已停止";
  }
}

function refreshSessionSummaries() {
  void bridge.getBootstrap().then((bootstrap) => {
    state.sessions = bootstrap.sessions;
    if (state.currentSessionId) {
      const session = state.sessions.find((item) => item.id === state.currentSessionId);
      if (session) {
        $("#project-title").textContent = session.title;
        $("#project-path").textContent = session.cwd;
      }
    }
    renderSessions();
  }).catch(() => undefined);
}

function scrollToBottom() {
  requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight; });
}

async function startNewSession() {
  try {
    const session = await bridge.createSession();
    if (!session) return;
    await activateCreatedSession(session);
  } catch (error) {
    showToast(error.message || "无法打开项目文件夹");
  }
}

async function startSessionInWorkspace(sourceSessionId) {
  try {
    const session = await bridge.createSessionInWorkspace(sourceSessionId);
    await activateCreatedSession(session);
  } catch (error) {
    showToast(error.message || "无法在该项目中创建会话");
  }
}

async function activateCreatedSession(session) {
  state.sessions.unshift(session);
  state.sessions = [...new Map(state.sessions.map((item) => [item.id, item])).values()];
  state.collapsedProjects.delete(session.cwd);
  state.renamingSessionId = undefined;
  await selectSession(session.id);
  promptInput.focus();
  if (!state.hasApiKey) {
    showToast("先在设置中保存 DeepSeek API Key，再开始对话");
    openSettings();
  } else if (!state.bootstrap?.cliPath) {
    showToast(state.bootstrap?.cliError ?? "请先安装 Claude Code CLI");
  }
}

function openSettings() {
  const settings = state.settings ?? {
    baseUrl: "https://api.deepseek.com/anthropic",
    model: "deepseek-flash[1m]",
    permissionMode: "default",
  };
  $("#base-url").value = settings.baseUrl;
  $("#model-name").value = settings.model;
  $("#api-key").value = "";
  $("#api-key").placeholder = state.hasApiKey ? "密钥已保存；输入新密钥以替换" : "输入 sk-...";
  $("#key-hint").textContent = state.bootstrap?.legacyApiKeyPresent
    ? "检测到旧版加密密钥。为避免访问钥匙串，请重新输入并保存；保存后旧文件会移除。"
    : "新密钥以明文保存在本机权限受限文件中，不写入项目仓库或钥匙串。";
  $("#settings-error").hidden = true;
  state.clearApiKey = false;
  $("#settings-backdrop").hidden = false;
  $("#base-url").focus();
}

function closeSettings() {
  $("#settings-backdrop").hidden = true;
  $("#api-key").value = "";
  state.clearApiKey = false;
}

async function saveSettings(event) {
  event.preventDefault();
  const saveButton = $("#save-settings");
  const errorElement = $("#settings-error");
  errorElement.hidden = true;
  saveButton.disabled = true;
  try {
    const apiKey = $("#api-key").value;
    const clearApiKey = state.clearApiKey;
    const saved = await bridge.saveSettings({
      settings: {
        baseUrl: $("#base-url").value.trim(),
        model: $("#model-name").value.trim(),
        permissionMode: state.settings?.permissionMode ?? "default",
      },
      ...(apiKey ? { apiKey } : {}),
      ...(clearApiKey ? { clearApiKey: true } : {}),
    });
    state.settings = saved.settings;
    state.hasApiKey = saved.hasApiKey;
    $("#api-key").value = "";
    if (state.bootstrap) {
      state.bootstrap.settings = saved.settings;
      if (apiKey || clearApiKey) state.bootstrap.legacyApiKeyPresent = false;
    }
    setStatus();
    closeSettings();
    showToast("设置已保存在本机");
  } catch (error) {
    errorElement.textContent = error.message || "无法保存设置";
    errorElement.hidden = false;
  } finally {
    saveButton.disabled = false;
  }
}

async function sendPrompt(event) {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || !state.currentSessionId || state.activeSessionId) return;
  const sessionId = state.currentSessionId;
  state.activeSessionId = sessionId;
  promptInput.value = "";
  resizePrompt();
  updateControls();
  try {
    await bridge.sendMessage(sessionId, text);
  } catch (error) {
    if (state.activeSessionId === sessionId) state.activeSessionId = undefined;
    promptInput.value = text;
    resizePrompt();
    updateControls();
    showToast(error.message || "无法发送消息");
  }
}

function resizePrompt() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
  updateControls();
}

$("#new-session").addEventListener("click", () => void startNewSession());
$("#welcome-new-session").addEventListener("click", () => void startNewSession());
$("#open-settings-bottom").addEventListener("click", openSettings);
$("#close-settings").addEventListener("click", closeSettings);
$("#cancel-settings").addEventListener("click", closeSettings);
$("#settings-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#settings-backdrop")) closeSettings();
});
$("#settings-form").addEventListener("submit", (event) => void saveSettings(event));
$("#api-key").addEventListener("input", () => {
  if ($("#api-key").value) state.clearApiKey = false;
});
$("#clear-key").addEventListener("click", () => {
  if (!state.hasApiKey) {
    showToast("当前没有已保存的密钥");
    return;
  }
  state.clearApiKey = true;
  $("#api-key").value = "";
  $("#key-hint").textContent = "保存设置后会从本机删除已保存的密钥。";
});
function closePermissionMenu() {
  $("#permission-menu").hidden = true;
  $("#permission-mode-trigger").setAttribute("aria-expanded", "false");
}

function openPermissionMenu() {
  const menu = $("#permission-menu");
  menu.hidden = !menu.hidden;
  $("#permission-mode-trigger").setAttribute("aria-expanded", String(!menu.hidden));
}

function closeFullAccessDialog() {
  $("#full-access-backdrop").hidden = true;
  state.pendingPermissionMode = undefined;
  $("#permission-mode-trigger").focus();
}

async function persistPermissionMode(mode) {
  const current = state.settings ?? {
    baseUrl: "https://api.deepseek.com/anthropic",
    model: "deepseek-flash[1m]",
    permissionMode: "default",
  };
  try {
    const saved = await bridge.saveSettings({ settings: { ...current, permissionMode: mode } });
    state.settings = saved.settings;
    if (state.bootstrap) state.bootstrap.settings = saved.settings;
    setStatus();
    showToast("权限模式已切换：" + permissionLabel(mode) + (state.activeSessionId ? " · 后续操作即时生效" : ""));
  } catch (error) {
    showToast(error.message || "无法保存权限模式");
  }
}

function requestPermissionMode(mode) {
  closePermissionMenu();
  if (mode === state.settings?.permissionMode) return;
  if (mode === "bypassPermissions") {
    state.pendingPermissionMode = mode;
    $("#full-access-backdrop").hidden = false;
    $("#cancel-full-access").focus();
    return;
  }
  void persistPermissionMode(mode);
}

$("#permission-mode-trigger").addEventListener("click", openPermissionMenu);
for (const option of document.querySelectorAll("[data-permission-mode]")) {
  option.addEventListener("click", () => requestPermissionMode(option.dataset.permissionMode));
}
document.addEventListener("click", (event) => {
  if (!$("#permission-picker").contains(event.target)) closePermissionMenu();
});
$("#cancel-full-access").addEventListener("click", closeFullAccessDialog);
$("#close-full-access").addEventListener("click", closeFullAccessDialog);
$("#confirm-full-access").addEventListener("click", () => {
  const mode = state.pendingPermissionMode;
  closeFullAccessDialog();
  if (mode === "bypassPermissions") void persistPermissionMode(mode);
});
$("#composer-form").addEventListener("submit", (event) => void sendPrompt(event));
promptInput.addEventListener("input", resizePrompt);
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $("#composer-form").requestSubmit();
  }
});
stopButton.addEventListener("click", async () => {
  const sessionId = state.activeSessionId;
  if (!sessionId || sessionId !== state.currentSessionId) return;
  stopButton.disabled = true;
  try {
    await bridge.stopSession(sessionId);
  } catch (error) {
    showToast(error.message || "无法停止会话");
  } finally {
    stopButton.disabled = false;
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === ",") {
    event.preventDefault();
    openSettings();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    void startNewSession();
  }
  if (event.key === "Escape" && !$("#settings-backdrop").hidden) closeSettings();
  if (event.key === "Escape" && !$("#full-access-backdrop").hidden) closeFullAccessDialog();
  if (event.key === "Escape" && !$("#permission-menu").hidden) closePermissionMenu();
});

async function initialize() {
  try {
    const bootstrap = await bridge.getBootstrap();
    state.bootstrap = bootstrap;
    state.settings = bootstrap.settings;
    state.hasApiKey = bootstrap.hasApiKey;
    state.sessions = bootstrap.sessions;
    setStatus();
    renderSessions();
    if (state.sessions.length) await selectSession(state.sessions[0].id);
    if (!state.hasApiKey) {
      showToast(bootstrap.legacyApiKeyPresent
        ? "旧版密钥需要重新输入一次；新版只保存在本机文件"
        : "保存 DeepSeek API Key 后即可开始");
    }
  } catch (error) {
    showToast(error.message || "应用初始化失败");
  }
}

void initialize();
