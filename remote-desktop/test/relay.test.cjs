"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Relay } = require("../server/relay.cjs");
function fixture() {
  let time = 0;
  const relay = new Relay({ now: () => time });
  const host = relay.dispatch("/register", { name: "Mac" }, null, "mac");
  const viewer = relay.dispatch(
    "/register",
    { name: "Windows" },
    null,
    "windows",
  );
  const outsider = relay.dispatch(
    "/register",
    { name: "Third device" },
    null,
    "other",
  );
  return {
    relay,
    host,
    viewer,
    outsider,
    tick: (value) => {
      time += value;
    },
  };
}
test("approval is required before signals; only the two approved devices can signal", () => {
  const { relay, host, viewer, outsider } = fixture();
  const request = relay.dispatch("/connect", {
    code: host.code,
    password: host.password,
  }, viewer.token);
  const incoming = relay.auth(host.token).queue[0];
  assert.equal(incoming.type, "request");
  assert.equal(incoming.requestId, request.requestId);
  assert.equal(relay.sessions.size, 0);
  assert.throws(() =>
    relay.dispatch("/signal", {
      sessionId: request.requestId,
      signal: { type: "offer", sdp: "test" },
    }, viewer.token)
  );
  assert.throws(() =>
    relay.dispatch(
      "/decide",
      { ...request, accept: true, control: true },
      outsider.token,
    )
  );
  relay.dispatch(
    "/decide",
    { ...request, accept: true, control: true },
    host.token,
  );
  const id = relay.auth(host.token).session;
  assert.equal(relay.auth(viewer.token).session, id);
  assert.throws(() =>
    relay.dispatch("/signal", {
      sessionId: id,
      signal: { type: "offer", sdp: "test" },
    }, outsider.token)
  );
  assert.throws(() =>
    relay.dispatch("/signal", {
      sessionId: id,
      signal: { type: "offer", sdp: "test" },
    }, viewer.token)
  );
  relay.dispatch("/signal", {
    sessionId: id,
    signal: { type: "offer", sdp: "test" },
  }, host.token);
  assert.equal(relay.auth(viewer.token).queue.at(-1).signal.sdp, "test");
  relay.dispatch("/cancel", {}, viewer.token);
  assert.equal(relay.sessions.size, 0);
  assert.throws(() =>
    relay.dispatch("/signal", {
      sessionId: id,
      signal: { type: "offer", sdp: "test" },
    }, host.token)
  );
});
test("wrong credentials, self connection, overlapping requests and replays are rejected", () => {
  const { relay, host, viewer, outsider } = fixture();
  assert.throws(() =>
    relay.dispatch(
      "/connect",
      { code: host.code, password: "wrong" },
      viewer.token,
    )
  );
  assert.throws(() =>
    relay.dispatch(
      "/connect",
      { code: host.code, password: host.password },
      host.token,
    )
  );
  const request = relay.dispatch("/connect", {
    code: host.code,
    password: host.password,
  }, viewer.token);
  assert.throws(() =>
    relay.dispatch(
      "/connect",
      { code: host.code, password: host.password },
      outsider.token,
    )
  );
  relay.dispatch(
    "/decide",
    { ...request, accept: false, control: false },
    host.token,
  );
  assert.throws(() =>
    relay.dispatch(
      "/decide",
      { ...request, accept: true, control: true },
      host.token,
    )
  );
  assert.equal(relay.auth(viewer.token).queue.at(-1).type, "rejected");
});
test("expiry stops active sessions and clears pending requests", () => {
  const { relay, host, viewer, tick } = fixture();
  const request = relay.dispatch("/connect", {
    code: host.code,
    password: host.password,
  }, viewer.token);
  relay.dispatch(
    "/decide",
    { ...request, accept: true, control: false },
    host.token,
  );
  tick(46000);
  relay.auth(host.token);
  relay.sweep();
  assert.equal(relay.sessions.size, 0);
  assert.equal(relay.devices.size, 1);
  assert.equal(relay.auth(host.token).queue.at(-1).type, "ended");
  assert.throws(() => relay.auth(viewer.token));
});
test("password guessing is rate limited and credentials rotate on registration", () => {
  const { relay, host, viewer } = fixture();
  for (let i = 0; i < 10; i++) {
    assert.throws(() =>
      relay.dispatch(
        "/connect",
        { code: host.code, password: "wrong" },
        viewer.token,
        "same-ip",
      )
    );
  }
  assert.throws(
    () =>
      relay.dispatch(
        "/connect",
        { code: host.code, password: host.password },
        viewer.token,
        "same-ip",
      ),
    (error) => error.status === 429,
  );
  relay.dispatch("/unregister", {}, host.token);
  assert.throws(() => relay.auth(host.token));
  const next = relay.dispatch("/register", { name: "Mac" }, null, "new-ip");
  assert.notEqual(next.password, host.password);
  assert.notEqual(next.token, host.token);
});
test("overflowing signal output disconnects the session instead of retaining unlimited output", () => {
  const { relay, host, viewer } = fixture();
  const request = relay.dispatch("/connect", {
    code: host.code,
    password: host.password,
  }, viewer.token);
  relay.dispatch(
    "/decide",
    { ...request, accept: true, control: true },
    host.token,
  );
  const remote = relay.auth(viewer.token);
  for (let i = 0; i < 257; i++) relay.push(remote, { type: "signal" });
  assert.equal(relay.sessions.size, 0);
  assert.throws(() => relay.auth(viewer.token));
});
