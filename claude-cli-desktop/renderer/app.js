const $ = (selector) => document.querySelector(selector);

const state = {
  bootstrap: undefined,
  sessions: [],
  currentSessionId: undefined,
  activeSessionId: undefined,
  turnTimingsByMessage: new Map(),
  turnTimingInterval: undefined,
  activityByMessage: new Map(),
  renamingSessionId: undefined,
  pendingDeleteSessionId: undefined,
  deletingSessionId: undefined,
  pendingDeleteProjectId: undefined,
  deletingProjectId: undefined,
  collapsedProjects: new Set(),
  messageElements: new Map(),
  messageRawText: new Map(),
  diagnosticLogsBySession: new Map(),
  diagnosticExpanded: true,
  settings: undefined,
  hasApiKey: false,
  clearApiKey: false,
  pendingPermissionMode: undefined,
  toastTimer: undefined,
};

const bridge = window.claudeStudio;
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

function renderDiagnosticLogs(scrollToLatest = false) {
  const list = $("#diagnostic-list");
  const logs = state.currentSessionId
    ? state.diagnosticLogsBySession.get(state.currentSessionId) ?? []
    : [];
  const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
  $("#diagnostic-count").textContent = String(logs.length);
  $("#diagnostic-toggle-label").textContent = state.diagnosticExpanded ? "收起" : "展开";
  $("#diagnostic-toggle").setAttribute("aria-expanded", String(state.diagnosticExpanded));
  list.hidden = !state.diagnosticExpanded;
  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "diagnostic-empty";
    empty.textContent = "发送消息后，CLI 和模型请求日志会显示在这里。";
    list.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of logs) {
    const row = document.createElement("div");
    row.className = "diagnostic-log-entry " + entry.level;
    const time = document.createElement("time");
    time.className = "diagnostic-time";
    time.dateTime = entry.timestamp;
    const parsedTime = new Date(entry.timestamp);
    time.textContent = Number.isNaN(parsedTime.getTime())
      ? "--:--:--"
      : parsedTime.toLocaleTimeString();
    const level = document.createElement("span");
    level.className = "diagnostic-level";
    level.textContent = entry.level.toUpperCase();
    const message = document.createElement("span");
    message.className = "diagnostic-message";
    message.textContent = entry.message;
    row.append(time, level, message);
    fragment.append(row);
  }
  list.replaceChildren(fragment);
  if (scrollToLatest || wasAtBottom) list.scrollTop = list.scrollHeight;
}

function formatTurnDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}小时${minutes ? `${minutes}分` : ""}`;
  if (totalMinutes > 0) return seconds ? `${totalMinutes}分${seconds}秒` : `${totalMinutes}分钟`;
  return `${seconds}秒`;
}

function renderMessageDuration(messageId, durationMs, running = false) {
  const duration = state.messageElements.get(messageId)?.querySelector(".message-duration");
  if (!duration) return;
  duration.textContent = running
    ? `进行中 · ${formatTurnDuration(durationMs)}`
    : `用时 ${formatTurnDuration(durationMs)}`;
  duration.classList.toggle("running", running);
}

function renderMessageTokenUsage(messageId, tokenUsage, running = false) {
  const usage = state.messageElements.get(messageId)?.querySelector(".message-token-usage");
  if (!usage) return;
  if (!tokenUsage || !Number.isSafeInteger(tokenUsage.totalTokens) || tokenUsage.totalTokens < 0) {
    usage.textContent = "";
    usage.title = "";
    usage.classList.remove("running");
    return;
  }
  const details = [];
  const cacheTokens = (Number.isSafeInteger(tokenUsage.cacheReadInputTokens) ? tokenUsage.cacheReadInputTokens : 0) +
    (Number.isSafeInteger(tokenUsage.cacheCreationInputTokens) ? tokenUsage.cacheCreationInputTokens : 0);
  if (Number.isSafeInteger(tokenUsage.inputTokens) && Number.isSafeInteger(tokenUsage.outputTokens)) {
    const inputText = `输入 ${formatTokenCount(tokenUsage.inputTokens)}` +
      (cacheTokens > 0 ? `（缓存 ${formatTokenCount(cacheTokens)}）` : "");
    details.push(`${inputText} / 输出 ${formatTokenCount(tokenUsage.outputTokens)}`);
  }
  if (cacheTokens > 0 && details.length === 0) details.push(`缓存 ${formatTokenCount(cacheTokens)}`);
  usage.textContent = `${running ? "本轮已消耗" : "本轮消耗"} ${formatTokenCount(tokenUsage.totalTokens)} tokens` +
    (details.length ? ` · ${details.join(" · ")}` : "");
  usage.title = usage.textContent;
  usage.classList.toggle("running", running);
}

function refreshTurnTimings() {
  let hasRunningTurn = false;
  for (const [messageId, timing] of state.turnTimingsByMessage) {
    hasRunningTurn = true;
    renderMessageDuration(messageId, Date.now() - timing.startedAt, true);
  }
  if (!hasRunningTurn && state.turnTimingInterval) {
    window.clearInterval(state.turnTimingInterval);
    state.turnTimingInterval = undefined;
  }
}

function startTurnTiming(sessionId, messageId, startedAt) {
  state.turnTimingsByMessage.set(messageId, {
    sessionId,
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
  });
  refreshTurnTimings();
  if (!state.turnTimingInterval) {
    state.turnTimingInterval = window.setInterval(refreshTurnTimings, 1000);
  }
}

function finishTurnTiming(sessionId, messageId, durationMs) {
  const timing = state.turnTimingsByMessage.get(messageId);
  const elapsedMs = typeof durationMs === "number" && Number.isFinite(durationMs)
    ? Math.max(0, durationMs)
    : timing && timing.sessionId === sessionId
    ? Math.max(0, Date.now() - timing.startedAt)
    : undefined;
  if (elapsedMs !== undefined) renderMessageDuration(messageId, elapsedMs);
  state.turnTimingsByMessage.delete(messageId);
  refreshTurnTimings();
}

function formatTokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : "未知";
}

function renderAssistantActivity(messageId, activity) {
  if (!activity) return;
  const article = state.messageElements.get(messageId);
  const content = article?.querySelector(".message-content");
  if (!content) return;
  let row = content.querySelector(".assistant-activity");
  if (!row) {
    row = document.createElement("div");
    row.className = "assistant-activity";
    const text = content.querySelector(".message-text");
    if (text) content.insertBefore(row, text);
    else content.append(row);
  }
  const running = activity.status === "running";
  const indicator = document.createElement("span");
  indicator.className = "assistant-activity-indicator";
  const copy = document.createElement("span");
  copy.className = "assistant-activity-copy";
  const title = document.createElement("strong");
  title.className = "assistant-activity-title";
  const count = Number.isSafeInteger(activity.total) ? activity.total : 0;
  const autoCompactionCount = Number.isSafeInteger(activity.autoCompactionCount) ? activity.autoCompactionCount : 0;
  const progressSummary = Array.isArray(activity.progressSummary)
    ? activity.progressSummary.filter((step) => typeof step === "string" && step.trim()).slice(-6)
    : [];
  const currentProgress = progressSummary[progressSummary.length - 1];
  if (running && activity.compactionStatus === "compacting") title.textContent = "正在压缩上下文";
  else if (running && currentProgress) {
    const progressTitle = /^(正在|已确认|已完成|接下来)/.test(currentProgress)
      ? currentProgress
      : `正在${currentProgress}`;
    title.textContent = progressTitle.slice(0, 120);
  } else if (running) title.textContent = activity.currentAction ? `正在${activity.currentAction}` : "正在分析任务";
  else if (activity.status === "complete") title.textContent = count ? `本轮已完成 · ${count} 项操作` : "本轮已完成";
  else if (activity.status === "stopped") title.textContent = count ? `已停止 · ${count} 项操作` : "已停止";
  else if (activity.status === "error") title.textContent = count ? `遇到问题 · ${count} 项操作` : "遇到问题";
  else if (activity.status === "stored" && autoCompactionCount > 0 && count === 0) title.textContent = "上下文压缩记录";
  else title.textContent = count ? `本轮操作 · ${count} 项` : "本轮操作";
  copy.append(title);
  if (activity.summary) {
    const details = document.createElement("span");
    details.className = "assistant-activity-details";
    details.textContent = `${running ? "已发起：" : "操作概览："}${activity.summary}`;
    copy.append(details);
  }
  const visibleProgress = running ? progressSummary.slice(0, -1) : progressSummary;
  if (visibleProgress.length) {
    const progress = document.createElement("div");
    progress.className = "assistant-activity-progress";
    const heading = document.createElement("strong");
    heading.className = "assistant-activity-progress-title";
    heading.textContent = "思路进度";
    const list = document.createElement("ol");
    list.className = "assistant-activity-progress-list";
    visibleProgress.forEach((step, index) => {
      const item = document.createElement("li");
      const marker = document.createElement("span");
      marker.className = "assistant-activity-progress-marker";
      const completed = activity.status === "complete" || activity.status === "stored";
      marker.textContent = completed ? "✓" : "·";
      const text = document.createElement("span");
      text.textContent = step;
      item.append(marker, text);
      list.append(item);
    });
    progress.append(heading, list);
    copy.append(progress);
  }
  let compactionText = "";
  if (activity.compactionStatus === "compacting") compactionText = "正在压缩上下文…";
  else if (activity.compactionStatus === "failed") compactionText = "上下文压缩未完成 · 查看运行日志";
  else if (autoCompactionCount > 0) {
    const last = activity.lastAutoCompaction;
    compactionText = `自动压缩 ${autoCompactionCount} 次`;
    if (last) {
      const postTokens = Number.isSafeInteger(last.postTokens) ? formatTokenCount(last.postTokens) : "未知";
      compactionText += ` · 最近一次 ${formatTokenCount(last.preTokens)} → ${postTokens} tokens`;
    }
  } else if (activity.compactionStatus === "completed" && activity.compactionTrigger === "manual") {
    compactionText = "手动压缩已完成";
  }
  if (compactionText) {
    const details = document.createElement("span");
    details.className = `assistant-activity-details assistant-activity-compaction${activity.compactionStatus === "failed" ? " failed" : ""}`;
    details.textContent = compactionText;
    copy.append(details);
  }
  row.className = `assistant-activity ${running ? "running" : activity.status}`;
  row.replaceChildren(indicator, copy);
}

function finishAssistantActivity(event) {
  const previous = state.activityByMessage.get(event.messageId);
  const summary = event.activitySummary ?? previous?.summary ?? "";
  const total = event.activityCount ?? previous?.total ?? 0;
  const status = event.type === "turn-complete" ? "complete" : event.type === "turn-stopped" ? "stopped" : "error";
  state.activityByMessage.delete(event.messageId);
  renderAssistantActivity(event.messageId, {
    ...previous,
    status,
    summary,
    total,
    progressSummary: event.progressSummary ?? previous?.progressSummary ?? [],
    autoCompactionCount: event.autoCompactionCount ?? previous?.autoCompactionCount ?? 0,
    lastAutoCompaction: event.lastAutoCompaction ?? previous?.lastAutoCompaction,
  });
}

function appendDiagnosticLog(entry) {
  let logs = state.diagnosticLogsBySession.get(entry.sessionId);
  if (!logs) {
    logs = [];
    state.diagnosticLogsBySession.set(entry.sessionId, logs);
  }
  logs.push(entry);
  if (logs.length > 250) logs.splice(0, logs.length - 250);
  if (state.currentSessionId === entry.sessionId) renderDiagnosticLogs();
}

async function copyDiagnosticLogs() {
  const logs = state.currentSessionId
    ? state.diagnosticLogsBySession.get(state.currentSessionId) ?? []
    : [];
  if (!logs.length) {
    showToast("当前没有运行日志");
    return;
  }
  const text = logs.map((entry) => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    return time + " " + entry.level.toUpperCase() + " " + entry.message;
  }).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast("运行日志已复制");
  } catch {
    showToast("无法访问剪贴板，请在日志区域选择并复制");
  }
}

function hasProviderAuth() {
  return state.hasApiKey;
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
  $("#provider-name").textContent = "DeepSeek API";
  $("#provider-icon").textContent = "D";
  $("#key-state").textContent = state.hasApiKey ? "密钥已保存在本机" : "尚未配置密钥";
  $("#provider-dot").classList.toggle("ready", state.hasApiKey);
  $("#key-saved-state").textContent = state.hasApiKey ? "密钥已保存" : "尚未保存";
  $("#key-saved-state").classList.toggle("saved", state.hasApiKey);
  $("#model-chip span:last-child").textContent = state.settings?.model || "DeepSeek";
  $("#settings-description").textContent = "配置 Claude Code CLI 使用的 Anthropic 兼容接口。密钥以明文本地文件保存，仅当前用户可读写，不使用钥匙串。";
  $("#welcome-description").textContent = "选择一个项目文件夹，Claude Code 会在本机读取与修改文件。DeepSeek API Key 只保存在本机。";
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
  const ready = Boolean(state.bootstrap?.cliPath && hasProviderAuth());
  const isRunning = Boolean(state.activeSessionId);
  promptInput.disabled = !hasSession || !ready || isRunning;
  sendButton.disabled = !hasSession || !ready || isRunning || !promptInput.value.trim();
  stopButton.hidden = state.activeSessionId !== state.currentSessionId;
  $("#composer-context").textContent = state.activeSessionId
    ? "任务运行中 · 模式切换即时生效"
    : state.bootstrap?.cliPath ? "Claude Code CLI · 本机运行" : "等待安装 Claude Code CLI";
  if (!hasSession) promptInput.placeholder = "先选择一个项目文件夹…";
  else if (!state.bootstrap?.cliPath) promptInput.placeholder = "请先安装 Claude Code CLI…";
  else if (!hasProviderAuth()) promptInput.placeholder = "先在设置中保存 DeepSeek API Key…";
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
    const collapsed = state.collapsedProjects.has(cwd);
    const openProject = document.createElement("button");
    openProject.type = "button";
    openProject.className = "workspace-select";
    openProject.title = `${collapsed ? "展开" : "收起"} ${name} 中的会话`;
    openProject.setAttribute("aria-expanded", String(!collapsed));
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
    const projectChevron = document.createElement("span");
    projectChevron.className = "workspace-chevron";
    projectChevron.textContent = collapsed ? "›" : "⌄";
    openProject.append(folderIcon, projectCopy, projectCount, projectChevron);
    openProject.addEventListener("click", () => {
      if (state.collapsedProjects.has(cwd)) state.collapsedProjects.delete(cwd);
      else state.collapsedProjects.add(cwd);
      renderSessions();
    });

    const addSession = document.createElement("button");
    addSession.type = "button";
    addSession.className = "workspace-add-session";
    addSession.title = `在 ${name} 中新建会话`;
    addSession.setAttribute("aria-label", `在 ${name} 中新建会话`);
    addSession.textContent = "+";
    addSession.addEventListener("click", () => void startSessionInWorkspace(sessions[0].id));

    const removeProject = document.createElement("button");
    removeProject.type = "button";
    removeProject.className = "workspace-remove-project";
    removeProject.title = "移除项目";
    removeProject.setAttribute("aria-label", `移除项目：${name}`);
    removeProject.textContent = "×";
    removeProject.addEventListener("click", () => openDeleteProjectConfirmation(sessions[0].id));

    header.append(openProject, addSession, removeProject);

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
        button.title = `${session.title} · 双击重命名 · ${cwd}`;
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
        button.addEventListener("dblclick", (event) => {
          event.preventDefault();
          beginRenameSession(session.id);
        });

        const close = document.createElement("button");
        close.type = "button";
        close.className = "session-close-button";
        close.title = "关闭会话";
        close.setAttribute("aria-label", `关闭会话：${session.title}`);
        close.textContent = "×";
        close.addEventListener("click", () => openDeleteConfirmation(session.id));
        row.append(button, close);
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

function openDeleteConfirmation(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (state.activeSessionId === sessionId) {
    showToast("请先停止这个会话中的任务，再删除会话");
    renderSessions();
    return;
  }
  state.pendingDeleteSessionId = sessionId;
  renderSessions();
  $("#delete-session-name").textContent = session.title;
  $("#delete-session-path").textContent = session.cwd;
  $("#delete-session-error").hidden = true;
  $("#delete-session-backdrop").hidden = false;
  $("#cancel-delete-session").focus();
}

function closeDeleteConfirmation() {
  if (state.deletingSessionId) return;
  state.pendingDeleteSessionId = undefined;
  $("#delete-session-backdrop").hidden = true;
}

async function confirmDeleteSession() {
  const sessionId = state.pendingDeleteSessionId;
  if (!sessionId || state.deletingSessionId) return;
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    closeDeleteConfirmation();
    return;
  }
  if (state.activeSessionId === sessionId) {
    $("#delete-session-error").textContent = "请先停止这个会话中的任务，再删除会话。";
    $("#delete-session-error").hidden = false;
    return;
  }

  state.deletingSessionId = sessionId;
  const confirmButton = $("#confirm-delete-session");
  const cancelButton = $("#cancel-delete-session");
  confirmButton.disabled = true;
  cancelButton.disabled = true;
  try {
    await bridge.deleteSession(sessionId);
    state.sessions = state.sessions.filter((item) => item.id !== sessionId);
    if (state.bootstrap) state.bootstrap.sessions = state.sessions;
    if (state.renamingSessionId === sessionId) state.renamingSessionId = undefined;
    state.pendingDeleteSessionId = undefined;

    if (state.currentSessionId === sessionId) {
      const nextSession = state.sessions.find((item) => item.cwd === session.cwd) ?? state.sessions[0];
      if (nextSession) await selectSession(nextSession.id);
      else {
        state.messageElements.clear();
        state.messageRawText.clear();
        setActiveSession(undefined);
      }
    } else {
      renderSessions();
    }

    $("#delete-session-backdrop").hidden = true;
    showToast("会话和聊天记录已删除，项目文件未受影响");
  } catch (error) {
    $("#delete-session-error").textContent = error.message || "无法删除这个会话";
    $("#delete-session-error").hidden = false;
  } finally {
    state.deletingSessionId = undefined;
    confirmButton.disabled = false;
    cancelButton.disabled = false;
  }
}

function openDeleteProjectConfirmation(sessionId) {
  const projectSession = state.sessions.find((item) => item.id === sessionId);
  if (!projectSession) return;
  const projectSessions = state.sessions.filter((item) => item.cwd === projectSession.cwd);
  if (projectSessions.some((session) => session.id === state.activeSessionId)) {
    showToast("请先停止这个项目中的任务，再移除项目");
    return;
  }
  state.pendingDeleteProjectId = sessionId;
  $("#delete-project-name").textContent = directoryName(projectSession.cwd);
  $("#delete-project-path").textContent = projectSession.cwd;
  $("#delete-project-session-count").textContent = `包含 ${projectSessions.length} 个会话`;
  $("#delete-project-error").hidden = true;
  $("#delete-project-backdrop").hidden = false;
  $("#cancel-delete-project").focus();
}

function closeDeleteProjectConfirmation() {
  if (state.deletingProjectId) return;
  state.pendingDeleteProjectId = undefined;
  $("#delete-project-backdrop").hidden = true;
}

async function confirmDeleteProject() {
  const sessionId = state.pendingDeleteProjectId;
  if (!sessionId || state.deletingProjectId) return;
  const projectSession = state.sessions.find((item) => item.id === sessionId);
  if (!projectSession) {
    closeDeleteProjectConfirmation();
    return;
  }
  const projectCwd = projectSession.cwd;
  const projectSessions = state.sessions.filter((item) => item.cwd === projectCwd);
  if (projectSessions.some((session) => session.id === state.activeSessionId)) {
    $("#delete-project-error").textContent = "请先停止这个项目中的任务，再移除项目。";
    $("#delete-project-error").hidden = false;
    return;
  }

  state.deletingProjectId = sessionId;
  const confirmButton = $("#confirm-delete-project");
  const cancelButton = $("#cancel-delete-project");
  confirmButton.disabled = true;
  cancelButton.disabled = true;
  try {
    await bridge.deleteProject(sessionId);
    const removedIds = new Set(projectSessions.map((session) => session.id));
    state.sessions = state.sessions.filter((session) => session.cwd !== projectCwd);
    if (state.bootstrap) state.bootstrap.sessions = state.sessions;
    if (state.renamingSessionId && removedIds.has(state.renamingSessionId)) state.renamingSessionId = undefined;
    state.collapsedProjects.delete(projectCwd);
    state.pendingDeleteProjectId = undefined;

    if (state.currentSessionId && removedIds.has(state.currentSessionId)) {
      const nextSession = state.sessions[0];
      if (nextSession) await selectSession(nextSession.id);
      else {
        state.messageElements.clear();
        state.messageRawText.clear();
        setActiveSession(undefined);
      }
    } else {
      renderSessions();
    }

    $("#delete-project-backdrop").hidden = true;
    showToast(`项目及其 ${projectSessions.length} 个会话已从 Studio 移除；项目文件保留`);
  } catch (error) {
    $("#delete-project-error").textContent = error.message || "无法移除这个项目";
    $("#delete-project-error").hidden = false;
  } finally {
    state.deletingProjectId = undefined;
    confirmButton.disabled = false;
    cancelButton.disabled = false;
  }
}

function setActiveSession(session) {
  state.currentSessionId = session?.id;
  $("#project-title").textContent = session?.title ?? "选择一个项目";
  $("#project-path").textContent = session?.cwd ?? "Claude CLI 在本机运行";
  welcomeState.hidden = Boolean(session);
  messageList.hidden = !session;
  if (!session) messageList.replaceChildren();
  renderDiagnosticLogs(true);
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
    for (const [messageId, activity] of state.activityByMessage) {
      if (activity.sessionId === sessionId) renderAssistantActivity(messageId, activity);
    }
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
  if (role === "assistant") {
    const duration = document.createElement("span");
    duration.className = "message-duration";
    duration.setAttribute("aria-live", "off");
    const tokenUsage = document.createElement("span");
    tokenUsage.className = "message-token-usage";
    tokenUsage.setAttribute("aria-live", "off");
    label.append(duration, tokenUsage);
  }
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
  if (message.role === "tool") return;
  const { article, text } = addMessageShell(message.role, message.id, message.createdAt);
  if (message.role === "assistant") {
    state.messageRawText.set(message.id, message.text);
    window.claudeMarkdown.render(text, message.text);
    const timing = state.turnTimingsByMessage.get(message.id);
    if (timing) renderMessageDuration(message.id, Date.now() - timing.startedAt, true);
    else if (typeof message.durationMs === "number") renderMessageDuration(message.id, message.durationMs);
    if (message.tokenUsage) renderMessageTokenUsage(message.id, message.tokenUsage);
    if (message.activitySummary || message.progressSummary?.length || message.autoCompactionCount) {
      renderAssistantActivity(message.id, {
        status: "stored",
        summary: message.activitySummary,
        total: message.activityCount ?? 0,
        progressSummary: message.progressSummary ?? [],
        autoCompactionCount: message.autoCompactionCount ?? 0,
        lastAutoCompaction: message.lastAutoCompaction,
      });
    }
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

function toolActionLabel(toolName) {
  switch (toolName) {
    case "Bash": return "运行命令";
    case "Read": return "读取文件";
    case "Glob": return "搜索文件";
    case "Grep": return "搜索代码";
    case "Edit": return "修改文件";
    case "Write": return "写入文件";
    case "NotebookEdit": return "编辑笔记本";
    case "WebSearch": return "搜索网页";
    case "WebFetch": return "读取网页";
    case "LS": return "查看目录";
    default: return "执行操作";
  }
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
  title.textContent = `允许 Claude ${toolActionLabel(event.toolName)}？`;
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
  if (event.type === "diagnostic-log") {
    appendDiagnosticLog(event);
    return;
  }
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
    startTurnTiming(event.sessionId, event.assistantMessageId, event.startedAt);
    state.activityByMessage.set(event.assistantMessageId, {
      sessionId: event.sessionId,
      status: "running",
      currentAction: "",
      total: 0,
      summary: "",
      progressSummary: event.progressSummary ?? ["梳理任务目标"],
      autoCompactionCount: 0,
      compactionStatus: "idle",
    });
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
    renderAssistantActivity(event.assistantMessageId, state.activityByMessage.get(event.assistantMessageId));
    const text = assistant.querySelector(".message-text");
    renderMessageDuration(
      event.assistantMessageId,
      Date.now() - (state.turnTimingsByMessage.get(event.assistantMessageId)?.startedAt ?? Date.now()),
      true,
    );
    if (text && !text.textContent) addTypingIndicator(text);
    updateControls();
    scrollToBottom();
    return;
  }
  if (event.type === "turn-complete" || event.type === "turn-error" || event.type === "turn-stopped") {
    finishTurnTiming(event.sessionId, event.messageId, event.durationMs);
    finishAssistantActivity(event);
    if (event.tokenUsage) renderMessageTokenUsage(event.messageId, event.tokenUsage);
    if (state.activeSessionId === event.sessionId) state.activeSessionId = undefined;
    updateControls();
  }
  if (event.type === "token-usage") {
    if (state.currentSessionId === event.sessionId) {
      renderMessageTokenUsage(event.messageId, event.tokenUsage, event.phase === "running");
    }
    return;
  }
  if (event.type === "tool-call") {
    const previous = state.activityByMessage.get(event.messageId);
    const activity = {
      ...previous,
      sessionId: event.sessionId,
      status: "running",
      currentAction: event.action,
      total: event.total,
      summary: event.activitySummary,
      progressSummary: previous?.progressSummary ?? [],
    };
    state.activityByMessage.set(event.messageId, activity);
    if (state.currentSessionId === event.sessionId) {
      renderAssistantActivity(event.messageId, activity);
      scrollToBottom();
    }
    return;
  }
  if (event.type === "assistant-progress") {
    const previous = state.activityByMessage.get(event.messageId);
    const activity = {
      ...previous,
      sessionId: event.sessionId,
      status: previous?.status ?? "running",
      currentAction: previous?.currentAction ?? "",
      total: previous?.total ?? 0,
      summary: previous?.summary ?? "",
      progressSummary: event.progressSummary,
    };
    state.activityByMessage.set(event.messageId, activity);
    if (state.currentSessionId === event.sessionId) {
      renderAssistantActivity(event.messageId, activity);
      scrollToBottom();
    }
    return;
  }
  if (event.type === "context-compaction") {
    const previous = state.activityByMessage.get(event.messageId);
    const activity = {
      ...previous,
      sessionId: event.sessionId,
      status: previous?.status ?? "running",
      currentAction: previous?.currentAction ?? "",
      total: previous?.total ?? 0,
      summary: previous?.summary ?? "",
      autoCompactionCount: event.autoCompactionCount,
      compactionStatus: event.phase === "starting" ? "compacting" : event.phase,
      compactionTrigger: event.trigger ?? previous?.compactionTrigger,
      lastAutoCompaction: event.phase === "completed" && event.trigger === "auto"
        ? {
          preTokens: event.preTokens,
          ...(typeof event.postTokens === "number" ? { postTokens: event.postTokens } : {}),
        }
        : previous?.lastAutoCompaction,
    };
    state.activityByMessage.set(event.messageId, activity);
    if (state.currentSessionId === event.sessionId) {
      renderAssistantActivity(event.messageId, activity);
      scrollToBottom();
    }
    return;
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
  if (!hasProviderAuth()) {
    showToast("先在设置中保存 DeepSeek API Key，再开始对话");
    openSettings();
  } else if (!state.bootstrap?.cliPath) {
    showToast(state.bootstrap?.cliError ?? "请先安装 Claude Code CLI");
  }
}

function openSettings() {
  const settings = state.settings ?? {
    baseUrl: "https://api.deepseek.com/anthropic",
    model: "deepseek-flash",
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
$("#cancel-delete-session").addEventListener("click", closeDeleteConfirmation);
$("#close-delete-session").addEventListener("click", closeDeleteConfirmation);
$("#confirm-delete-session").addEventListener("click", () => void confirmDeleteSession());
$("#delete-session-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#delete-session-backdrop")) closeDeleteConfirmation();
});
$("#cancel-delete-project").addEventListener("click", closeDeleteProjectConfirmation);
$("#close-delete-project").addEventListener("click", closeDeleteProjectConfirmation);
$("#confirm-delete-project").addEventListener("click", () => void confirmDeleteProject());
$("#delete-project-backdrop").addEventListener("click", (event) => {
  if (event.target === $("#delete-project-backdrop")) closeDeleteProjectConfirmation();
});
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
    model: "deepseek-flash",
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
$("#diagnostic-toggle").addEventListener("click", () => {
  state.diagnosticExpanded = !state.diagnosticExpanded;
  renderDiagnosticLogs();
});
$("#diagnostic-clear").addEventListener("click", () => {
  if (state.currentSessionId) state.diagnosticLogsBySession.delete(state.currentSessionId);
  renderDiagnosticLogs();
});
$("#diagnostic-copy").addEventListener("click", () => void copyDiagnosticLogs());
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
  if (event.key === "Escape" && !$("#delete-session-backdrop").hidden) closeDeleteConfirmation();
  if (event.key === "Escape" && !$("#delete-project-backdrop").hidden) closeDeleteProjectConfirmation();
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
    if (!hasProviderAuth()) {
      showToast(bootstrap.legacyApiKeyPresent
        ? "旧版密钥需要重新输入一次；新版只保存在本机文件"
        : "保存 DeepSeek API Key 后即可开始");
    }
  } catch (error) {
    showToast(error.message || "应用初始化失败");
  }
}

void initialize();
