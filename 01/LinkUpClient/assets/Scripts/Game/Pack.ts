/**
 * pack.ts — 极小体积位打包（Base64URL）
 * 适配你的关卡数据结构（含 serverItems 四元组）。
 * 纯 TS/JS，无 TextEncoder、Buffer 依赖；可直接用于 Cocos Creator 2.4.x / 微信小程序。
 * 
 * 导出 API：
 *   - encodeCompact(payload: Payload): string
 *   - decodeCompact(b64url: string): Payload
 *   - packFromOriginal(orig: OriginalShape): string
 *   - unpackToOriginal(b64url: string): OriginalShape
 */

/************************* 类型定义 *************************/
export type Item = [type: number, row: number, col: number, state: number];

export interface DataBlock {
    id: number;
    width: number;
    height: number;
    dirction: number;      // 注意：按你的字段拼写
    linkCount: number;
    woodenState: number;
    rocketState: number;
    items: Item[];         // 压缩的目标（对应你原始的 serverItems）
    tileTypes: number;     // 保持你的非可选写法
}

export interface PlanBlock {
    block1: number; block2: number; block3: number; block4: number;
    block5: number; block6: number; block7: number; block8: number;
    id: number; tileTypes: number; fleshRate1: number; fleshRate2: number; linkCount: number;
}

export interface Payload {
    /** v3: 改为 string；编码为 UTF-8，前置 1 字节长度（0..255） */
    role_id: string;
    name?: string;         // v2+: 分享昵称（可选）
    data: DataBlock;
    plan: PlanBlock;
}

export interface OriginalData {
    id: number; width: number; height: number; dirction: number; linkCount: number;
    woodenState: number; rocketState: number;
    items?: Item[];               // 可有可无
    serverItems: Item[];          // 主要来源
    tileTypes: number; tile_types: number;
}
export interface OriginalPlan {
    block1: number; block2: number; block3: number; block4: number;
    block5: number; block6: number; block7: number; block8: number;
    id: number;
    tileTypes: number; tile_types: number;
    fleshRate1: number; flesh_rate1: number;
    fleshRate2: number; flesh_rate2: number;
    linkCount: number;
}
/** 原始对象形状（兼容 snake/camel 重复字段） */
export interface OriginalShape {
    /** v3: 改为 string */
    role_id: string;
    name: string;               // v2+: 新增
    data: OriginalData;
    plan: OriginalPlan;
}

/*********************** Base64URL（纯 JS） ***********************/
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(bytes: Uint8Array): string {
    let out = "";
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
        const a = bytes[i];
        const b = i + 1 < len ? bytes[i + 1] : 0;
        const c = i + 2 < len ? bytes[i + 2] : 0;

        const triplet = (a << 16) | (b << 8) | c;
        out += B64_ALPHABET[(triplet >>> 18) & 63];
        out += B64_ALPHABET[(triplet >>> 12) & 63];
        out += i + 1 < len ? B64_ALPHABET[(triplet >>> 6) & 63] : "=";
        out += i + 2 < len ? B64_ALPHABET[triplet & 63] : "=";
    }
    return out;
}

function base64Decode(b64: string): Uint8Array {
    // 允许无 padding / 含 URL 安全字符
    b64 = b64.replace(/\s+/g, "");
    // 将 URL 安全变体转回标准 Base64
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b64.length % 4)) % 4;
    if (pad) b64 += "=".repeat(pad);

    const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
    const out: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
        const c1 = B64_ALPHABET.indexOf(clean[i]);
        const c2 = B64_ALPHABET.indexOf(clean[i + 1]);
        const c3 = clean[i + 2] === '=' ? 64 : B64_ALPHABET.indexOf(clean[i + 2]);
        const c4 = clean[i + 3] === '=' ? 64 : B64_ALPHABET.indexOf(clean[i + 3]);

        const b1 = (c1 << 2) | (c2 >> 4);
        out.push(b1 & 255);
        if (c3 !== 64) {
            const b2 = ((c2 & 15) << 4) | (c3 >> 2);
            out.push(b2 & 255);
            if (c4 !== 64) {
                const b3 = ((c3 & 3) << 6) | c4;
                out.push(b3 & 255);
            }
        }
    }
    return new Uint8Array(out);
}

function toBase64URL(b64: string): string {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/*********************** UTF-8（纯 JS） ***************************/
function utf8Encode(str: string): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
            const next = str.charCodeAt(++i);
            if (next >= 0xDC00 && next <= 0xDFFF) {
                code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00);
            } else { i--; }
        }
        if (code <= 0x7F) out.push(code);
        else if (code <= 0x7FF) out.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
        else if (code <= 0xFFFF) out.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
        else out.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    }
    return new Uint8Array(out);
}

function utf8Decode(bytes: Uint8Array): string {
    let i = 0, out = '';
    while (i < bytes.length) {
        const b0 = bytes[i++];
        if ((b0 & 0x80) === 0) { out += String.fromCharCode(b0); continue; }
        if ((b0 & 0xE0) === 0xC0) { const b1 = bytes[i++] & 0x3F; out += String.fromCharCode(((b0 & 0x1F) << 6) | b1); continue; }
        if ((b0 & 0xF0) === 0xE0) { const b1 = bytes[i++] & 0x3F, b2 = bytes[i++] & 0x3F; out += String.fromCharCode(((b0 & 0x0F) << 12) | (b1 << 6) | b2); continue; }
        if ((b0 & 0xF8) === 0xF0) { const b1 = bytes[i++] & 0x3F, b2 = bytes[i++] & 0x3F, b3 = bytes[i++] & 0x3F; const cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3; const ch = cp - 0x10000; out += String.fromCharCode(0xD800 + (ch >> 10), 0xDC00 + (ch & 1023)); continue; }
    }
    return out;
}

/*********************** Bit Writer / Reader ************************/
class BitWriter {
    private buf: number[] = [];
    private cur = 0;
    private used = 0; // bits used in current byte

    push(value: number, bits: number) {
        if (bits <= 0) return;
        for (let i = bits - 1; i >= 0; i--) {
            const bit = (value >> i) & 1;
            this.cur = (this.cur << 1) | bit;
            this.used++;
            if (this.used === 8) {
                this.buf.push(this.cur & 255);
                this.cur = 0; this.used = 0;
            }
        }
    }

    finalize(): Uint8Array {
        if (this.used > 0) {
            this.cur <<= (8 - this.used);
            this.buf.push(this.cur & 255);
            this.cur = 0; this.used = 0;
        }
        return new Uint8Array(this.buf);
    }
}

class BitReader {
    private idx = 0;     // byte index
    private cur = 0;     // current byte value
    private left = 0;    // bits left in current byte

    constructor(private bytes: Uint8Array) { }

    pull(bits: number): number {
        let v = 0;
        while (bits > 0) {
            if (this.left === 0) {
                if (this.idx >= this.bytes.length) throw new Error("Unexpected EOF");
                this.cur = this.bytes[this.idx++];
                this.left = 8;
            }
            const take = Math.min(bits, this.left);
            v = (v << take) | ((this.cur >> (this.left - take)) & ((1 << take) - 1));
            this.left -= take;
            bits -= take;
        }
        return v >>> 0;
    }
}

/************************ 内部常量与校验 ************************/
/** v3: 新增 role_id(string) 的存储方式 */
const VERSION = 3; // 3 bits（v2: 新增 name；v3: role_id→string）

// eslint-disable-next-line @typescript-eslint/max-params
function assertRange(name: string, v: number, min: number, max: number) {
    if (v < min || v > max || !Number.isFinite(v)) {
        throw new Error(`${name} out of range: ${v}, expect [${min}, ${max}]`);
    }
}

/*********************** 头部编解码（定长 + v3 扩展） ***********************/
function encodeHeader(w: BitWriter, p: Payload, itemCount: number) {
    // version:3
    w.push(VERSION & 0b111, 3);

    // v3: role_id(string, UTF-8)，前置 1 字节长度（0..255）
    const roleBytes = utf8Encode(p["role_id"] ?? "");
    if (roleBytes.length > 255) {
        throw new Error(`role_id too long: ${roleBytes.length}, expect <= 255 bytes`);
    }
    w.push(roleBytes.length & 0xFF, 8);
    for (const byte of roleBytes) w.push(byte, 8);

    // data.id:16
    assertRange('data.id', p["data"]["id"], 0, 0xFFFF);
    w.push(p["data"]["id"] & 0xFFFF, 16);
    // width/height/dirction:6 each (0..63)
    assertRange('width', p["data"]["width"], 0, 63); w.push(p["data"]["width"] & 0x3F, 6);
    assertRange('height', p["data"]["height"], 0, 63); w.push(p["data"]["height"] & 0x3F, 6);
    assertRange('dirction', p["data"]["dirction"], 0, 63); w.push(p["data"]["dirction"] & 0x3F, 6);
    // linkCount:8, wooden/rocket:4, tileTypes:6
    assertRange('linkCount', p["data"]["linkCount"], 0, 255); w.push(p["data"]["linkCount"] & 0xFF, 8);
    assertRange('woodenState', p["data"]["woodenState"], 0, 15); w.push(p["data"]["woodenState"] & 0x0F, 4);
    assertRange('rocketState', p["data"]["rocketState"], 0, 15); w.push(p["data"]["rocketState"] & 0x0F, 4);
    w.push((p["data"]["tileTypes"] ?? 0) & 0x3F, 6);
    // items count:12 (0..4095)
    assertRange('items.length', itemCount, 0, 4095); w.push(itemCount & 0x0FFF, 12);

    // plan：block1..8（8bit）、id(16)、tileTypes(6)、fleshRate1(7)、fleshRate2(7)、linkCount(8)
    const pl = p["plan"];
    const blocks = [pl["block1"], pl["block2"], pl["block3"], pl["block4"], pl["block5"], pl["block6"], pl["block7"], pl["block8"]];
    for (let i = 0; i < 8; i++) { assertRange(`plan.block${i + 1}`, blocks[i], 0, 255); w.push(blocks[i] & 0xFF, 8); }
    assertRange('plan.id', pl["id"], 0, 0xFFFF); w.push(pl["id"] & 0xFFFF, 16);
    w.push((pl["tileTypes"] ?? 0) & 0x3F, 6);
    assertRange('plan.fleshRate1', (pl["fleshRate1"] ?? 0), 0, 127); w.push((pl["fleshRate1"] ?? 0) & 0x7F, 7);
    assertRange('plan.fleshRate2', (pl["fleshRate2"] ?? 0), 0, 127); w.push((pl["fleshRate2"] ?? 0) & 0x7F, 7);
    assertRange('plan.linkCount', (pl["linkCount"] ?? 0), 0, 255); w.push((pl["linkCount"] ?? 0) & 0xFF, 8);
}

function decodeHeader(r: BitReader) {
    const version = r.pull(3);
    let role_id_str = "";
    let role_id_num = 0;

    if (version >= 3) {
        // v3: role_id(string)
        const len = r.pull(8);
        const arr: number[] = [];
        for (let i = 0; i < len; i++) arr.push(r.pull(8));
        role_id_str = utf8Decode(new Uint8Array(arr));
    } else {
        // v1/v2: role_id(16bit number)
        role_id_num = r.pull(16);
    }

    const id = r.pull(16);
    const width = r.pull(6);
    const height = r.pull(6);
    const dirction = r.pull(6);
    const linkCount = r.pull(8);
    const woodenState = r.pull(4);
    const rocketState = r.pull(4);
    const tileTypes = r.pull(6);
    const count = r.pull(12);

    const blocks: number[] = [];
    for (let i = 0; i < 8; i++) blocks.push(r.pull(8));
    const planId = r.pull(16);
    const planTileTypes = r.pull(6);
    const fleshRate1 = r.pull(7);
    const fleshRate2 = r.pull(7);
    const planLink = r.pull(8);

    return {
        "version": version,
        "header": {
            /** v3: string；v1/v2: number（解码器上层会转成 string） */
            "role_id": (version >= 3 ? role_id_str : role_id_num) as unknown as string | number,
            "data": { "id": id, "width": width, "height": height, "dirction": dirction, "linkCount": linkCount, "woodenState": woodenState, "rocketState": rocketState, "tileTypes": tileTypes },
            "count": count
        },
        "plan": {
            "block1": blocks[0], "block2": blocks[1], "block3": blocks[2], "block4": blocks[3],
            "block5": blocks[4], "block6": blocks[5], "block7": blocks[6], "block8": blocks[7],
            "id": planId, "tileTypes": planTileTypes, "fleshRate1": fleshRate1, "fleshRate2": fleshRate2, "linkCount": planLink
        } as PlanBlock
    };
}

/*********************** items 编解码（变长） ***********************/
// 扩展：type 支持大值（如 1007）。
// 规则：先写 5bit，如果为 31(0b11111) 则追加 11bit 作为扩展 type（0..2047）。
// stateTag：00 => 0, 01 => 1008, 10/11 => 扩展 +12bit state
function encodeItems(w: BitWriter, items: Item[]) {
    const TYPE_SMALL_BITS = 5;           // 0..30 直接写入
    const TYPE_EXT_SENTINEL = (1 << TYPE_SMALL_BITS) - 1; // 31
    const TYPE_EXT_BITS = 11;            // 支持到 2047

    for (const it of items) {
        const [type, row, col, state] = it;

        // type：小值直接写，超出写 31 再追加 11bit 扩展
        if (type <= TYPE_EXT_SENTINEL - 1) {
            w.push(type & 0x1F, TYPE_SMALL_BITS);
        } else {
            // 扩展上限 2047，如需更大可把 TYPE_EXT_BITS 提升为 12/13...
            if (type < 0 || type > ((1 << TYPE_EXT_BITS) - 1)) {
                throw new Error(`type(ext) out of range: ${type}, expect [0, ${(1 << TYPE_EXT_BITS) - 1}]`);
            }
            w.push(TYPE_EXT_SENTINEL, TYPE_SMALL_BITS);
            w.push(type & ((1 << TYPE_EXT_BITS) - 1), TYPE_EXT_BITS);
        }

        assertRange('row', row, 0, 15); w.push(row & 0x0F, 4);
        assertRange('col', col, 0, 7); w.push(col & 0x07, 3);

        if (state === 0) { w.push(0b00, 2); }
        else if (state === 1008) { w.push(0b01, 2); }
        else { w.push(0b10, 2); assertRange('state', state, 0, 0x0FFF); w.push(state & 0x0FFF, 12); }
    }
}

function decodeItems(r: BitReader, count: number): Item[] {
    const items: Item[] = [];
    const TYPE_SMALL_BITS = 5;
    const TYPE_EXT_SENTINEL = (1 << TYPE_SMALL_BITS) - 1; // 31
    const TYPE_EXT_BITS = 11;

    for (let i = 0; i < count; i++) {
        let type = r.pull(TYPE_SMALL_BITS);
        if (type === TYPE_EXT_SENTINEL) {
            // 读扩展 type
            type = r.pull(TYPE_EXT_BITS);
        }
        const row = r.pull(4);
        const col = r.pull(3);
        const tag = r.pull(2);
        let state = 0;
        if (tag === 0) state = 0;
        else if (tag === 1) state = 1008;
        else state = r.pull(12);
        items.push([type, row, col, state]);
    }
    return items;
}

/************************* 对外 API *************************/
export function encodeCompact(payload: Payload): string {
    console.log("encodeCompact", JSON.stringify(payload));
    const w = new BitWriter();
    encodeHeader(w, payload, payload["data"]["items"].length);

    // v2+: 写 name（UTF-8：先写长度 8bit，再写字节）
    const nameBytes = utf8Encode(payload["name"] || "");
    const nameLen = Math.min(nameBytes.length, 255);
    w.push(nameLen & 0xFF, 8);
    for (let i = 0; i < nameLen; i++) w.push(nameBytes[i], 8);

    encodeItems(w, payload["data"]["items"]);
    const bytes = w.finalize();
    const b64 = base64Encode(bytes);
    return toBase64URL(b64);
}

export function decodeCompact(b64url: string): Payload {
    const bytes = base64Decode(b64url);
    const r = new BitReader(bytes);
    const h = decodeHeader(r);
    console.log("decodeCompact", h);

    // v2+: 读取 name；v1: name=""
    let name = "";
    if (h["version"] >= 2) {
        const nameLen = r.pull(8);
        const arr: number[] = [];
        for (let i = 0; i < nameLen; i++) arr.push(r.pull(8));
        name = utf8Decode(new Uint8Array(arr));
    }

    const items = decodeItems(r, h["header"]["count"]);
    const data: DataBlock = { ...h["header"]["data"], "items": items };
    const plan: PlanBlock = h["plan"];

    // v1/v2 的 role_id 是 number，这里统一转成 string
    const rid = (typeof h["header"]["role_id"] === "string")
        ? (h["header"]["role_id"] as string)
        : String(h["header"]["role_id"]);

    return { "role_id": rid, "name": name, "data": data, "plan": plan };
}

/*********************** 适配器：原始形状 ↔ 位包 *************************/
export function packFromOriginal(orig: OriginalShape): string {
    const items = (orig["data"]["serverItems"] && orig["data"]["serverItems"].length ? orig["data"]["serverItems"] : (orig["data"]["items"] || []));
    const payload: Payload = {
        /** v3: 直接传入字符串 */
        "role_id": String(orig["role_id"] ?? ""),
        "name": (orig["name"] || ""),   // v2+
        "data": {
            "id": orig["data"]["id"],
            "width": orig["data"]["width"],
            "height": orig["data"]["height"],
            "dirction": orig["data"]["dirction"],
            "linkCount": orig["data"]["linkCount"],
            "woodenState": orig["data"]["woodenState"],
            "rocketState": orig["data"]["rocketState"],
            "tileTypes": (orig["data"]["tileTypes"] ?? orig["data"]["tile_types"] ?? 0),
            items,
        },
        "plan": {
            "block1": orig["plan"]["block1"], "block2": orig["plan"]["block2"], "block3": orig["plan"]["block3"], "block4": orig["plan"]["block4"],
            "block5": orig["plan"]["block5"], "block6": orig["plan"]["block6"], "block7": orig["plan"]["block7"], "block8": orig["plan"]["block8"],
            "id": orig["plan"]["id"],
            "tileTypes": (orig["plan"]["tileTypes"] ?? orig["plan"]["tile_types"] ?? 0),
            "fleshRate1": (orig["plan"]["fleshRate1"] ?? orig["plan"]["flesh_rate1"] ?? 0),
            "fleshRate2": (orig["plan"]["fleshRate2"] ?? orig["plan"]["flesh_rate2"] ?? 0),
            "linkCount": orig["plan"]["linkCount"],
        }
    };
    return encodeCompact(payload);
}

export function unpackToOriginal(b64url: string): OriginalShape {
    const p = decodeCompact(b64url);
    console.log("unpackToOriginal", p);
    const original: OriginalShape = {
        /** v3: 已是 string */
        "role_id": p["role_id"],
        "name": (p["name"] || ""),   // v2+
        "data": {
            "id": p["data"]["id"], "width": p["data"]["width"], "height": p["data"]["height"], "dirction": p["data"]["dirction"],
            "linkCount": p["data"]["linkCount"], "woodenState": p["data"]["woodenState"], "rocketState": p["data"]["rocketState"],
            // 保持两套字段：
            "tileTypes": p["data"]["tileTypes"], "tile_types": p["data"]["tileTypes"],
            // 原始结构以 serverItems 为主：
            "serverItems": p["data"]["items"],
            "items": [],
        },
        "plan": {
            "block1": p["plan"]["block1"], "block2": p["plan"]["block2"], "block3": p["plan"]["block3"], "block4": p["plan"]["block4"],
            "block5": p["plan"]["block5"], "block6": p["plan"]["block6"], "block7": p["plan"]["block7"], "block8": p["plan"]["block8"],
            "id": p["plan"]["id"],
            // 同步 snake/camel
            "tileTypes": p["plan"]["tileTypes"], "tile_types": p["plan"]["tileTypes"],
            "fleshRate1": p["plan"]["fleshRate1"], "flesh_rate1": p["plan"]["fleshRate1"],
            "fleshRate2": p["plan"]["fleshRate2"], "flesh_rate2": p["plan"]["fleshRate2"],
            "linkCount": p["plan"]["linkCount"],
        }
    };
    return original;
}

/************************* 可选：快速自检 *************************/
/**
// 用法示例（在你工程里手动调用）：
const orig: OriginalShape = ({
  role_id: "937396",
  name: "玩家A",
  data: { id:1,width:8,height:14,dirction:0,linkCount:6,woodenState:0,rocketState:0,
          serverItems:[[1,0,0,0],[2,0,1,0]], tileTypes:27, tile_types:27 },
  plan: { block1:0,block2:0,block3:0,block4:0,block5:0,block6:0,block7:0,block8:0,
          id:1,tileTypes:27,tile_types:27,fleshRate1:0,flesh_rate1:0,fleshRate2:0,flesh_rate2:0,linkCount:6 }
} as any);
const packed = packFromOriginal(orig);
// 发送：?d=${packed}
const round = unpackToOriginal(packed);
console.log('packed.length =', packed.length, 'rid=', round.role_id, 'items =', round.data.serverItems?.length);
*/
