"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { Transport } = require("../client/transport.cjs");
const { Relay, createHandler } = require("../server/relay.cjs");
test("HTTPS pair, approve, exchange signals, cancel and unregister across two real clients", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "linkdesk-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const certPath = path.join(directory, "cert.pem"),
    keyPath = path.join(directory, "key.pem");
  const result = spawnSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "1",
    "-subj",
    "/CN=test",
  ], { timeout: 20000 });
  assert.equal(result.status, 0, "OpenSSL fixture generation");
  const cert = fs.readFileSync(certPath), key = fs.readFileSync(keyPath);
  const pin = new X509Certificate(cert).fingerprint256;
  const relay = new Relay();
  let requests = 0;
  const handler = createHandler(relay);
  const server = https.createServer({ cert, key }, (request, response) => {
    requests++;
    void handler(request, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    relay.close();
    server.closeAllConnections();
    server.close();
  });
  const address = `https://127.0.0.1:${server.address().port}`;
  const host = new Transport(address, pin),
    viewer = new Transport(address, pin);
  t.after(() => {
    host.close();
    viewer.close();
  });
  const h = await host.request("/register", { name: "macOS" });
  host.token = h.token;
  const v = await viewer.request("/register", { name: "Windows" });
  viewer.token = v.token;
  const request = await viewer.request("/connect", {
    code: h.code,
    password: h.password,
  });
  const incoming = await host.request("/events", undefined, "GET");
  assert.equal(incoming.events[0].requestId, request.requestId);
  await host.request("/decide", { ...request, accept: true, control: true });
  const approved = await viewer.request("/events", undefined, "GET");
  const id = approved.events[0].sessionId;
  await host.request("/signal", {
    sessionId: id,
    signal: { type: "offer", sdp: "mock-sdp" },
  });
  const signal = await viewer.request("/events", undefined, "GET");
  assert.equal(signal.events[0].signal.sdp, "mock-sdp");
  await viewer.request("/cancel", {});
  assert.equal(relay.sessions.size, 0);
  await viewer.request("/unregister", {});
  assert.throws(() => relay.auth(v.token));
  const before = requests;
  const bad = new Transport(address, "00".repeat(32));
  t.after(() => bad.close());
  await assert.rejects(
    bad.request("/register", { name: "must-not-arrive" }),
    /指纹不匹配/,
  );
  assert.equal(
    requests,
    before,
    "No HTTP request is sent before TLS pin verification",
  );
  const trustedOnly = new Transport(address, "");
  t.after(() => trustedOnly.close());
  await assert.rejects(
    trustedOnly.request("/register", { name: "must-not-arrive" }),
  );
  assert.throws(() => new Transport("http://127.0.0.1:9443", ""));
});
