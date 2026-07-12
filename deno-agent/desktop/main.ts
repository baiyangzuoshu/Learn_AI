import { type AgentEvent, agentLoop } from "../stages/s02_tool_use.ts";
import {
  chooseWorkspace,
  getPublicSettings,
  removeWorkspace,
  revealApiKey,
  saveSettings,
  selectWorkspace,
} from "../src/config/settings.ts";

const assets = new Map<string, { body: string; contentType: string }>([
  ["/", {
    body: await Deno.readTextFile(new URL("./renderer/index.html", import.meta.url)),
    contentType: "text/html; charset=utf-8",
  }],
  ["/styles.css", {
    body: await Deno.readTextFile(new URL("./renderer/styles.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/settings.css", {
    body: await Deno.readTextFile(new URL("./renderer/settings.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/app.js", {
    body: await Deno.readTextFile(new URL("./renderer/app.js", import.meta.url)),
    contentType: "text/javascript; charset=utf-8",
  }],
]);

// Adopt the implicit startup window so closing the native window also stops
// Deno.serve() and the agent runtime. Without this, the HTTP server keeps the
// process alive after macOS requests that the window close.
// @ts-ignore BrowserWindow types are injected only by `deno desktop`.
const mainWindow = new Deno.BrowserWindow({
  title: "Deno Agent",
  width: 1280,
  height: 820,
});
mainWindow.addEventListener("close", () => Deno.exit(0));

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, stage: "s02" });
  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json(await getPublicSettings());
  }
  if (url.pathname === "/api/settings/key" && request.method === "GET") {
    return json({ apiKey: await revealApiKey() });
  }
  if (url.pathname === "/api/workspace/select" && request.method === "POST") {
    try {
      return json(await chooseWorkspace());
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/activate" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await selectWorkspace(body.workspace));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/workspace/remove" && request.method === "POST") {
    try {
      const body = await request.json();
      return json(await removeWorkspace(body.workspace));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
  if (url.pathname === "/api/settings" && request.method === "POST") {
    try {
      return json(await saveSettings(await request.json()));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  if (url.pathname === "/api/chat" && request.method === "POST") {
    try {
      const body = await request.json() as {
        message?: string;
        model?: string;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      const events: AgentEvent[] = [];
      const answer = await agentLoop(
        body.message,
        (event) => events.push(event),
        body.model,
        body.history ?? [],
      );
      return json({ answer, events });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  const asset = assets.get(url.pathname);
  if (asset) {
    return new Response(asset.body, {
      headers: {
        "content-type": asset.contentType,
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.deepseek.com",
      },
    });
  }
  return new Response("Not found", { status: 404 });
});
