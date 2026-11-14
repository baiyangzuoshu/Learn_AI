"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const { root, tool } = require("./tools.cjs");
require("./build.cjs");
const target = process.argv[2];
if (!["mac", "win"].includes(target)) throw new Error("目标应为 mac 或 win");
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
process.env.ELECTRON_BUILDER_CACHE = path.join(root, ".local/builder-cache");
const electron = JSON.parse(
  require("node:fs").readFileSync(
    path.join(tool("electron"), "package.json"),
  ),
).version;
const builder = require(path.join(tool("electron-builder"), "out/index.js"));
const options = {
  projectDir: path.join(root, "dist"),
  config: {
    appId: "com.linkdesk.prototype",
    productName: "LinkDesk",
    electronVersion: electron,
    directories: { output: path.join(root, "releases") },
    files: ["**/*"],
    asar: true,
    asarUnpack: ["native/**"],
    mac: {
      target: [{ target: "dir", arch: ["arm64"] }],
      category: "public.app-category.utilities",
      extendInfo: {
        NSScreenCaptureUsageDescription: "仅在你允许连接后共享选中的屏幕。",
      },
    },
    win: {
      target: [{ target: "nsis", arch: ["x64"] }],
      signAndEditExecutable: false,
    },
    nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  },
  targets: target === "mac"
    ? builder.Platform.MAC.createTarget(["dir"], builder.Arch.arm64)
    : builder.Platform.WINDOWS.createTarget(["nsis"], builder.Arch.x64),
};
const localRuntime = path.join(tool("electron"), "dist");
if (
  target === "mac" && process.platform === "darwin" &&
  require("node:fs").existsSync(path.join(localRuntime, "Electron.app"))
) {
  options.config.electronDist = localRuntime;
}
if (target === "win") {
  const fs = require("node:fs");
  const zip = path.join(root, `.local/electron-v${electron}-win32-x64.zip`);
  if (fs.existsSync(zip)) {
    const { createHash } = require("node:crypto");
    const checksums = JSON.parse(
      fs.readFileSync(path.join(tool("electron"), "checksums.json")),
    );
    const expected = checksums[path.basename(zip)];
    const actual = createHash("sha256").update(fs.readFileSync(zip)).digest(
      "hex",
    );
    if (!expected || actual !== expected) {
      throw new Error("本地 Windows Electron 校验失败");
    }
    options.config.electronDist = zip;
  }
  for (
    const [variable, local] of [["ELECTRON_BUILDER_NSIS_DIR", "nsis"], [
      "ELECTRON_BUILDER_NSIS_RESOURCES_DIR",
      "nsis-resources",
    ], ["ELECTRON_BUILDER_7ZIP_PATH", "7zip/bin/7za"]]
  ) {
    const file = path.join(root, ".local", local);
    if (fs.existsSync(file)) process.env[variable] = file;
  }
}
builder.build(options).then(async (artifacts) => {
  console.log(artifacts.join("\n"));
  if (target === "mac") {
    const bundle = path.join(root, "releases/mac-arm64/LinkDesk.app");
    await new Promise((resolve, reject) => {
      const child = spawn("codesign", [
        "--force",
        "--deep",
        "--sign",
        "-",
        bundle,
      ], { stdio: "inherit" });
      child.on("error", reject);
      child.on(
        "exit",
        (code) => code === 0 ? resolve() : reject(new Error("签名失败")),
      );
    });
    await new Promise((resolve, reject) => {
      const child = spawn("codesign", [
        "--verify",
        "--deep",
        "--strict",
        bundle,
      ], { stdio: "inherit" });
      child.on("error", reject);
      child.on(
        "exit",
        (code) => code === 0 ? resolve() : reject(new Error("签名校验失败")),
      );
    });
    console.log(bundle);
  }
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
