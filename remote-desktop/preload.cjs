"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const call = (name) => (...args) => ipcRenderer.invoke(`desk:${name}`, ...args);
contextBridge.exposeInMainWorld("desk", {
  online: call("online"),
  offline: call("offline"),
  connect: call("connect"),
  displays: call("displays"),
  prepare: call("prepare"),
  decide: call("decide"),
  signal: call("signal"),
  input: call("input"),
  cancel: call("cancel"),
  geometry: call("geometry"),
  onEvent(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("desk:event", listener);
    return () => ipcRenderer.removeListener("desk:event", listener);
  },
});
