"use strict";
const https = require("node:https");
const tls = require("node:tls");
const { createHash } = require("node:crypto");
function normalizeFingerprint(value) {
  if (typeof value !== "string") throw new Error("证书指纹格式错误");
  const pin = value.replace(/:/g, "").trim().toLowerCase();
  if (pin && !/^[a-f0-9]{64}$/.test(pin)) {
    throw new Error("请输入完整的 SHA-256 证书指纹");
  }
  return pin;
}
class PinnedAgent extends https.Agent {
  constructor(pin) {
    super({ keepAlive: true, maxSockets: 4 });
    this.pin = pin;
  }
  createConnection(options, callback) {
    let done = false;
    const finish = (error, socket) => {
      if (done) return;
      done = true;
      callback(error, socket);
    };
    const socket = tls.connect({ ...options, rejectUnauthorized: false });
    socket.setTimeout(10000, () => socket.destroy(new Error("TLS 握手超时")));
    socket.once("error", (error) => finish(error));
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const actual = cert.raw
        ? createHash("sha256").update(cert.raw).digest("hex")
        : "";
      if (actual !== this.pin) {
        const error = new Error("信令服务证书指纹不匹配");
        socket.destroy(error);
        finish(error);
        return;
      }
      socket.setTimeout(0);
      finish(null, socket);
    });
    // Callback only after pin verification, before HTTP credentials can be sent.
  }
}
class Transport {
  constructor(address, fingerprint) {
    const url = new URL(address);
    if (
      url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash
    ) throw new Error("请输入 HTTPS 信令服务地址，不含路径或凭证");
    this.base = url.origin;
    const pin = normalizeFingerprint(fingerprint);
    this.agent = pin
      ? new PinnedAgent(pin)
      : new https.Agent({ keepAlive: true, maxSockets: 4 });
    this.token = null;
    this.requests = new Set();
    this.closed = false;
  }
  request(path, body, method = "POST") {
    if (this.closed) return Promise.reject(new Error("连接已关闭"));
    const text = body === undefined ? null : JSON.stringify(body);
    if (text && Buffer.byteLength(text) > 80 * 1024) {
      return Promise.reject(new Error("信令数据过大"));
    }
    return new Promise((resolve, reject) => {
      const request = https.request(`${this.base}${path}`, {
        method,
        agent: this.agent,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(text
            ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(text),
            }
            : {}),
        },
      }, (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            response.destroy(new Error("信令响应过大"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (response.statusCode !== 200) {
              throw new Error(value.error || "信令服务请求失败");
            }
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      });
      this.requests.add(request);
      request.once("close", () => this.requests.delete(request));
      request.on("error", reject);
      request.setTimeout(
        25000,
        () => request.destroy(new Error("信令服务响应超时")),
      );
      if (text) request.write(text);
      request.end();
    });
  }
  close() {
    this.closed = true;
    for (const request of this.requests) {
      request.destroy(new Error("连接已关闭"));
    }
    this.requests.clear();
    this.agent.destroy();
    this.token = null;
  }
}
module.exports = { Transport, normalizeFingerprint };
