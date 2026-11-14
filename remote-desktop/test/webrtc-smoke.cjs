"use strict";
// Run with Electron; verifies actual Chromium video and control data transport.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
app.setPath("userData", path.join(__dirname, "../.local/smoke-profile"));
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1120,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "../preload.cjs"),
    },
  });
  const timer = setTimeout(() => {
    console.error("WebRTC smoke timed out");
    app.exit(1);
  }, 20000);
  try {
    await window.loadFile(path.join(__dirname, "../renderer/index.html"));
    // UI markup and layout are the shipped ones; network IPC isn't exposed in this fixture.
    const screenshot = await window.webContents.capturePage();
    fs.writeFileSync(
      path.join(__dirname, "../.local/preview.png"),
      screenshot.toPNG(),
    );
    const result = await window.webContents.executeJavaScript(`(async () => {
      const host = new RTCPeerConnection({iceServers:[]});
      const viewer = new RTCPeerConnection({iceServers:[]});
      const candidates = {host:[],viewer:[]};
      host.onicecandidate = e => { if(e.candidate) { if(viewer.remoteDescription) viewer.addIceCandidate(e.candidate); else candidates.viewer.push(e.candidate); } };
      viewer.onicecandidate = e => { if(e.candidate) { if(host.remoteDescription) host.addIceCandidate(e.candidate); else candidates.host.push(e.candidate); } };
      const canvas = document.createElement('canvas'); canvas.width=320; canvas.height=180;
      const ctx=canvas.getContext('2d'); let frame=0;
      const draw=setInterval(()=>{ctx.fillStyle=frame++%2?'#98f4c4':'#111827';ctx.fillRect(0,0,320,180)},33);
      const stream=canvas.captureStream(30); stream.getTracks().forEach(track=>host.addTrack(track,stream));
      const input=host.createDataChannel('input');
      const control = new Promise(resolve => { viewer.ondatachannel=e=>{e.channel.onmessage=m=>resolve(JSON.parse(m.data));}; });
      const video=document.createElement('video'); video.autoplay=true; video.muted=true; document.body.append(video);
      const picture = new Promise(resolve => { viewer.ontrack=e=>{ video.srcObject=e.streams[0]; video.onloadeddata=()=>resolve({width:video.videoWidth,height:video.videoHeight}); }; });
      const offer=await host.createOffer(); await host.setLocalDescription(offer); await viewer.setRemoteDescription(offer);
      for(const candidate of candidates.viewer) await viewer.addIceCandidate(candidate);
      const answer=await viewer.createAnswer(); await viewer.setLocalDescription(answer); await host.setRemoteDescription(answer);
      for(const candidate of candidates.host) await host.addIceCandidate(candidate);
      await new Promise(resolve=>{if(input.readyState==='open')resolve();else input.onopen=resolve;});
      input.send(JSON.stringify({type:'key',code:'KeyA',down:true}));
      const data=await control; const dimensions=await picture;
      clearInterval(draw); stream.getTracks().forEach(track=>track.stop());host.close();viewer.close();video.remove();
      return {data,dimensions};
    })()`);
    if (
      result.data.code !== "KeyA" || result.dimensions.width !== 320 ||
      result.dimensions.height !== 180
    ) throw new Error("WebRTC payload mismatch");
    console.log(
      `PASS: Chromium WebRTC video ${result.dimensions.width}x${result.dimensions.height}; input DataChannel`,
    );
    clearTimeout(timer);
    window.destroy();
    app.quit();
  } catch (error) {
    clearTimeout(timer);
    console.error(error.message);
    app.exit(1);
  }
});
