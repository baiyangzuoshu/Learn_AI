"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const { tool, root } = require("./tools.cjs");
require("./build.cjs");
const electron = require(tool("electron"));
const child = spawn(electron, [path.join(root, "dist")], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
