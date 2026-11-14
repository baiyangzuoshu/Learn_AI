"use strict";
// Only physical keys explicitly supported by both native bridges are admitted.
const codes = new Set([
  ...Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  "Enter",
  "Escape",
  "Backspace",
  "Tab",
  "Space",
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Backquote",
  "Comma",
  "Period",
  "Slash",
  "CapsLock",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Delete",
  "Insert",
]);
function validateInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;
  if (value.type === "reset") return { type: "reset" };
  if (
    value.type === "key" && codes.has(value.code) &&
    typeof value.down === "boolean"
  ) {
    return { type: "key", code: value.code, down: value.down };
  }
  if (value.type === "move" && finite(value.x, 0, 1) && finite(value.y, 0, 1)) {
    return { type: "move", x: value.x, y: value.y };
  }
  if (
    value.type === "button" && Number.isInteger(value.button) &&
    value.button >= 0 && value.button <= 2 && typeof value.down === "boolean"
  ) {
    return { type: "button", button: value.button, down: value.down };
  }
  if (value.type === "wheel" && finite(value.delta, -1200, 1200)) {
    return { type: "wheel", delta: Math.round(value.delta) };
  }
  return null;
}
// Map the displayed video rectangle, excluding object-fit letterboxes.
function videoPoint(rect, width, height, x, y) {
  if (!(width > 0 && height > 0 && rect.width > 0 && rect.height > 0)) {
    return null;
  }
  const scale = Math.min(rect.width / width, rect.height / height);
  const w = width * scale, h = height * scale;
  const left = rect.left + (rect.width - w) / 2;
  const top = rect.top + (rect.height - h) / 2;
  if (x < left || x > left + w || y < top || y > top + h) return null;
  return {
    x: Math.max(0, Math.min(1, (x - left) / w)),
    y: Math.max(0, Math.min(1, (y - top) / h)),
  };
}
module.exports = { validateInput, videoPoint };
