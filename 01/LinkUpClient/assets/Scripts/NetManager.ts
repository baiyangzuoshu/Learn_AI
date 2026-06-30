import { encodePacket, decodePacket } from './protocol';

type PendingReq = { resolve: (data: Uint8Array) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

export default class NetManager {
  private static _instance: NetManager | null = null;
  public static get Instance(): NetManager {
    if (!NetManager._instance) NetManager._instance = new NetManager();
    return NetManager._instance;
  }

  private wsUrl = 'ws://127.0.0.1:17886';
  private ws: WebSocket | null = null;
  private connected = false;
  private connecting: Promise<void> | null = null;
  private msgId = 0;
  private pending = new Map<number, PendingReq>();
  private pushHandlers = new Map<string, (data: Uint8Array) => void>();
  private onConnected: (() => void) | null = null;

  set onConnect(cb: (() => void) | null) { this.onConnected = cb; }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        this.connecting = null;
        reject(err);
      };
      try { this.ws = new WebSocket(this.wsUrl); } catch (e) { fail(e as Error); return; }
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.connected = true;
        this.connecting = null;
        console.warn('[NetManager] connected');
        this.onConnected?.();
        resolve();
      };
      this.ws.onmessage = (e) => this.onMessage(e.data as ArrayBuffer);
      this.ws.onclose = () => {
        if (!this.connected) fail(new Error('closed'));
        this.connected = false;
        this.connecting = null;
        this.rejectAll('closed');
      };
      this.ws.onerror = () => { if (!this.connected) fail(new Error('connect failed')); };
    });
    return this.connecting;
  }

  disconnect() {
    this.ws?.close(); this.ws = null; this.connected = false;
    this.connecting = null;
    this.rejectAll('disconnect');
  }

  isConnected(): boolean { return this.connected; }

  request(route: string, data: Uint8Array, timeout = 10000): Promise<Uint8Array> {
    const mid = ++this.msgId;
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) { reject(new Error('not connected')); return; }
      const timer = setTimeout(() => { this.pending.delete(mid); reject(new Error(`timeout: ${route}`)); }, timeout);
      this.pending.set(mid, { resolve, reject, timer });
      this.ws!.send(encodePacket({ msg_id: mid, route, data }));
    });
  }

  send(route: string, data: Uint8Array) {
    if (this.ws && this.connected) this.ws.send(encodePacket({ msg_id: 0, route, data }));
  }

  onPush(route: string, h: (data: Uint8Array) => void) { this.pushHandlers.set(route, h); }
  offPush(route: string) { this.pushHandlers.delete(route); }

  private onMessage(raw: ArrayBuffer) {
    try {
      const pkt = decodePacket(new Uint8Array(raw));
      if (pkt.msg_id && pkt.msg_id > 0) {
        const p = this.pending.get(pkt.msg_id);
        if (p) { clearTimeout(p.timer); this.pending.delete(pkt.msg_id); if (pkt.data) p.resolve(pkt.data); else p.reject(new Error('empty')); }
      } else if (pkt.route && pkt.data) {
        const h = this.pushHandlers.get(pkt.route);
        h?.(pkt.data);
      }
    } catch (e) { console.warn('[NetManager] msg err:', e); }
  }

  private rejectAll(reason: string) {
    for (const [mid, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pending.clear();
  }
}
