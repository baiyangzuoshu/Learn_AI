"use strict";
const { randomBytes, randomInt, createHash, timingSafeEqual } = require(
  "node:crypto",
);
const MAX_BODY = 80 * 1024;
const token = () => randomBytes(32).toString("base64url");
const digest = (value) => createHash("sha256").update(value).digest();
class Relay {
  constructor({ now = Date.now, maxDevices = 200, maxAge = 45000 } = {}) {
    this.now = now;
    this.maxDevices = maxDevices;
    this.maxAge = maxAge;
    this.devices = new Map();
    this.tokens = new Map();
    this.requests = new Map();
    this.sessions = new Map();
    this.attempts = new Map();
  }
  fail(message, status = 400) {
    throw Object.assign(new Error(message), { status });
  }
  push(device, event) {
    if (!device || !this.devices.has(device.code)) return;
    const bytes = Buffer.byteLength(JSON.stringify(event));
    if (device.queue.length >= 64 || device.queueBytes + bytes > 512 * 1024) {
      this.remove(device);
      return;
    }
    device.queueBytes += bytes;
    device.queue.push(event);
    device.notify?.();
  }
  endSession(id, reason) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    for (const code of [session.host, session.viewer]) {
      const device = this.devices.get(code);
      if (device) {
        device.session = null;
        this.push(device, { type: "ended", sessionId: id, reason });
      }
    }
  }
  remove(device) {
    this.endSession(device.session, "设备已离线");
    for (const [id, request] of this.requests) {
      if (request.host === device.code || request.viewer === device.code) {
        this.requests.delete(id);
        this.push(
          this.devices.get(
            request.host === device.code ? request.viewer : request.host,
          ),
          { type: "rejected", requestId: id, reason: "设备已离线" },
        );
      }
    }
    this.devices.delete(device.code);
    this.tokens.delete(device.token);
    device.notify?.();
  }
  sweep() {
    for (const device of this.devices.values()) {
      if (this.now() - device.seen > this.maxAge) this.remove(device);
    }
    for (const [id, request] of this.requests) {
      if (this.now() > request.expires) {
        this.requests.delete(id);
        for (const code of [request.host, request.viewer]) {
          this.push(this.devices.get(code), {
            type: "rejected",
            requestId: id,
            reason: "连接请求已超时",
          });
        }
      }
    }
    for (const [key, attempt] of this.attempts) {
      if (this.now() - attempt.start > 60000) this.attempts.delete(key);
    }
  }
  auth(bearer) {
    const device = this.tokens.get(bearer);
    if (!device || !this.devices.has(device.code)) {
      this.fail("设备凭证已失效，请重新上线", 401);
    }
    device.seen = this.now();
    return device;
  }
  pending(device) {
    return [...this.requests.values()].some((r) =>
      r.host === device.code || r.viewer === device.code
    );
  }
  dispatch(path, input, bearer, ip = "") {
    this.sweep();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      this.fail("请求格式错误");
    }
    if (path === "/register") {
      if (this.devices.size >= this.maxDevices) this.fail("设备容量已满", 503);
      if (
        typeof input.name !== "string" || !input.name.trim() ||
        input.name.length > 60
      ) this.fail("设备名无效");
      const key = `register:${ip}`;
      this.rate(key, 12);
      let code;
      do {
        code = String(randomInt(100000000, 999999999));
      } while (this.devices.has(code));
      const password = randomBytes(9).toString("base64url");
      const device = {
        code,
        token: token(),
        passwordHash: digest(password),
        name: input.name.trim(),
        seen: this.now(),
        queue: [],
        queueBytes: 0,
        session: null,
        notify: null,
      };
      this.devices.set(code, device);
      this.tokens.set(device.token, device);
      return { code, password, token: device.token };
    }
    const device = this.auth(bearer);
    if (path === "/unregister") {
      this.remove(device);
      return { ok: true };
    }
    if (path === "/connect") {
      if (
        typeof input.code !== "string" || !/^\d{9}$/.test(input.code) ||
        typeof input.password !== "string" || input.password.length > 64
      ) this.fail("连接参数无效");
      this.rate(`connect:${ip}`, 10);
      this.rate(`target:${input.code}`, 10);
      const host = this.devices.get(input.code);
      if (
        !host || !timingSafeEqual(host.passwordHash, digest(input.password))
      ) this.fail("设备离线或临时密码不正确", 403);
      if (host === device) this.fail("请选择另一台设备");
      if (
        host.session || device.session || this.pending(host) ||
        this.pending(device)
      ) this.fail("设备已有会话或连接请求", 409);
      const id = token();
      this.requests.set(id, {
        host: host.code,
        viewer: device.code,
        expires: this.now() + 60000,
      });
      this.push(host, {
        type: "request",
        requestId: id,
        viewerName: device.name,
        viewerCode: device.code,
      });
      return { requestId: id };
    }
    if (path === "/decide") {
      const request = this.requests.get(input.requestId);
      if (
        !request || request.host !== device.code ||
        typeof input.accept !== "boolean" ||
        typeof input.control !== "boolean"
      ) this.fail("连接请求无效");
      const viewer = this.devices.get(request.viewer);
      this.requests.delete(input.requestId);
      if (!input.accept || !viewer) {
        this.push(viewer, {
          type: "rejected",
          requestId: input.requestId,
          reason: "被控端拒绝了连接",
        });
        return { ok: true };
      }
      const id = token();
      const session = {
        id,
        host: device.code,
        viewer: viewer.code,
        control: input.control,
        count: 0,
        window: this.now(),
      };
      this.sessions.set(id, session);
      device.session = id;
      viewer.session = id;
      this.push(device, {
        type: "approved",
        role: "host",
        sessionId: id,
        control: input.control,
      });
      this.push(viewer, {
        type: "approved",
        role: "viewer",
        sessionId: id,
        control: input.control,
      });
      return { ok: true };
    }
    if (path === "/cancel") {
      for (const [id, request] of this.requests) {
        if (request.viewer === device.code || request.host === device.code) {
          this.requests.delete(id);
          for (const code of [request.host, request.viewer]) {
            this.push(this.devices.get(code), {
              type: "rejected",
              requestId: id,
              reason: "连接请求已取消",
            });
          }
        }
      }
      this.endSession(device.session, "会话已断开");
      return { ok: true };
    }
    if (path === "/signal") {
      const session = this.sessions.get(input.sessionId);
      if (
        !session || device.session !== session.id ||
        ![session.host, session.viewer].includes(device.code)
      ) this.fail("会话无效", 403);
      const signal = input.signal;
      if (!signal || !["offer", "answer", "candidate"].includes(signal.type)) {
        this.fail("信令无效");
      }
      if (signal.type === "candidate") {
        if (
          !signal.candidate || typeof signal.candidate.candidate !== "string" ||
          signal.candidate.candidate.length > 4096 ||
          !["string", "object"].includes(typeof signal.candidate.sdpMid) ||
          !(signal.candidate.sdpMid === null ||
            typeof signal.candidate.sdpMid === "string") ||
          !(signal.candidate.sdpMLineIndex === null ||
            Number.isInteger(signal.candidate.sdpMLineIndex))
        ) this.fail("ICE 参数无效");
      } else if (
        typeof signal.sdp !== "string" || signal.sdp.length > 65536 ||
        (signal.type === "offer" && device.code !== session.host) ||
        (signal.type === "answer" && device.code !== session.viewer)
      ) this.fail("SDP 参数无效");
      if (this.now() - session.window > 1000) {
        session.window = this.now();
        session.count = 0;
      }
      if (++session.count > 100) this.fail("信令发送过快", 429);
      const peer = this.devices.get(
        device.code === session.host ? session.viewer : session.host,
      );
      this.push(peer, { type: "signal", sessionId: session.id, signal });
      return { ok: true };
    }
    this.fail("未知操作", 404);
  }
  rate(key, limit) {
    const value = this.attempts.get(key) || { start: this.now(), count: 0 };
    if (this.attempts.size >= 10000 && !this.attempts.has(key)) {
      this.fail("服务繁忙", 503);
    }
    value.count++;
    this.attempts.set(key, value);
    if (value.count > limit) this.fail("请求过于频繁，请稍后重试", 429);
  }
  close() {
    for (const device of [...this.devices.values()]) this.remove(device);
  }
}
function createHandler(relay) {
  return async (request, response) => {
    const send = (status, value) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(JSON.stringify(value));
    };
    try {
      // This service is a remote signaling endpoint, never a renderer's local HTTP API.
      if (request.headers.origin) {
        return send(403, { error: "不接受浏览器来源请求" });
      }
      const path = new URL(request.url, "https://relay.invalid").pathname;
      const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
        request.headers.authorization || "",
      )?.[1];
      if (request.method === "GET" && path === "/events") {
        relay.sweep();
        const device = relay.auth(bearer);
        if (device.notify) return send(409, { error: "已有事件订阅" });
        let timer;
        const cleanup = () => {
          clearTimeout(timer);
          if (device.notify === finish) device.notify = null;
        };
        const finish = () => {
          cleanup();
          device.queueBytes = 0;
          send(200, {
            events: device.queue.splice(0),
            online: relay.devices.has(device.code),
          });
        };
        timer = setTimeout(finish, 20000);
        device.notify = finish;
        response.once("close", cleanup);
        if (device.queue.length) finish();
        return;
      }
      if (request.method !== "POST") return send(405, { error: "方法不允许" });
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY) {
          send(413, { error: "请求过大" });
          request.destroy();
          return;
        }
        chunks.push(chunk);
      }
      let input;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return send(400, { error: "JSON 格式错误" });
      }
      send(
        200,
        relay.dispatch(path, input, bearer, request.socket.remoteAddress),
      );
    } catch (error) {
      send(error.status || 500, {
        error: error.status ? error.message : "服务内部错误",
      });
    }
  };
}
module.exports = { Relay, createHandler };
