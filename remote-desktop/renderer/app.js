"use strict";
const $ = (id) => document.getElementById(id);
let device = null, pending = null, sourceId = null, rtc = null, channel = null;
let stream = null,
  active = null,
  iceCandidates = [],
  eventChain = Promise.resolve();
let iceServers = [], watchdog = null, moveAt = 0, uiEpoch = 0;
let pointerChain = Promise.resolve();
let preparedStream = null;
const status = (message, error = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
};
const message = (error) =>
  String(error.message || error).replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
async function action(fn) {
  try {
    await fn();
  } catch (error) {
    status(message(error), true);
  }
}
function reset() {
  uiEpoch++;
  clearTimeout(watchdog);
  watchdog = null;
  const old = rtc;
  rtc = null;
  channel = null;
  active = null;
  iceCandidates = [];
  if (old) {
    old.onconnectionstatechange = null;
    old.close();
  }
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  preparedStream?.getTracks().forEach((track) => track.stop());
  preparedStream = null;
  $("video").srcObject = null;
  $("videoHint").hidden = false;
  $("session").hidden = true;
  $("setup").hidden = false;
  $("request").hidden = true;
  pending = null;
  $("connectButton").disabled = !device;
}
async function disconnect(reason = "连接已结束") {
  reset();
  await window.desk.cancel();
  status(reason);
}
function parseIce() {
  const value = $("ice").value.trim();
  if (!value) return [];
  const list = JSON.parse(value);
  if (!Array.isArray(list) || list.length > 4) {
    throw new Error("连接设置需为最多 4 项的 JSON 数组");
  }
  return list.map((item) => {
    if (
      !item || typeof item.urls !== "string" || item.urls.length > 300 ||
      !/^(stun|stuns|turn|turns):[^\s]+$/.test(item.urls)
    ) throw new Error("STUN / TURN 地址无效");
    if (
      item.username !== undefined &&
      (typeof item.username !== "string" || item.username.length > 256)
    ) throw new Error("TURN 用户名无效");
    if (
      item.credential !== undefined &&
      (typeof item.credential !== "string" || item.credential.length > 256)
    ) throw new Error("TURN 凭证无效");
    return {
      urls: item.urls,
      ...(item.username ? { username: item.username } : {}),
      ...(item.credential ? { credential: item.credential } : {}),
    };
  });
}
$("onlineButton").onclick = () =>
  action(async () => {
    $("onlineButton").disabled = true;
    try {
      iceServers = parseIce();
      device = await window.desk.online({
        address: $("address").value.trim(),
        fingerprint: $("fingerprint").value.trim(),
        name: $("deviceName").value.trim(),
      });
      $("myCode").textContent = device.code.replace(
        /(\d{3})(\d{3})(\d{3})/,
        "$1 $2 $3",
      );
      $("myPassword").textContent = device.password;
      $("badge").textContent = "设备在线";
      $("badge").classList.add("online");
      $("offlineButton").disabled = false;
      $("connectButton").disabled = false;
      for (const id of ["address", "fingerprint", "deviceName", "ice"]) {
        $(id).disabled = true;
      }
      $("settings").open = false;
      status("设备已上线，等待连接");
      // Save only endpoint and public pin, never passwords or TURN credentials.
      localStorage.setItem(
        "linkdesk-config",
        JSON.stringify({
          address: $("address").value,
          fingerprint: $("fingerprint").value,
          name: $("deviceName").value,
        }),
      );
    } finally {
      if (!device) $("onlineButton").disabled = false;
    }
  });
function markOffline() {
  device = null;
  reset();
  $("badge").textContent = "未上线";
  $("badge").classList.remove("online");
  $("myCode").textContent = "— — —";
  $("myPassword").textContent = "上线后生成";
  $("onlineButton").disabled = false;
  $("offlineButton").disabled = true;
  $("connectButton").disabled = true;
  for (const id of ["address", "fingerprint", "deviceName", "ice"]) {
    $(id).disabled = false;
  }
}
$("offlineButton").onclick = () =>
  action(async () => {
    markOffline();
    await window.desk.offline();
    status("设备已下线");
  });
$("connectForm").onsubmit = (event) => {
  event.preventDefault();
  void action(async () => {
    $("connectButton").disabled = true;
    try {
      await window.desk.connect({
        code: $("targetCode").value,
        password: $("targetPassword").value,
      });
      $("targetPassword").value = "";
      $("setup").hidden = true;
      $("session").hidden = false;
      $("sessionTitle").textContent = "等待对方确认";
      $("sessionHint").textContent = "连接请求将在 60 秒后超时";
      status("已发送连接请求");
    } catch (error) {
      $("connectButton").disabled = false;
      throw error;
    }
  });
};
$("stopButton").onclick = () => action(() => disconnect());
$("rejectButton").onclick = () =>
  action(async () => {
    const request = pending;
    if (!request) return;
    await window.desk.decide({
      requestId: request.requestId,
      accept: false,
      control: false,
    });
    $("request").hidden = true;
    pending = null;
    status("已拒绝连接");
  });
$("acceptButton").onclick = () =>
  action(async () => {
    if (!pending || !sourceId) throw new Error("请选择共享屏幕");
    $("acceptButton").disabled = true;
    const request = pending;
    try {
      await window.desk.prepare({ requestId: request.requestId, sourceId });
      const captured = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      if (pending !== request) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      preparedStream = captured;
      await window.desk.decide({
        requestId: request.requestId,
        accept: true,
        control: $("allowControl").checked,
        sourceId,
      });
      $("request").hidden = true;
    } catch (error) {
      preparedStream?.getTracks().forEach((track) => track.stop());
      preparedStream = null;
      throw error;
    } finally {
      $("acceptButton").disabled = false;
    }
  });
async function requestConnection(event) {
  pending = event;
  sourceId = null;
  $("requestTitle").textContent = `${event.viewerName}（${event.viewerCode}）`;
  $("request").hidden = false;
  $("screens").replaceChildren();
  const sources = await window.desk.displays();
  if (pending !== event) return;
  for (const source of sources) {
    const option = document.createElement("label");
    option.className = "screen-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "screen";
    const image = document.createElement("img");
    image.src = source.image;
    image.alt = source.name;
    const caption = document.createElement("span");
    caption.textContent = source.name;
    option.append(image, radio, caption);
    $("screens").append(option);
    radio.onchange = () => {
      sourceId = source.id;
      document.querySelectorAll(".screen-option").forEach((node) =>
        node.classList.remove("selected")
      );
      option.classList.add("selected");
    };
    if (!sourceId) {
      radio.checked = true;
      radio.onchange();
    }
  }
  if (!sources.length) status("没有可共享屏幕，请检查系统屏幕录制权限", true);
}
function sendInput(event) {
  if (
    active?.role === "viewer" && active.control &&
    channel?.readyState === "open" && channel.bufferedAmount < 16384
  ) {
    channel.send(JSON.stringify(event));
  }
}
function attachChannel(value, state) {
  if (value.label !== "input") {
    value.close();
    return;
  }
  channel = value;
  value.onmessage = (event) => {
    if (
      active !== state || state.role !== "host" || !state.control ||
      typeof event.data !== "string" || event.data.length > 512
    ) return;
    let input;
    try {
      input = JSON.parse(event.data);
    } catch {
      return;
    }
    void window.desk.input({ sessionId: state.sessionId, event: input }).catch(
      (error) => {
        status(message(error), true);
        void disconnect("键鼠控制异常，会话已断开").catch(() => {});
      },
    );
  };
  value.onclose = () => {
    if (active === state) void disconnect("控制通道已关闭").catch(() => {});
  };
}
async function startSession(event) {
  const captured = event.role === "host" ? preparedStream : null;
  preparedStream = null;
  reset();
  active = event;
  const epoch = uiEpoch;
  $("setup").hidden = true;
  $("session").hidden = false;
  $("sessionTitle").textContent = event.role === "host"
    ? "正在共享这台电脑"
    : "远程桌面";
  $("sessionHint").textContent = "正在建立加密通道";
  $("controlHint").textContent = event.control
    ? (event.role === "host"
      ? "已允许键鼠控制 · 可随时断开"
      : "点击画面后使用键盘与鼠标")
    : "仅查看画面";
  const peer = new RTCPeerConnection({ iceServers });
  rtc = peer;
  let signaling = Promise.resolve();
  const signal = (value) => {
    signaling = signaling.then(() =>
      window.desk.signal({ sessionId: event.sessionId, signal: value })
    );
    signaling.catch((error) => {
      if (active === event) {
        status(message(error), true);
        void disconnect("连接协商失败").catch(() => {});
      }
    });
  };
  peer.onicecandidate = (result) => {
    if (result.candidate && active === event) {
      signal({ type: "candidate", candidate: result.candidate.toJSON() });
    }
  };
  peer.onconnectionstatechange = () => {
    if (active !== event) return;
    if (peer.connectionState === "connected") {
      clearTimeout(watchdog);
      watchdog = null;
      $("sessionHint").textContent = "已连接 · WebRTC 加密传输";
      status("远程连接已建立");
    } else if (["failed", "closed"].includes(peer.connectionState)) {
      void disconnect("远程连接已中断").catch(() => {});
    } else if (peer.connectionState === "disconnected" && !watchdog) {
      watchdog = setTimeout(() => {
        void disconnect("连接已超时").catch(() => {});
      }, 5000);
    }
  };
  watchdog = setTimeout(() => {
    void disconnect("无法建立连接，请检查网络或配置 TURN 服务").catch(() => {});
  }, 30000);
  peer.ontrack = (result) => {
    if (active !== event) return;
    $("video").srcObject = result.streams[0] || new MediaStream([result.track]);
    $("video").onloadeddata = () => {
      $("videoHint").hidden = true;
    };
  };
  if (event.role === "viewer") {
    peer.ondatachannel = (result) => attachChannel(result.channel, event);
    return;
  }
  attachChannel(peer.createDataChannel("input", { ordered: true }), event);
  if (!captured) throw new Error("屏幕共享尚未取得许可，请重新连接");
  if (active !== event || epoch !== uiEpoch) {
    captured.getTracks().forEach((track) => track.stop());
    return;
  }
  stream = captured;
  $("video").srcObject = stream;
  $("videoHint").hidden = true;
  for (const track of stream.getTracks()) {
    track.onended = () => {
      if (active === event) void disconnect("屏幕共享已停止").catch(() => {});
    };
    peer.addTrack(track, stream);
  }
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  signal({ type: "offer", sdp: offer.sdp });
}
async function acceptSignal(event) {
  const peer = rtc, state = active;
  if (!peer || event.sessionId !== state?.sessionId) return;
  const value = event.signal;
  if (value.type === "candidate") {
    if (!peer.remoteDescription) iceCandidates.push(value.candidate);
    else await peer.addIceCandidate(value.candidate);
  } else {
    await peer.setRemoteDescription({ type: value.type, sdp: value.sdp });
    for (const candidate of iceCandidates.splice(0)) {
      await peer.addIceCandidate(candidate);
    }
    if (value.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await window.desk.signal({
        sessionId: state.sessionId,
        signal: { type: "answer", sdp: answer.sdp },
      });
    }
  }
}
window.desk.onEvent((event) => {
  // Stop immediately, even when a capture prompt is still awaiting OS consent.
  if (event.type === "local-ended") {
    reset();
    return;
  }
  if (event.type === "failure") {
    markOffline();
    status(event.message, true);
    return;
  }
  eventChain = eventChain.then(async () => {
    if (event.type === "request") await requestConnection(event);
    else if (event.type === "approved") await startSession(event);
    else if (event.type === "signal") await acceptSignal(event);
    else if (event.type === "ended" || event.type === "rejected") {
      reset();
      status(event.reason);
    }
  }).catch(async (error) => {
    status(message(error), true);
    try {
      await disconnect("连接失败");
    } catch {}
  });
});
const video = $("video");
video.onpointermove = (event) => {
  if (
    active?.role !== "viewer" || !active.control ||
    performance.now() - moveAt < 20
  ) return;
  moveAt = performance.now();
  const rect = video.getBoundingClientRect();
  const state = active;
  void window.desk.geometry({
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    width: video.videoWidth,
    height: video.videoHeight,
    x: event.clientX,
    y: event.clientY,
  }).then((point) => {
    if (active === state && point) sendInput({ type: "move", ...point });
  });
};
video.onpointerdown = (event) => {
  event.preventDefault();
  video.focus();
  const rect = video.getBoundingClientRect(), state = active;
  pointerChain = pointerChain.then(async () => {
    const point = await window.desk.geometry({
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      width: video.videoWidth,
      height: video.videoHeight,
      x: event.clientX,
      y: event.clientY,
    });
    if (active === state && point) {
      sendInput({ type: "move", ...point });
      sendInput({ type: "button", button: event.button, down: true });
    }
  }).catch(() => {});
  video.setPointerCapture(event.pointerId);
};
video.onpointerup = (event) => {
  event.preventDefault();
  const state = active;
  pointerChain = pointerChain.then(() => {
    if (active === state) {
      sendInput({ type: "button", button: event.button, down: false });
    }
  });
};
const resetInput = () => {
  pointerChain = pointerChain.then(() => sendInput({ type: "reset" }));
};
video.onpointercancel = resetInput;
video.oncontextmenu = (event) => event.preventDefault();
video.addEventListener("wheel", (event) => {
  event.preventDefault();
  sendInput({
    type: "wheel",
    delta: Math.max(-1200, Math.min(1200, event.deltaY)),
  });
}, { passive: false });
video.onkeydown = (event) => {
  event.preventDefault();
  if (!event.repeat) sendInput({ type: "key", code: event.code, down: true });
};
video.onkeyup = (event) => {
  event.preventDefault();
  sendInput({ type: "key", code: event.code, down: false });
};
video.onblur = resetInput;
window.addEventListener("blur", resetInput);
try {
  const saved = JSON.parse(localStorage.getItem("linkdesk-config") || "null");
  if (
    saved && typeof saved.address === "string" &&
    typeof saved.fingerprint === "string" && typeof saved.name === "string"
  ) {
    $("address").value = saved.address;
    $("fingerprint").value = saved.fingerprint;
    $("deviceName").value = saved.name;
  }
} catch {}
