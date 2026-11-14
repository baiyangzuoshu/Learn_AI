"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateInput, videoPoint } = require("../shared/input.cjs");
test("remote input admits only bounded typed events and removes extra fields", () => {
  for (
    const value of [
      null,
      [],
      { type: "shell", command: "anything" },
      { type: "key", code: "UnrecognizedKey", down: true },
      { type: "key", code: "KeyA", down: "true" },
      { type: "move", x: NaN, y: 0 },
      { type: "move", x: -1, y: 0 },
      { type: "move", x: 0, y: 1.01 },
      { type: "wheel", delta: 1201 },
      { type: "button", button: 3, down: true },
    ]
  ) assert.equal(validateInput(value), null);
  assert.deepEqual(
    validateInput({
      type: "key",
      code: "KeyA",
      down: true,
      command: "ignored",
    }),
    { type: "key", code: "KeyA", down: true },
  );
});
test("mouse mapping excludes letterboxes and maps edges of scaled screens correctly", () => {
  const rect = { left: 10, top: 20, width: 800, height: 600 };
  assert.equal(videoPoint(rect, 1920, 1080, 400, 21), null);
  assert.deepEqual(videoPoint(rect, 1920, 1080, 410, 320), { x: 0.5, y: 0.5 });
  assert.deepEqual(videoPoint(rect, 1920, 1080, 10, 95), { x: 0, y: 0 });
  assert.deepEqual(videoPoint(rect, 1920, 1080, 810, 545), { x: 1, y: 1 });
  assert.equal(videoPoint(rect, 0, 1080, 400, 300), null);
});
