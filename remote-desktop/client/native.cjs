"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const nativePath = (file) =>
  path.join(__dirname, "../native", file)
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
class NativeInput {
  constructor(spawnProcess = spawn) {
    this.spawnProcess = spawnProcess;
    this.expectedStops = new WeakSet();
    this.child = null;
    this.stopping = Promise.resolve();
  }
  async start(display) {
    await this.stop();
    let command, args;
    if (process.platform === "darwin") {
      command = nativePath("input-macos");
      args = [String(display.id)];
    } else if (process.platform === "win32") {
      command = path.join(
        process.env.SystemRoot || "C:\\Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      );
      args = [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        nativePath("input-windows.ps1"),
        "-DisplayX",
        String(Math.round(display.bounds.x * display.scaleFactor)),
        "-DisplayY",
        String(Math.round(display.bounds.y * display.scaleFactor)),
        "-DisplayWidth",
        String(Math.round(display.bounds.width * display.scaleFactor)),
        "-DisplayHeight",
        String(Math.round(display.bounds.height * display.scaleFactor)),
      ];
    } else throw new Error("键鼠控制仅支持 macOS 与 Windows");
    const child = this.spawnProcess(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    child.stdin.on("error", () => {});
    await new Promise((resolve, reject) => {
      let ready = false, output = "";
      const timer = setTimeout(
        () => reject(new Error("键鼠控制组件启动超时")),
        15000,
      );
      const fail = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      child.once(
        "error",
        () => fail(new Error("键鼠控制组件不可用，请先构建应用")),
      );
      child.once("exit", () => {
        if (this.child === child) this.child = null;
        if (!ready) {
          fail(
            new Error(
              "键鼠控制组件启动失败；macOS 请授权辅助功能，Windows 请检查脚本执行策略",
            ),
          );
        } else if (!this.expectedStops.has(child)) this.onFailure?.();
      });
      child.stderr.on("data", () => {}); // Never accumulate unbounded diagnostics.
      child.stdout.on("data", (chunk) => {
        output += chunk.toString().replace(/\r/g, "");
        if (output.length > 4096) {
          child.kill();
          return;
        }
        if (!ready && output.includes("READY\n")) {
          ready = true;
          clearTimeout(timer);
          resolve();
        }
      });
    }).catch(async (error) => {
      await this.stop();
      throw error;
    });
  }
  write(event) {
    if (
      !this.child || this.child.killed ||
      this.child.stdin.writableLength > 32768
    ) throw new Error("键鼠控制组件不可用");
    this.child.stdin.write(`${JSON.stringify(event)}\n`);
  }
  stop() {
    const child = this.child;
    this.child = null;
    if (!child) return this.stopping;
    this.expectedStops.add(child);
    this.stopping = new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve();
      }, 750);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      if (child.stdin.writable && !child.stdin.destroyed) {
        child.stdin.end('{"type":"reset"}\n');
      } else child.kill();
    });
    return this.stopping;
  }
}
module.exports = { NativeInput };
