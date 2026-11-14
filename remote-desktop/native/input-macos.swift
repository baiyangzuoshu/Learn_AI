import Foundation
import CoreGraphics
import ApplicationServices

let keyCodes: [String: CGKeyCode] = [
    "KeyA": 0, "KeyS": 1, "KeyD": 2, "KeyF": 3, "KeyH": 4, "KeyG": 5,
    "KeyZ": 6, "KeyX": 7, "KeyC": 8, "KeyV": 9, "KeyB": 11, "KeyQ": 12,
    "KeyW": 13, "KeyE": 14, "KeyR": 15, "KeyY": 16, "KeyT": 17,
    "Digit1": 18, "Digit2": 19, "Digit3": 20, "Digit4": 21, "Digit6": 22,
    "Digit5": 23, "Equal": 24, "Digit9": 25, "Digit7": 26, "Minus": 27,
    "Digit8": 28, "Digit0": 29, "BracketRight": 30, "KeyO": 31, "KeyU": 32,
    "BracketLeft": 33, "KeyI": 34, "KeyP": 35, "Enter": 36, "KeyL": 37,
    "KeyJ": 38, "Quote": 39, "KeyK": 40, "Semicolon": 41, "Backslash": 42,
    "Comma": 43, "Slash": 44, "KeyN": 45, "KeyM": 46, "Period": 47,
    "Tab": 48, "Space": 49, "Backquote": 50, "Backspace": 51, "Escape": 53,
    "MetaRight": 54, "MetaLeft": 55, "ShiftLeft": 56, "CapsLock": 57,
    "AltLeft": 58, "ControlLeft": 59, "ShiftRight": 60, "AltRight": 61,
    "ControlRight": 62, "F5": 96, "F6": 97, "F7": 98, "F3": 99,
    "F8": 100, "F9": 101, "F11": 103, "F10": 109, "F12": 111,
    "Insert": 114, "Home": 115, "PageUp": 116, "Delete": 117, "F4": 118,
    "End": 119, "F2": 120, "PageDown": 121, "F1": 122,
    "ArrowLeft": 123, "ArrowRight": 124, "ArrowDown": 125, "ArrowUp": 126,
]
guard CommandLine.arguments.count == 2,
      let display = UInt32(CommandLine.arguments[1]),
      CGDisplayIsActive(display) != 0,
      AXIsProcessTrusted() else { exit(2) }
let bounds = CGDisplayBounds(display)
var position = CGPoint(x: bounds.midX, y: bounds.midY)
var keys = Set<String>()
var buttons = Set<Int>()
let source = CGEventSource(stateID: .hidSystemState)
func flags() -> CGEventFlags {
    var value: CGEventFlags = []
    if keys.contains("ShiftLeft") || keys.contains("ShiftRight") { value.insert(.maskShift) }
    if keys.contains("ControlLeft") || keys.contains("ControlRight") { value.insert(.maskControl) }
    if keys.contains("AltLeft") || keys.contains("AltRight") { value.insert(.maskAlternate) }
    if keys.contains("MetaLeft") || keys.contains("MetaRight") { value.insert(.maskCommand) }
    return value
}
func key(_ code: String, _ down: Bool) {
    guard let keyCode = keyCodes[code] else { return }
    if down { keys.insert(code) } else { keys.remove(code) }
    let event = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: down)
    event?.flags = flags(); event?.post(tap: .cghidEventTap)
}
func button(_ index: Int, _ down: Bool) {
    let mouse: CGMouseButton = index == 0 ? .left : (index == 2 ? .right : .center)
    let type: CGEventType = index == 0 ? (down ? .leftMouseDown : .leftMouseUp)
        : (index == 2 ? (down ? .rightMouseDown : .rightMouseUp) : (down ? .otherMouseDown : .otherMouseUp))
    if down { buttons.insert(index) } else { buttons.remove(index) }
    let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: position, mouseButton: mouse)
    event?.flags = flags(); event?.post(tap: .cghidEventTap)
}
func reset() {
    for code in Array(keys) { key(code, false) }
    for index in Array(buttons) { button(index, false) }
}
defer { reset() }
print("READY"); fflush(stdout)
while let line = readLine() {
    guard line.utf8.count <= 1024,
          let data = line.data(using: .utf8),
          let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let type = value["type"] as? String else { continue }
    switch type {
    case "reset": reset()
    case "key":
        if let code = value["code"] as? String, let down = value["down"] as? Bool { key(code, down) }
    case "button":
        if let index = value["button"] as? Int, (0...2).contains(index), let down = value["down"] as? Bool { button(index, down) }
    case "move":
        if let x = value["x"] as? Double, let y = value["y"] as? Double,
           x.isFinite, y.isFinite, (0...1).contains(x), (0...1).contains(y) {
            position = CGPoint(x: bounds.minX + x * max(0, bounds.width - 1),
                               y: bounds.minY + y * max(0, bounds.height - 1))
            let index = buttons.contains(0) ? 0 : (buttons.contains(2) ? 2 : 1)
            let mouse: CGMouseButton = index == 0 ? .left : (index == 2 ? .right : .center)
            let type: CGEventType = buttons.isEmpty ? .mouseMoved
                : (index == 0 ? .leftMouseDragged : (index == 2 ? .rightMouseDragged : .otherMouseDragged))
            let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: position, mouseButton: mouse)
            event?.flags = flags(); event?.post(tap: .cghidEventTap)
        }
    case "wheel":
        if let delta = value["delta"] as? Int, (-1200...1200).contains(delta) {
            let event = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 1,
                                wheel1: Int32(-delta), wheel2: 0, wheel3: 0)
            event?.flags = flags(); event?.post(tap: .cghidEventTap)
        }
    default: break
    }
}
