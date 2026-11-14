import { contextBridge, ipcRenderer } from "electron";
import type { AppEvent, AppSettings, BootstrapData, ChatMessage, ClaudeStudioBridge, SessionSummary } from "./contracts.js";

const bridge: ClaudeStudioBridge = {
  getBootstrap: () => ipcRenderer.invoke("app:bootstrap") as Promise<BootstrapData>,
  createSession: () => ipcRenderer.invoke("session:create") as Promise<SessionSummary | undefined>,
  createSessionInWorkspace: (sessionId) =>
    ipcRenderer.invoke("session:create-in-workspace", sessionId) as Promise<SessionSummary>,
  renameSession: (sessionId, title) =>
    ipcRenderer.invoke("session:rename", { sessionId, title }) as Promise<SessionSummary>,
  deleteSession: (sessionId) => ipcRenderer.invoke("session:delete", sessionId) as Promise<void>,
  deleteProject: (sessionId) => ipcRenderer.invoke("project:delete", sessionId) as Promise<void>,
  loadHistory: (sessionId) => ipcRenderer.invoke("session:history", sessionId) as Promise<ChatMessage[]>,
  saveSettings: (input: { settings: AppSettings; apiKey?: string; clearApiKey?: boolean }) =>
    ipcRenderer.invoke("settings:save", input),
  sendMessage: (sessionId, text) => ipcRenderer.invoke("session:send", { sessionId, text }),
  stopSession: (sessionId) => ipcRenderer.invoke("session:stop", sessionId),
  resolvePermission: (requestId, allow) => ipcRenderer.invoke("permission:resolve", { requestId, allow }),
  onEvent(callback) {
    const listener = (_event: Electron.IpcRendererEvent, payload: AppEvent) => callback(payload);
    ipcRenderer.on("app:event", listener);
    return () => ipcRenderer.removeListener("app:event", listener);
  },
};

contextBridge.exposeInMainWorld("claudeStudio", bridge);
