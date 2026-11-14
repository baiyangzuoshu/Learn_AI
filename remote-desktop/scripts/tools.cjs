"use strict";
const path = require("node:path");
const fs = require("node:fs");
const root = path.join(__dirname, "..");
function tool(name) {
  for (
    const base of [
      path.join(root, "node_modules"),
      path.join(root, "../typescript/electron/node_modules"),
    ]
  ) {
    const location = path.join(base, name);
    if (fs.existsSync(path.join(location, "package.json"))) return location;
  }
  throw new Error(`缺少 ${name}，请在 remote-desktop 目录运行 npm install`);
}
module.exports = { root, tool };
