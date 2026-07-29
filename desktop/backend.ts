import { listCronSchedules } from "../src/mod.ts";

export type DesktopAsset = {
  body: BodyInit;
  contentType: string;
};

export const desktopAssets = new Map<string, DesktopAsset>([
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
  ["/layout.css", {
    body: await Deno.readTextFile(new URL("./renderer/layout.css", import.meta.url)),
    contentType: "text/css; charset=utf-8",
  }],
  ["/app.js", {
    body: await Deno.readTextFile(new URL("./renderer/app.js", import.meta.url)),
    contentType: "text/javascript; charset=utf-8",
  }],
  ["/app-icon.png", {
    body: await Deno.readFile(new URL("./assets/app-icon.png", import.meta.url)),
    contentType: "image/png",
  }],
]);

export function startDesktopBackend(): void {
  // Adopt the implicit startup window so closing the native window also stops
  // the HTTP server and agent runtime. BrowserWindow is injected by
  // `deno desktop` and is unavailable during ordinary Deno type checking.
  // @ts-ignore BrowserWindow types are injected only by `deno desktop`.
  const mainWindow = new Deno.BrowserWindow({
    title: "Deno Agent",
    width: 1280,
    height: 820,
  });
  mainWindow.addEventListener("close", () => Deno.exit(0));

  listCronSchedules().catch((error) => console.error("Unable to initialize AI schedules", error));
}
