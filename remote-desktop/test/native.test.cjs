"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { NativeInput } = require("../client/native.cjs");
const display = {
  id: 1,
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  scaleFactor: 1,
};
test("intentional native shutdown releases stdin and does not report a crash", async () => {
  let child, resetReceived = false;
  const native = new NativeInput((_command, _args, options) => {
    child = spawn(process.execPath, [
      "-e",
      `
      console.log('READY');
      let text='';process.stdin.on('data', chunk=>{text+=chunk});
      process.stdin.on('end',()=>{console.log(text.includes('reset')?'RELEASED':'MISSING');process.exit(0)});
    `,
    ], options);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("RELEASED")) resetReceived = true;
    });
    return child;
  });
  let crashed = false;
  native.onFailure = () => {
    crashed = true;
  };
  await native.start(display);
  await native.stop();
  assert.equal(resetReceived, true);
  assert.equal(crashed, false);
  assert.equal(child.exitCode, 0);
});
test("cancelling a helper before readiness settles startup and terminates the process", async () => {
  let spawned;
  const started = new Promise((resolve) => {
    spawned = resolve;
  });
  const native = new NativeInput((_command, _args, options) => {
    const child = spawn(process.execPath, [
      "-e",
      "process.stdin.resume();process.stdin.on('end',()=>process.exit(0))",
    ], options);
    spawned(child);
    return child;
  });
  const startup = native.start(display);
  const rejected = assert.rejects(startup, /启动失败/);
  const child = await started;
  await native.stop();
  await rejected;
  assert.equal(child.exitCode, 0);
  assert.equal(native.child, null);
});
