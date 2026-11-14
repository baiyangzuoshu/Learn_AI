"use strict";
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { X509Certificate } = require("node:crypto");
const { Relay, createHandler } = require("./relay.cjs");
const cert = fs.readFileSync(
  process.env.LINKDESK_CERT || path.join(__dirname, "../.local/cert.pem"),
);
const key = fs.readFileSync(
  process.env.LINKDESK_KEY || path.join(__dirname, "../.local/key.pem"),
);
const host = process.env.LINKDESK_HOST || "127.0.0.1";
const port = Number(process.env.LINKDESK_PORT || 9443);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("端口无效");
}
const relay = new Relay();
const server = https.createServer(
  { cert, key, minVersion: "TLSv1.2" },
  createHandler(relay),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
const timer = setInterval(() => relay.sweep(), 5000);
timer.unref();
server.listen(port, host, () => {
  console.log(`LinkDesk 信令服务：https://${host}:${port}`);
  console.log(`证书 SHA-256：${new X509Certificate(cert).fingerprint256}`);
});
function close() {
  clearInterval(timer);
  relay.close();
  server.close();
  server.closeAllConnections();
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
