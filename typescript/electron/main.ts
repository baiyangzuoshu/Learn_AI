import { app, BrowserWindow, dialog, safeStorage } from "electron";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  setAppDataPath,
  setFolderChooser,
  setPermissionPrompt,
  setSecretStore,
} from "../src/platform.ts";
import { shutdownMcpSessions } from "../src/mod.ts";
import { desktopAssets } from "./desktop-assets.ts";
import { startHttpServer } from "../desktop/http.ts";

const appRoot = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function configurePlatform(): void {
  app.setPath("userData", join(app.getPath("appData"), "AIAgent"));
  setAppDataPath(app.getPath("userData"));
  setSecretStore({
    async get(service, account) {
      if (!safeStorage.isEncryptionAvailable()) return undefined;
      const path = join(
        app.getPath("userData"),
        "secrets",
        `${createHash("sha256").update(`${service}:${account}`).digest("hex")}.bin`,
      );
      try {
        const { readFile } = await import("node:fs/promises");
        return safeStorage.decryptString(await readFile(path));
      } catch {
        return undefined;
      }
    },
    async set(service, account, value) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全凭据存储不可用");
      const { mkdir, writeFile } = await import("node:fs/promises");
      const path = join(
        app.getPath("userData"),
        "secrets",
        `${createHash("sha256").update(`${service}:${account}`).digest("hex")}.bin`,
      );
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, safeStorage.encryptString(value));
    },
  });
  setPermissionPrompt((message) =>
    dialog.showMessageBoxSync({
      type: "warning",
      buttons: ["拒绝", "允许"],
      defaultId: 0,
      cancelId: 0,
      title: "AI Agent 请求权限",
      message,
    }) === 1
  );
  setFolderChooser(async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择 AI Agent 工作目录",
    });
    return result.canceled ? undefined : result.filePaths[0];
  });
}

async function createWindow(): Promise<void> {
  const server = startHttpServer(await desktopAssets(join(appRoot, "renderer")));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Electron 本地服务启动失败");
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "AI Agent",
    webPreferences: {
      preload: join(appRoot, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.on("closed", () => server.close());
  await window.loadURL(`http://127.0.0.1:${address.port}/`);
  if (isDev) window.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(async () => {
  configurePlatform();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

let shuttingDown = false;
app.on("before-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;
  void shutdownMcpSessions().finally(() => app.quit());
});
