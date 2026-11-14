"use strict";
const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  session,
  systemPreferences,
  globalShortcut,
  dialog,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Transport } = require("./client/transport.cjs");
const { NativeInput } = require("./client/native.cjs");
const { validateInput } = require("./shared/input.cjs");
let window,
  transport,
  current = null,
  selected = null,
  generation = 0,
  accepting = false;
let pendingRequest = null;
let quitting = false, sending = 0, inputWindow = 0, inputCount = 0;
const native = new NativeInput();
const rendererURL =
  pathToFileURL(path.join(__dirname, "renderer/index.html")).href;
async function screenSources(thumbnailSize) {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
  });
  if (process.platform !== "win32") return sources;
  const primary = String(screen.getPrimaryDisplay().id);
  return sources.filter((source) => source.display_id === primary);
}
const emit = (event) => {
  if (window && !window.isDestroyed()) {
    window.webContents.send("desk:event", event);
  }
};
async function stopSession() {
  current = null;
  selected = null;
  accepting = false;
  pendingRequest = null;
  emit({ type: "local-ended" });
  await native.stop();
}
async function offline() {
  generation++;
  const old = transport;
  transport = null;
  await stopSession();
  if (old) {
    try {
      await old.request("/unregister", {});
    } catch {
    } finally {
      old.close();
    }
  }
}
async function cancel() {
  await stopSession();
  if (transport) await transport.request("/cancel", {});
}
native.onFailure = () => {
  void cancel().catch(() => {});
  emit({ type: "failure", message: "键鼠控制组件已停止，会话已断开" });
};
async function poll(client, run) {
  while (transport === client && generation === run) {
    try {
      const result = await client.request("/events", undefined, "GET");
      if (transport !== client || generation !== run) return;
      if (!Array.isArray(result.events) || !result.online) {
        throw new Error("设备已离线，请重新上线");
      }
      for (const event of result.events) {
        if (event.type === "request") {
          pendingRequest = { id: event.requestId, expires: Date.now() + 60000 };
        }
        if (event.type === "approved") {
          if (event.role === "host" && !accepting) {
            await cancel();
            continue;
          }
          current = {
            id: event.sessionId,
            role: event.role,
            control: event.control,
          };
          accepting = false;
        }
        if (event.type === "ended" || event.type === "rejected") {
          await stopSession();
        }
        if (event.type === "signal" && current?.id !== event.sessionId) {
          continue;
        }
        emit(event);
      }
    } catch (error) {
      if (transport !== client || generation !== run) return;
      emit({ type: "failure", message: error.message });
      await offline();
      return;
    }
  }
}
function handle(name, fn) {
  ipcMain.handle(`desk:${name}`, async (event, ...args) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame?.url !== rendererURL
    ) throw new Error("调用来源无效");
    return fn(...args);
  });
}
handle("online", async (value) => {
  if (
    !value || typeof value.address !== "string" || value.address.length > 300 ||
    typeof value.fingerprint !== "string" || value.fingerprint.length > 120 ||
    typeof value.name !== "string" || value.name.length > 60
  ) throw new Error("配置格式无效");
  await offline();
  const client = new Transport(value.address, value.fingerprint);
  const run = ++generation;
  transport = client;
  try {
    const device = await client.request("/register", { name: value.name });
    if (transport !== client || generation !== run) {
      throw new Error("上线已取消");
    }
    if (
      !/^\d{9}$/.test(device.code) ||
      !/^[A-Za-z0-9_-]{43}$/.test(device.token) ||
      !/^[A-Za-z0-9_-]{12}$/.test(device.password)
    ) throw new Error("信令服务返回无效设备");
    client.token = device.token;
    void poll(client, run);
    return { code: device.code, password: device.password };
  } catch (error) {
    if (transport === client) transport = null;
    client.close();
    throw error;
  }
});
handle("offline", offline);
handle("connect", async (value) => {
  if (!transport || current) throw new Error("请先上线并结束现有会话");
  if (
    !value || typeof value.code !== "string" ||
    typeof value.password !== "string"
  ) throw new Error("连接参数无效");
  return transport.request("/connect", {
    code: value.code.replace(/\s/g, ""),
    password: value.password,
  });
});
handle("displays", async () => {
  const sources = await screenSources({ width: 240, height: 135 });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    image: source.thumbnail.toDataURL(),
  }));
});
handle("prepare", async (value) => {
  if (
    !transport || current || !pendingRequest ||
    Date.now() > pendingRequest.expires ||
    value?.requestId !== pendingRequest.id || typeof value.sourceId !== "string"
  ) throw new Error("连接请求已失效");
  const sources = await screenSources({ width: 0, height: 0 });
  selected = sources.find((source) => source.id === value.sourceId) || null;
  if (!selected) throw new Error("请选择可共享的显示器");
  return true;
});
handle("decide", async (value) => {
  if (
    !transport || current || !value || typeof value.requestId !== "string" ||
    typeof value.accept !== "boolean" || typeof value.control !== "boolean"
  ) throw new Error("连接请求无效");
  if (value.accept) {
    const sources = await screenSources({ width: 0, height: 0 });
    const source = sources.find((item) => item.id === value.sourceId);
    const display = screen.getAllDisplays().find((item) =>
      String(item.id) === source?.display_id
    );
    if (!source || !display) throw new Error("请选择可共享的显示器");
    if (value.control) {
      if (
        process.platform === "darwin" &&
        !systemPreferences.isTrustedAccessibilityClient(false)
      ) {
        systemPreferences.isTrustedAccessibilityClient(true);
        throw new Error("请在系统设置中授权 LinkDesk 的辅助功能，然后重新连接");
      }
      await native.start(display);
    }
    selected = source;
    accepting = true;
  }
  try {
    return await transport.request("/decide", {
      requestId: value.requestId,
      accept: value.accept,
      control: value.control,
    });
  } catch (error) {
    await stopSession();
    throw error;
  }
});
handle("signal", async (value) => {
  if (!transport || !current || value?.sessionId !== current.id) {
    throw new Error("会话已结束");
  }
  if (sending >= 64) throw new Error("信令队列已满");
  sending++;
  try {
    return await transport.request("/signal", value);
  } finally {
    sending--;
  }
});
handle("input", async (value) => {
  if (
    !current || current.role !== "host" || !current.control ||
    value?.sessionId !== current.id
  ) return false;
  const event = validateInput(value.event);
  if (!event) return false;
  const now = Date.now();
  if (now - inputWindow > 1000) {
    inputWindow = now;
    inputCount = 0;
  }
  if (++inputCount > 300) {
    await cancel();
    throw new Error("键鼠消息过于频繁，会话已断开");
  }
  try {
    native.write(event);
    return true;
  } catch (error) {
    await cancel();
    throw error;
  }
});
handle("cancel", cancel);
handle("geometry", (value) => {
  if (!value || !value.rect) return null;
  const { videoPoint } = require("./shared/input.cjs");
  return videoPoint(value.rect, value.width, value.height, value.x, value.y);
});
app.whenReady().then(() => {
  window = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 780,
    minHeight: 600,
    title: "LinkDesk",
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", () => {
    void offline();
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission) =>
    contents === window.webContents && permission === "media" &&
    (current?.role === "host" ||
      Boolean(
        selected && pendingRequest && Date.now() <= pendingRequest.expires,
      ))
  );
  session.defaultSession.setPermissionRequestHandler((
    contents,
    permission,
    callback,
  ) =>
    callback(
      contents === window.webContents && permission === "media" &&
        (current?.role === "host" ||
          Boolean(
            selected && pendingRequest && Date.now() <= pendingRequest.expires,
          )),
    )
  );
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (
      request.frame?.url !== rendererURL || !selected ||
      !(current?.role === "host" ||
        (pendingRequest && Date.now() <= pendingRequest.expires))
    ) callback({});
    else callback({ video: selected });
  });
  globalShortcut.register("CommandOrControl+Shift+Escape", () => {
    void cancel().catch(() => {});
  });
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    void offline().finally(() => app.quit());
  });
  return window.loadFile(path.join(__dirname, "renderer/index.html"));
}).catch((error) => {
  dialog.showErrorBox("LinkDesk 启动失败", error.message);
  app.quit();
});
app.on("before-quit", (event) => {
  globalShortcut.unregisterAll();
  if (!quitting) {
    event.preventDefault();
    quitting = true;
    void offline().finally(() => app.quit());
  }
});
app.on("window-all-closed", () => app.quit());
