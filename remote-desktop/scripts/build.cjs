"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { root } = require("./tools.cjs");
fs.mkdirSync(path.join(root, ".local"), { recursive: true, mode: 0o700 });
if (process.platform === "darwin") {
  const result = spawnSync("swiftc", [
    path.join(root, "native/input-macos.swift"),
    "-O",
    "-module-cache-path",
    path.join(root, ".local/swift-cache"),
    "-o",
    path.join(root, ".local/input-macos"),
  ], { stdio: "inherit", timeout: 120000 });
  if (result.status !== 0) process.exit(result.status || 1);
}
const output = path.join(root, "dist");
fs.mkdirSync(output, { recursive: true });
for (
  const name of [
    "main.cjs",
    "preload.cjs",
    "client",
    "shared",
    "renderer",
    "native",
  ]
) {
  fs.cpSync(path.join(root, name), path.join(output, name), {
    recursive: true,
  });
}
if (process.platform === "darwin") {
  fs.copyFileSync(
    path.join(root, ".local/input-macos"),
    path.join(output, "native/input-macos"),
  );
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
fs.writeFileSync(
  path.join(output, "package.json"),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      main: manifest.main,
      author: "LinkDesk",
      private: true,
    },
    null,
    2,
  ),
);
console.log(`LinkDesk 构建完成：${output}`);
