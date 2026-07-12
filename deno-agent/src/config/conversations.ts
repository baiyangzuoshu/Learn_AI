import { getWorkspace } from "./settings.ts";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}
export interface ConversationSession {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
}

const MAX_SESSIONS = 100;
const MAX_MESSAGES_PER_SESSION = 500;
const MAX_CONTENT_LENGTH = 100_000;

async function conversationsPath(workspace: string): Promise<string> {
  const home = Deno.env.get("HOME");
  if (!home) throw new Error("HOME is unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace));
  const id = [...new Uint8Array(digest)].slice(0, 12).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${home}/Library/Application Support/DenoAgent/conversations/${id}.json`;
}

function validateSessions(value: unknown): ConversationSession[] {
  if (!Array.isArray(value)) throw new Error("sessions must be an array");
  if (value.length > MAX_SESSIONS) throw new Error(`最多保存 ${MAX_SESSIONS} 个对话`);
  return value.map((raw, sessionIndex) => {
    if (!raw || typeof raw !== "object") throw new Error(`sessions[${sessionIndex}] 无效`);
    const session = raw as Record<string, unknown>;
    const id = String(session.id ?? ""), title = String(session.title ?? "").trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new Error(`sessions[${sessionIndex}].id 无效`);
    if (!title || title.length > 200) throw new Error(`sessions[${sessionIndex}].title 无效`);
    if (!Array.isArray(session.messages) || session.messages.length > MAX_MESSAGES_PER_SESSION) {
      throw new Error(`sessions[${sessionIndex}].messages 无效`);
    }
    const messages = session.messages.map((rawMessage, messageIndex) => {
      if (!rawMessage || typeof rawMessage !== "object") {
        throw new Error(`sessions[${sessionIndex}].messages[${messageIndex}] 无效`);
      }
      const message = rawMessage as Record<string, unknown>;
      const role = String(message.role ?? "");
      const content = String(message.content ?? "");
      if (role !== "user" && role !== "assistant") throw new Error("消息角色无效");
      if (content.length > MAX_CONTENT_LENGTH) throw new Error("单条消息内容过长");
      return { role, content } as ConversationMessage;
    });
    const createdAt = Number(session.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) throw new Error("对话时间无效");
    return { id, title, messages, createdAt };
  });
}

export async function readConversations(): Promise<ConversationSession[]> {
  const path = await conversationsPath(await getWorkspace());
  try {
    return validateSessions(JSON.parse(await Deno.readTextFile(path)));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return [];
    throw error;
  }
}

export async function saveConversations(value: unknown): Promise<ConversationSession[]> {
  const sessions = validateSessions(value);
  const path = await conversationsPath(await getWorkspace());
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await Deno.writeTextFile(temporary, `${JSON.stringify(sessions, null, 2)}\n`);
  await Deno.rename(temporary, path);
  return sessions;
}
