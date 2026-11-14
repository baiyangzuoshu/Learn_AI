export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export interface AppSettings {
  baseUrl: string;
  model: string;
  permissionMode: PermissionMode;
}

export interface SessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  createdAt: string;
  toolName?: string;
  durationMs?: number;
  activitySummary?: string;
  activityCount?: number;
}

export interface BootstrapData {
  settings: AppSettings;
  hasApiKey: boolean;
  legacyApiKeyPresent?: boolean;
  cliPath?: string;
  cliVersion?: string;
  cliError?: string;
  sessions: SessionSummary[];
}

export type AppEvent =
  | { type: "diagnostic-log"; sessionId: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
  | { type: "turn-start"; sessionId: string; userMessageId: string; assistantMessageId: string; startedAt: number; text: string }
  | { type: "text-delta"; sessionId: string; messageId: string; text: string }
  | { type: "tool-call"; sessionId: string; messageId: string; action: string; total: number; activitySummary: string }
  | { type: "permission-request"; sessionId: string; requestId: string; toolUseId: string; toolName: string; inputPreview: string }
  | { type: "turn-complete"; sessionId: string; messageId: string; durationMs: number; result: string; activitySummary?: string; activityCount?: number }
  | { type: "turn-error"; sessionId: string; messageId: string; durationMs: number; message: string; activitySummary?: string; activityCount?: number }
  | { type: "turn-stopped"; sessionId: string; messageId: string; durationMs: number; activitySummary?: string; activityCount?: number };

export interface ClaudeStudioBridge {
  getBootstrap(): Promise<BootstrapData>;
  createSession(): Promise<SessionSummary | undefined>;
  createSessionInWorkspace(sessionId: string): Promise<SessionSummary>;
  renameSession(sessionId: string, title: string): Promise<SessionSummary>;
  deleteSession(sessionId: string): Promise<void>;
  deleteProject(sessionId: string): Promise<void>;
  loadHistory(sessionId: string): Promise<ChatMessage[]>;
  saveSettings(input: {
    settings: AppSettings;
    apiKey?: string;
    clearApiKey?: boolean;
  }): Promise<{ settings: AppSettings; hasApiKey: boolean }>;
  sendMessage(sessionId: string, text: string): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
  resolvePermission(requestId: string, allow: boolean): Promise<void>;
  onEvent(callback: (event: AppEvent) => void): () => void;
}

declare global {
  interface Window {
    claudeStudio: ClaudeStudioBridge;
  }
}
