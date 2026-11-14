"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { root } = require("./tools.cjs");
const directory = path.join(root, ".local");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const key = path.join(directory, "key.pem"),
  cert = path.join(directory, "cert.pem");
if (fs.existsSync(key) || fs.existsSync(cert)) {
  throw new Error(
    "证书已存在，拒绝覆盖；如需轮换请移走 .local/key.pem 和 cert.pem",
  );
}
const result = spawnSync("openssl", [
  "req",
  "-x509",
  "-newkey",
  "rsa:3072",
  "-sha256",
  "-nodes",
  "-keyout",
  key,
  "-out",
  cert,
  "-days",
  "30",
  "-subj",
  "/CN=LinkDesk Development",
], { encoding: "utf8", timeout: 30000 });
if (result.status !== 0) {
  for (const file of [key, cert]) fs.rmSync(file, { force: true });
  throw new Error("生成证书失败，请安装 OpenSSL 或使用已有的 TLS 证书");
}
fs.chmodSync(key, 0o600);
fs.chmodSync(cert, 0o600);
console.log(`本地证书已生成：${cert}`);
console.log(
  `SHA-256：${new X509Certificate(fs.readFileSync(cert)).fingerprint256}`,
);
