/* ===================== pack-core.ts ===================== */
/** 工具：Base64URL / UTF-8 / BitWriter & BitReader（纯 TS/JS） **/

/******** Base64URL ********/
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64Encode(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const n = (a << 16) | (b << 8) | c;
        out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + (i + 1 < bytes.length ? B64[(n >>> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
    }
    return out;
}
export function base64Decode(b64: string): Uint8Array {
    b64 = b64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b64.length % 4)) % 4; if (pad) b64 += "=".repeat(pad);
    const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
    const out: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
        const c1 = B64.indexOf(clean[i]), c2 = B64.indexOf(clean[i + 1]),
            c3 = clean[i + 2] === "=" ? 64 : B64.indexOf(clean[i + 2]),
            c4 = clean[i + 3] === "=" ? 64 : B64.indexOf(clean[i + 3]);
        const b1 = (c1 << 2) | (c2 >> 4); out.push(b1 & 255);
        if (c3 !== 64) {
            const b2 = ((c2 & 15) << 4) | (c3 >> 2); out.push(b2 & 255);
            if (c4 !== 64) { const b3 = ((c3 & 3) << 6) | c4; out.push(b3 & 255); }
        }
    }
    return new Uint8Array(out);
}
export function toBase64URL(b64: string): string {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/******** UTF-8 ********/
export function utf8Encode(str: string): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < str.length; i++) {
        let cp = str.charCodeAt(i);
        if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < str.length) {
            const next = str.charCodeAt(++i);
            if (next >= 0xDC00 && next <= 0xDFFF) cp = 0x10000 + ((cp - 0xD800) << 10) + (next - 0xDC00);
            else i--;
        }
        if (cp <= 0x7F) out.push(cp);
        else if (cp <= 0x7FF) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
        else if (cp <= 0xFFFF) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
        else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    }
    return new Uint8Array(out);
}
export function utf8Decode(bytes: Uint8Array): string {
    let i = 0, out = "";
    while (i < bytes.length) {
        const b0 = bytes[i++];
        if ((b0 & 0x80) === 0) { out += String.fromCharCode(b0); continue; }
        if ((b0 & 0xE0) === 0xC0) { const b1 = bytes[i++] & 0x3F; out += String.fromCharCode(((b0 & 0x1F) << 6) | b1); continue; }
        if ((b0 & 0xF0) === 0xE0) { const b1 = bytes[i++] & 0x3F, b2 = bytes[i++] & 0x3F; out += String.fromCharCode(((b0 & 0x0F) << 12) | (b1 << 6) | b2); continue; }
        if ((b0 & 0xF8) === 0xF0) {
            const b1 = bytes[i++] & 0x3F, b2 = bytes[i++] & 0x3F, b3 = bytes[i++] & 0x3F;
            const cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3;
            const ch = cp - 0x10000; out += String.fromCharCode(0xD800 + (ch >> 10), 0xDC00 + (ch & 1023)); continue;
        }
    }
    return out;
}

/******** Bit Writer / Reader ********/
export class BitWriter {
    private buf: number[] = []; private cur = 0; private used = 0;
    push(value: number, bits: number) {
        if (bits <= 0) return;
        for (let i = bits - 1; i >= 0; i--) {
            const bit = (value >> i) & 1;
            this.cur = (this.cur << 1) | bit; this.used++;
            if (this.used === 8) { this.buf.push(this.cur & 255); this.cur = 0; this.used = 0; }
        }
    }
    finalize(): Uint8Array {
        if (this.used > 0) { this.cur <<= (8 - this.used); this.buf.push(this.cur & 255); this.cur = 0; this.used = 0; }
        return new Uint8Array(this.buf);
    }
}
export class BitReader {
    private idx = 0; private cur = 0; private left = 0;
    constructor(private bytes: Uint8Array) { }
    pull(bits: number): number {
        let v = 0;
        while (bits > 0) {
            if (this.left === 0) { if (this.idx >= this.bytes.length) throw new Error("Unexpected EOF"); this.cur = this.bytes[this.idx++]; this.left = 8; }
            const take = Math.min(bits, this.left);
            v = (v << take) | ((this.cur >> (this.left - take)) & ((1 << take) - 1));
            this.left -= take; bits -= take;
        }
        return v >>> 0;
    }
}

/******** 通用 Schema 引擎 ********/
type Ctx = Record<string, unknown>;

export type NSchema =
    | { t: 'ver', bits: number, name: string, cases: Record<number, NSchema[]> }
    | { t: 'u', bits: number, name: string }
    | { t: 'uExt', smallBits: number, extBits: number, sentinel: number, name: string }
    | { t: 'str8', name: string, max?: number }
    | { t: 'arr', name: string, countFrom: string | number, item: NSchema | NSchema[] }
    | { t: 'struct', name: string, schema: NSchema[] }
    ;

function writeNSchema(w: BitWriter, n: NSchema, { obj, ctx }: { obj: Record<string, unknown>, ctx: Ctx }) {
    switch (n.t) {
        case 'ver': {
            const ver = Number(obj[n.name] ?? 1);
            w.push(ver & ((1 << n.bits) - 1), n.bits);
            const nodes = n.cases[ver] || [];
            for (const c of nodes) writeNSchema(w, c, { obj, ctx });
            ctx[n.name] = ver; break;   
        }
        case 'u': {
            const v = Number(obj[n.name] ?? 0);
            w.push(v & ((1 << n.bits) - 1), n.bits);
            ctx[n.name] = v; break;
        }
        case 'uExt': {
            const v = Number(obj[n.name] ?? 0), sm = n.smallBits, ext = n.extBits, s = n.sentinel;
            if (v <= s - 1) w.push(v & ((1 << sm) - 1), sm);
            else { w.push(s, sm); w.push(v & ((1 << ext) - 1), ext); }
            ctx[n.name] = v; break;
        }
        case 'str8': {
            const raw = String(obj[n.name] ?? '');
            const bytes = utf8Encode(raw);
            const max = Math.min(n.max ?? 255, 255);
            const len = Math.min(bytes.length, max);
            w.push(len & 0xFF, 8);
            for (let i = 0; i < len; i++) w.push(bytes[i], 8);
            ctx[n.name] = raw; break;
        }
        case 'arr': {
            const count = typeof n.countFrom === 'number' ? n.countFrom : Number(ctx[n.countFrom] ?? obj[n.countFrom] ?? 0);
            const arr = (obj[n.name] ?? []) as Record<string, unknown>[];
            for (let i = 0; i < count; i++) {
                const item = arr[i] ?? {};
                if (Array.isArray(n.item)) for (const c of n.item) writeNSchema(w, c, { obj: item, ctx: Object.create(null) });
                else writeNSchema(w, n.item, { obj: item, ctx: Object.create(null) });
            }
            ctx[n.name] = arr; break;
        }
        case 'struct': {
            const sub = obj[n.name] ?? {};
            const subCtx = Object.create(null);
            for (const c of n.schema) writeNSchema(w, c, { obj: sub as Record<string, unknown>, ctx: subCtx });
            ctx[n.name] = sub; break;
        }
    }
}

function readNSchema(r: BitReader, n: NSchema, { out, ctx }: { out: Record<string, unknown>, ctx: Ctx }) {
    switch (n.t) {
        case 'ver': {
            const ver = r.pull(n.bits); out[n.name] = ver; ctx[n.name] = ver;
            const nodes = n.cases[ver] || [];
            for (const c of nodes) readNSchema(r, c, { out, ctx }); break;
        }
        case 'u': { const v = r.pull(n.bits); out[n.name] = v; ctx[n.name] = v; break; }
        case 'uExt': {
            const sm = r.pull(n.smallBits);
            out[n.name] = (sm === n.sentinel) ? r.pull(n.extBits) : sm;
            ctx[n.name] = out[n.name]; break;
        }
        case 'str8': {
            const len = r.pull(8); const arr: number[] = [];
            for (let i = 0; i < len; i++) arr.push(r.pull(8));
            out[n.name] = utf8Decode(new Uint8Array(arr));
            ctx[n.name] = out[n.name]; break;
        }
        case 'arr': {
            const count = typeof n.countFrom === 'number' ? n.countFrom : Number(ctx[n.countFrom] ?? out[n.countFrom] ?? 0);
            const list: Record<string, unknown>[] = [];
            for (let i = 0; i < count; i++) {
                const item: Record<string, unknown> = {};
                if (Array.isArray(n.item)) { const ic = Object.create(null); for (const c of n.item) readNSchema(r, c, { out: item, ctx: ic }); }
                else readNSchema(r, n.item, { out: item, ctx: Object.create(null) });
                list.push(item);
            }
            out[n.name] = list; ctx[n.name] = list; break;
        }
        case 'struct': {
            const o: Record<string, unknown> = {}; const subCtx = Object.create(null);
            for (const c of n.schema) readNSchema(r, c, { out: o, ctx: subCtx });
            out[n.name] = o; ctx[n.name] = o; break;
        }
    }
}

export function pack(schema: NSchema[], obj: Record<string, unknown>): string {
    const w = new BitWriter(); const ctx = Object.create(null);
    for (const n of schema) writeNSchema(w, n, { obj, ctx });
    return toBase64URL(base64Encode(w.finalize()));
}
export function unpack(schema: NSchema[], b64url: string): Record<string, unknown> {
    const r = new BitReader(base64Decode(b64url));
    const out: Record<string, unknown> = {}; const ctx = Object.create(null);
    for (const n of schema) readNSchema(r, n, { out, ctx });
    return out;
}
/* =================== end pack-core.ts =================== */
