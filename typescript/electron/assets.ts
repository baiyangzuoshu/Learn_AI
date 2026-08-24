import { readFile } from "node:fs/promises";
import { join } from "node:path";

const files: Record<string, { file: string; contentType: string }> = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" },
  "/settings.css": { file: "settings.css", contentType: "text/css; charset=utf-8" },
  "/stream.css": { file: "stream.css", contentType: "text/css; charset=utf-8" },
  "/developer.css": { file: "developer.css", contentType: "text/css; charset=utf-8" },
  "/todo.css": { file: "todo.css", contentType: "text/css; charset=utf-8" },
  "/subagent.css": { file: "subagent.css", contentType: "text/css; charset=utf-8" },
  "/skill.css": { file: "skill.css", contentType: "text/css; charset=utf-8" },
  "/layout.css": { file: "layout.css", contentType: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", contentType: "text/javascript; charset=utf-8" },
  "/app-icon.png": { file: "app-icon.png", contentType: "image/png" },
};

export async function loadDesktopAssets(root: string): Promise<Map<string, { body: BodyInit; contentType: string }>> {
  const assets = new Map<string, { body: BodyInit; contentType: string }>();
  for (const [url, asset] of Object.entries(files)) {
    assets.set(url, { body: await readFile(join(root, asset.file)), contentType: asset.contentType });
  }
  return assets;
}
