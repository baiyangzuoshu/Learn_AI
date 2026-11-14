"use strict";
const { app } = require("electron");
const path = require("node:path");
const https = require("node:https");
const fs = require("node:fs");
const { X509Certificate } = require("node:crypto");
const { Relay, createHandler } = require("../server/relay.cjs");
app.setPath("userData", path.join(__dirname, "../.local/main-smoke-profile"));
const cert = fs.readFileSync(path.join(__dirname, "../.local/cert.pem"));
const key = fs.readFileSync(path.join(__dirname, "../.local/key.pem"));
const fingerprint = new X509Certificate(cert).fingerprint256;
const relay = new Relay();
const server = https.createServer({ cert, key }, createHandler(relay));
const timer = setTimeout(() => {
  console.error("Main smoke timed out");
  relay.close();
  server.close();
  app.exit(1);
}, 20000);
server.listen(0, "127.0.0.1", () => {
  const address = `https://127.0.0.1:${server.address().port}`;
  app.once("browser-window-created", (_event, window) => {
    window.hide();
    window.webContents.once("did-finish-load", async () => {
      try {
        const result = await window.webContents.executeJavaScript(
          `(async () => {
          const device=await window.desk.online(${
            JSON.stringify({ address, fingerprint, name: "IPC smoke" })
          });
          const valid=/^\\d{9}$/.test(device.code)&&device.password.length===12;
          await window.desk.offline();return valid;
        })()`,
        );
        if (!result || relay.devices.size !== 0) {
          throw new Error("Registration or cleanup failed");
        }
        console.log(
          "PASS: shipped main/preload/renderer IPC, HTTPS registration and offline cleanup",
        );
        clearTimeout(timer);
        relay.close();
        server.closeAllConnections();
        server.close();
        app.quit();
      } catch (error) {
        clearTimeout(timer);
        console.error(error.message);
        relay.close();
        server.closeAllConnections();
        server.close();
        app.exit(1);
      }
    });
  });
  require("../dist/main.cjs");
});
