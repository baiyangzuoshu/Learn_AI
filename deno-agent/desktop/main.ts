import { type AgentEvent, agentLoop } from "../stages/s08_context_compact.ts";
import type { PermissionMode } from "../stages/s03_permission.ts";
import {
  chooseWorkspace,
  getPublicSettings,
  getWorkspace,
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
  ["/stream.css", {
    body: await Deno.readTextFile(new URL("./renderer/stream.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/developer.css", {
    body: await Deno.readTextFile(new URL("./renderer/developer.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/todo.css", {
    body: await Deno.readTextFile(new URL("./renderer/todo.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/subagent.css", {
    body: await Deno.readTextFile(new URL("./renderer/subagent.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/skill.css", {
    body: await Deno.readTextFile(new URL("./renderer/skill.css", import.meta.url)),
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
  if (url.pathname === "/api/health") return json({ ok: true, stage: "s08" });
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
  if (url.pathname === "/api/file/open" && request.method === "POST") {
    try {
      const { path } = await request.json();
      const workspace = await getWorkspace();
      const target = await Deno.realPath(path.startsWith("/") ? path : `${workspace}/${path}`);
      const root = await Deno.realPath(workspace);
      if (target !== root && !target.startsWith(`${root}/`)) {
        throw new Error("文件不在当前工作目录中");
      }
      await new Deno.Command("/usr/bin/open", { args: [target] }).output();
      return json({ ok: true });
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
        permissionMode?: PermissionMode;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };
      if (!body.message?.trim()) return json({ error: "message is required" }, 400);
      const events: AgentEvent[] = [];
      const answer = await agentLoop(
        body.message,
        (event) => events.push(event),
        body.model,
        body.history ?? [],
        body.permissionMode ?? "ask",
      );
      return json({ answer, events });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  if (url.pathname === "/api/chat/stream" && request.method === "POST") {
    const body = await request.json() as {
      message?: string;
      model?: string;
      permissionMode?: PermissionMode;
      developerMode?: boolean;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    let streamClosed = false;
    return new Response(
      new ReadableStream({
        start(controller) {
          const emit = (data: unknown) => {
            if (streamClosed) return;
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
            } catch {
              streamClosed = true;
              abortController.abort();
            }
          };
          const close = () => {
            if (streamClosed) return;
            streamClosed = true;
            try {
              controller.close();
            } catch { /* consumer already disconnected */ }
          };
          emit({ type: "status", message: "正在分析任务…" });
          agentLoop(
            body.message ?? "",
            (event) => emit({ type: "tool", event }),
            body.model,
            body.history ?? [],
            body.permissionMode ?? "ask",
            abortController.signal,
            (event) => {
              if (body.developerMode) emit({ type: "hook", event });
            },
          )
            .then((answer) => {
              emit({ type: "status", message: "正在组织答案…" });
              emit({ type: "answer", answer });
              emit({ type: "done" });
              close();
            })
            .catch((error) => {
              emit({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
              });
              close();
            });
        },
        cancel() {
          streamClosed = true;
          abortController.abort();
        },
      }),
      {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache",
        },
      },
    );
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
