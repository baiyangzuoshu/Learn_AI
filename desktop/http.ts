import { listCronSchedules, runCronSchedule, saveCronSchedules } from "../src/mod.ts";
import { providerTelemetry } from "../src/providers/openai_compatible.ts";
import { readConversations, saveConversations } from "../src/config/conversations.ts";
import {
  chooseWorkspace,
  getPublicSettings,
  removeWorkspace,
  saveSettings,
  saveUpdateSettings,
  selectWorkspace,
  settingsFilePath,
} from "../src/config/settings.ts";
import { type ChatRequest, createChatStream, runChat } from "./services/chat.ts";
import { readWorkspaceGit } from "./services/git.ts";
import { APP_VERSION, checkForUpdate, installUpdateAndRestart } from "./services/updater.ts";
import { openWorkspaceFile, readWorkspaceImage, readWorkspaceTree } from "./services/workspace.ts";
import { runRuntimeBudgetAcceptance } from "./services/acceptance.ts";
import { readProviderBalance } from "./services/balance.ts";
import { listLessonTests, runLessonAcceptance } from "./services/lesson_tests.ts";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";

type StaticAssets = ReadonlyMap<string, { body: BodyInit; contentType: string }>;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function errorResponse(error: unknown, status = 400): Response {
  return json({ error: error instanceof Error ? error.message : String(error) }, status);
}

async function routeApi(request: Request, url: URL): Promise<Response | undefined> {
  if (url.pathname === "/api/health") {
    return json({ ok: true, stage: "s21", version: APP_VERSION, capabilities: 21 });
  }
  if (url.pathname === "/api/tests/21" && request.method === "POST") {
    return json(await runRuntimeBudgetAcceptance());
  }
  if (url.pathname === "/api/tests/lessons" && request.method === "GET") {
    return json({ suite: "21test-lessons", cases: listLessonTests() });
  }
  if (url.pathname === "/api/tests/lessons" && request.method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const lesson = body && typeof body === "object" && "lesson" in body
        ? Number((body as { lesson?: unknown }).lesson)
        : undefined;
      if (lesson !== undefined && (!Number.isInteger(lesson) || lesson < 1 || lesson > 30)) {
        return errorResponse("lesson must be an integer from 1 to 30", 400);
      }
      return json(await runLessonAcceptance(lesson));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/telemetry") return json(providerTelemetry());
  if (url.pathname === "/api/balance" && request.method === "GET") {
    try {
      return json(await readProviderBalance(url.searchParams.get("providerId") || undefined));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json(await getPublicSettings());
  }
  if (url.pathname === "/api/update/settings" && request.method === "GET") {
    const settings = await getPublicSettings();
    return json({
      version: APP_VERSION,
      settingsPath: settingsFilePath(),
      update: settings.update,
    });
  }
  if (url.pathname === "/api/update/settings" && request.method === "POST") {
    try {
      const settings = await saveUpdateSettings(await request.json());
      return json({
        version: APP_VERSION,
        settingsPath: settings.settingsPath,
        update: settings.update,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/update/check" && request.method === "POST") {
    try {
      return json(await checkForUpdate());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/update/install" && request.method === "POST") {
    try {
      return json(await installUpdateAndRestart());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/conversations" && request.method === "GET") {
    try {
      return json({ sessions: await readConversations() });
    } catch (error) {
      return errorResponse(error, 500);
    }
  }
  if (url.pathname === "/api/conversations" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ sessions: await saveConversations(body.sessions) });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "GET") {
    try {
      return json({ schedules: await listCronSchedules() });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron" && request.method === "PUT") {
    try {
      const body = await request.json();
      return json({ schedules: await saveCronSchedules(body.schedules) });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/cron/run" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await runCronSchedule(String(body.id ?? "")));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/select" && request.method === "POST") {
    try {
      return json(await chooseWorkspace());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/activate" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await selectWorkspace(body.workspace));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/remove" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await removeWorkspace(body.workspace));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/tree" && request.method === "GET") {
    try {
      return json(await readWorkspaceTree());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/workspace/image" && request.method === "GET") {
    try {
      const image = await readWorkspaceImage(url.searchParams.get("path") ?? "");
      return new Response(Buffer.from(image.body), {
        headers: {
          "content-type": image.contentType,
          "cache-control": "private, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      return errorResponse(error, 404);
    }
  }
  if (url.pathname === "/api/workspace/git" && request.method === "GET") {
    try {
      return json(await readWorkspaceGit());
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/file/open" && request.method === "POST") {
    try {
      const { path } = await request.json();
      await openWorkspaceFile(String(path ?? ""));
      return json({ ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "POST") {
    try {
      return json(await saveSettings(await request.json()));
    } catch (error) {
      return errorResponse(error);
    }
  }
  if (url.pathname === "/api/chat" && request.method === "POST") {
    try {
      const body = await request.json() as ChatRequest;
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      return json(await runChat(body));
    } catch (error) {
      return errorResponse(error, 500);
    }
  }
  if (url.pathname === "/api/chat/stream" && request.method === "POST") {
    try {
      const body = await request.json() as ChatRequest;
      return new Response(createChatStream(body), {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

function serveAsset(url: URL, assets: StaticAssets): Response | undefined {
  const asset = assets.get(url.pathname);
  if (!asset) return undefined;
  return new Response(asset.body, {
    headers: {
      "content-type": asset.contentType,
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.deepseek.com",
    },
  });
}

async function requestBody(request: IncomingMessage): Promise<Uint8Array | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function headers(request: IncomingMessage): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) result.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return result;
}

async function handleNodeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  assets: StaticAssets,
): Promise<void> {
  try {
    const body = await requestBody(request);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const webRequest = new Request(url, {
      method: request.method ?? "GET",
      headers: headers(request),
      body: body ? Buffer.from(body) : undefined,
    });
    const webResponse = await handleRequest(webRequest, assets);
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => response.setHeader(key, value));
    if (!webResponse.body) {
      response.end();
      return;
    }
    Readable.fromWeb(webResponse.body as import("node:stream/web").ReadableStream).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}

export function startHttpServer(
  assets: StaticAssets,
  options: { port?: number; host?: string } = {},
): Server {
  const server = createServer((request, response) => {
    void handleNodeRequest(request, response, assets);
  });
  server.listen(options.port ?? 0, options.host ?? "127.0.0.1");
  return server;
}

export async function handleRequest(request: Request, assets: StaticAssets): Promise<Response> {
  const url = new URL(request.url);
  return await routeApi(request, url) ??
    serveAsset(url, assets) ??
    new Response("Not found", { status: 404 });
}
