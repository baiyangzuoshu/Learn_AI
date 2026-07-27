import { listCronSchedules, runCronSchedule, saveCronSchedules } from "../src/harness/mod.ts";
import { providerTelemetry } from "../src/providers/openai_compatible.ts";
import { readConversations, saveConversations } from "../src/config/conversations.ts";
import {
  chooseWorkspace,
  getPublicSettings,
  removeWorkspace,
  revealApiKey,
  revealApiKeys,
  saveSettings,
  saveUpdateSettings,
  selectWorkspace,
  settingsFilePath,
} from "../src/config/settings.ts";
import { type ChatRequest, createChatStream, runChat } from "./services/chat.ts";
import { readWorkspaceGit } from "./services/git.ts";
import { APP_VERSION, checkForUpdate, installUpdateAndRestart } from "./services/updater.ts";
import { openWorkspaceFile, readWorkspaceTree } from "./services/workspace.ts";

type StaticAssets = ReadonlyMap<string, { body: BodyInit; contentType: string }>;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function errorResponse(error: unknown, status = 400): Response {
  return json({ error: error instanceof Error ? error.message : String(error) }, status);
}

async function routeApi(request: Request, url: URL): Promise<Response | undefined> {
  if (url.pathname === "/api/health") {
    return json({ ok: true, stage: "s20", version: APP_VERSION, capabilities: 20 });
  }
  if (url.pathname === "/api/telemetry") return json(providerTelemetry());
  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json(await getPublicSettings());
  }
  if (url.pathname === "/api/settings/key" && request.method === "GET") {
    return json({ apiKey: await revealApiKey(), apiKeys: await revealApiKeys() });
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
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.deepseek.com",
    },
  });
}

export function startHttpServer(assets: StaticAssets): Deno.HttpServer {
  return Deno.serve((request) => handleRequest(request, assets));
}

export async function handleRequest(request: Request, assets: StaticAssets): Promise<Response> {
  const url = new URL(request.url);
  return await routeApi(request, url) ??
    serveAsset(url, assets) ??
    new Response("Not found", { status: 404 });
}
