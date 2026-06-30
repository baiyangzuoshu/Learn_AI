export interface LoginRequest {
  session?: string;
  openid?: string;
  name?: string;
  avatar?: string;
}

export function encodeLoginRequest(message: LoginRequest): Uint8Array {
  let bb = popByteBuffer();
  _encodeLoginRequest(message, bb);
  return toUint8Array(bb);
}

function _encodeLoginRequest(message: LoginRequest, bb: ByteBuffer): void {
  // optional string session = 1;
  let $session = message.session;
  if ($session !== undefined) {
    writeVarint32(bb, 10);
    writeString(bb, $session);
  }

  // optional string openid = 2;
  let $openid = message.openid;
  if ($openid !== undefined) {
    writeVarint32(bb, 18);
    writeString(bb, $openid);
  }

  // optional string name = 3;
  let $name = message.name;
  if ($name !== undefined) {
    writeVarint32(bb, 26);
    writeString(bb, $name);
  }

  // optional string avatar = 4;
  let $avatar = message.avatar;
  if ($avatar !== undefined) {
    writeVarint32(bb, 34);
    writeString(bb, $avatar);
  }
}

export function decodeLoginRequest(binary: Uint8Array): LoginRequest {
  return _decodeLoginRequest(wrapByteBuffer(binary));
}

function _decodeLoginRequest(bb: ByteBuffer): LoginRequest {
  let message: LoginRequest = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional string session = 1;
      case 1: {
        message.session = readString(bb, readVarint32(bb));
        break;
      }

      // optional string openid = 2;
      case 2: {
        message.openid = readString(bb, readVarint32(bb));
        break;
      }

      // optional string name = 3;
      case 3: {
        message.name = readString(bb, readVarint32(bb));
        break;
      }

      // optional string avatar = 4;
      case 4: {
        message.avatar = readString(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface LoginResponse {
  code?: number;
  msg?: string;
  token?: string;
  role_id?: number;
  max_stage?: number;
}

export function encodeLoginResponse(message: LoginResponse): Uint8Array {
  let bb = popByteBuffer();
  _encodeLoginResponse(message, bb);
  return toUint8Array(bb);
}

function _encodeLoginResponse(message: LoginResponse, bb: ByteBuffer): void {
  // optional int32 code = 1;
  let $code = message.code;
  if ($code !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($code));
  }

  // optional string msg = 2;
  let $msg = message.msg;
  if ($msg !== undefined) {
    writeVarint32(bb, 18);
    writeString(bb, $msg);
  }

  // optional string token = 3;
  let $token = message.token;
  if ($token !== undefined) {
    writeVarint32(bb, 26);
    writeString(bb, $token);
  }

  // optional int32 role_id = 4;
  let $role_id = message.role_id;
  if ($role_id !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($role_id));
  }

  // optional int32 max_stage = 5;
  let $max_stage = message.max_stage;
  if ($max_stage !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, intToLong($max_stage));
  }
}

export function decodeLoginResponse(binary: Uint8Array): LoginResponse {
  return _decodeLoginResponse(wrapByteBuffer(binary));
}

function _decodeLoginResponse(bb: ByteBuffer): LoginResponse {
  let message: LoginResponse = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional int32 code = 1;
      case 1: {
        message.code = readVarint32(bb);
        break;
      }

      // optional string msg = 2;
      case 2: {
        message.msg = readString(bb, readVarint32(bb));
        break;
      }

      // optional string token = 3;
      case 3: {
        message.token = readString(bb, readVarint32(bb));
        break;
      }

      // optional int32 role_id = 4;
      case 4: {
        message.role_id = readVarint32(bb);
        break;
      }

      // optional int32 max_stage = 5;
      case 5: {
        message.max_stage = readVarint32(bb);
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface BlockData {
  id?: number;
  x?: number;
  y?: number;
  type?: number;
}

export function encodeBlockData(message: BlockData): Uint8Array {
  let bb = popByteBuffer();
  _encodeBlockData(message, bb);
  return toUint8Array(bb);
}

function _encodeBlockData(message: BlockData, bb: ByteBuffer): void {
  let $id = message.id;
  if ($id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($id));
  }

  let $x = message.x;
  if ($x !== undefined) {
    writeVarint32(bb, 16);
    writeVarint64(bb, intToLong($x));
  }

  let $y = message.y;
  if ($y !== undefined) {
    writeVarint32(bb, 24);
    writeVarint64(bb, intToLong($y));
  }

  let $type = message.type;
  if ($type !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($type));
  }
}

export function decodeBlockData(binary: Uint8Array): BlockData {
  return _decodeBlockData(wrapByteBuffer(binary));
}

function _decodeBlockData(bb: ByteBuffer): BlockData {
  let message: BlockData = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;
      case 1: {
        message.id = readVarint32(bb);
        break;
      }
      case 2: {
        message.x = readVarint32(bb);
        break;
      }
      case 3: {
        message.y = readVarint32(bb);
        break;
      }
      case 4: {
        message.type = readVarint32(bb);
        break;
      }
      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface EnterStageRequest {
  stage_id?: number;
}

export function encodeEnterStageRequest(message: EnterStageRequest): Uint8Array {
  let bb = popByteBuffer();
  _encodeEnterStageRequest(message, bb);
  return toUint8Array(bb);
}

function _encodeEnterStageRequest(message: EnterStageRequest, bb: ByteBuffer): void {
  let $stage_id = message.stage_id;
  if ($stage_id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($stage_id));
  }
}

export function decodeEnterStageRequest(binary: Uint8Array): EnterStageRequest {
  return _decodeEnterStageRequest(wrapByteBuffer(binary));
}

function _decodeEnterStageRequest(bb: ByteBuffer): EnterStageRequest {
  let message: EnterStageRequest = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;
      case 1: {
        message.stage_id = readVarint32(bb);
        break;
      }
      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface GameSnapshotResponse {
  code?: number;
  msg?: string;
  room_id?: string;
  stage_id?: number;
  width?: number;
  height?: number;
  dirction?: number;
  blocks?: BlockData[];
}

export function encodeGameSnapshotResponse(message: GameSnapshotResponse): Uint8Array {
  let bb = popByteBuffer();
  _encodeGameSnapshotResponse(message, bb);
  return toUint8Array(bb);
}

function _encodeGameSnapshotResponse(message: GameSnapshotResponse, bb: ByteBuffer): void {
  let $code = message.code;
  if ($code !== undefined) {
    writeVarint32(bb, 8);
    writeVarint64(bb, intToLong($code));
  }

  let $msg = message.msg;
  if ($msg !== undefined) {
    writeVarint32(bb, 18);
    writeString(bb, $msg);
  }

  let $room_id = message.room_id;
  if ($room_id !== undefined) {
    writeVarint32(bb, 26);
    writeString(bb, $room_id);
  }

  let $stage_id = message.stage_id;
  if ($stage_id !== undefined) {
    writeVarint32(bb, 32);
    writeVarint64(bb, intToLong($stage_id));
  }

  let $width = message.width;
  if ($width !== undefined) {
    writeVarint32(bb, 40);
    writeVarint64(bb, intToLong($width));
  }

  let $height = message.height;
  if ($height !== undefined) {
    writeVarint32(bb, 48);
    writeVarint64(bb, intToLong($height));
  }

  let $dirction = message.dirction;
  if ($dirction !== undefined) {
    writeVarint32(bb, 56);
    writeVarint64(bb, intToLong($dirction));
  }

  let array$blocks = message.blocks;
  if (array$blocks !== undefined) {
    for (let value of array$blocks) {
      writeVarint32(bb, 66);
      let nested = popByteBuffer();
      _encodeBlockData(value, nested);
      writeVarint32(bb, nested.limit);
      writeByteBuffer(bb, nested);
      pushByteBuffer(nested);
    }
  }
}

export function decodeGameSnapshotResponse(binary: Uint8Array): GameSnapshotResponse {
  return _decodeGameSnapshotResponse(wrapByteBuffer(binary));
}

function _decodeGameSnapshotResponse(bb: ByteBuffer): GameSnapshotResponse {
  let message: GameSnapshotResponse = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;
      case 1: {
        message.code = readVarint32(bb);
        break;
      }
      case 2: {
        message.msg = readString(bb, readVarint32(bb));
        break;
      }
      case 3: {
        message.room_id = readString(bb, readVarint32(bb));
        break;
      }
      case 4: {
        message.stage_id = readVarint32(bb);
        break;
      }
      case 5: {
        message.width = readVarint32(bb);
        break;
      }
      case 6: {
        message.height = readVarint32(bb);
        break;
      }
      case 7: {
        message.dirction = readVarint32(bb);
        break;
      }
      case 8: {
        let limit = pushTemporaryLength(bb);
        let values = message.blocks || (message.blocks = []);
        values.push(_decodeBlockData(bb));
        bb.limit = limit;
        break;
      }
      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Packet {
  msg_id?: number;
  route?: string;
  data?: Uint8Array;
}

export function encodePacket(message: Packet): Uint8Array {
  let bb = popByteBuffer();
  _encodePacket(message, bb);
  return toUint8Array(bb);
}

function _encodePacket(message: Packet, bb: ByteBuffer): void {
  // optional uint32 msg_id = 1;
  let $msg_id = message.msg_id;
  if ($msg_id !== undefined) {
    writeVarint32(bb, 8);
    writeVarint32(bb, $msg_id);
  }

  // optional string route = 2;
  let $route = message.route;
  if ($route !== undefined) {
    writeVarint32(bb, 18);
    writeString(bb, $route);
  }

  // optional bytes data = 3;
  let $data = message.data;
  if ($data !== undefined) {
    writeVarint32(bb, 26);
    writeVarint32(bb, $data.length), writeBytes(bb, $data);
  }
}

export function decodePacket(binary: Uint8Array): Packet {
  return _decodePacket(wrapByteBuffer(binary));
}

function _decodePacket(bb: ByteBuffer): Packet {
  let message: Packet = {} as any;

  end_of_message: while (!isAtEnd(bb)) {
    let tag = readVarint32(bb);

    switch (tag >>> 3) {
      case 0:
        break end_of_message;

      // optional uint32 msg_id = 1;
      case 1: {
        message.msg_id = readVarint32(bb) >>> 0;
        break;
      }

      // optional string route = 2;
      case 2: {
        message.route = readString(bb, readVarint32(bb));
        break;
      }

      // optional bytes data = 3;
      case 3: {
        message.data = readBytes(bb, readVarint32(bb));
        break;
      }

      default:
        skipUnknownField(bb, tag & 7);
    }
  }

  return message;
}

export interface Long {
  low: number;
  high: number;
  unsigned: boolean;
}

interface ByteBuffer {
  bytes: Uint8Array;
  offset: number;
  limit: number;
}

function pushTemporaryLength(bb: ByteBuffer): number {
  let length = readVarint32(bb);
  let limit = bb.limit;
  bb.limit = bb.offset + length;
  return limit;
}

function skipUnknownField(bb: ByteBuffer, type: number): void {
  switch (type) {
    case 0: while (readByte(bb) & 0x80) { } break;
    case 2: skip(bb, readVarint32(bb)); break;
    case 5: skip(bb, 4); break;
    case 1: skip(bb, 8); break;
    default: throw new Error("Unimplemented type: " + type);
  }
}

function stringToLong(value: string): Long {
  return {
    low: value.charCodeAt(0) | (value.charCodeAt(1) << 16),
    high: value.charCodeAt(2) | (value.charCodeAt(3) << 16),
    unsigned: false,
  };
}

function longToString(value: Long): string {
  let low = value.low;
  let high = value.high;
  return String.fromCharCode(
    low & 0xFFFF,
    low >>> 16,
    high & 0xFFFF,
    high >>> 16);
}

// The code below was modified from https://github.com/protobufjs/bytebuffer.js
// which is under the Apache License 2.0.

let f32 = new Float32Array(1);
let f32_u8 = new Uint8Array(f32.buffer);

let f64 = new Float64Array(1);
let f64_u8 = new Uint8Array(f64.buffer);

function intToLong(value: number): Long {
  value |= 0;
  return {
    low: value,
    high: value >> 31,
    unsigned: value >= 0,
  };
}

let bbStack: ByteBuffer[] = [];

function popByteBuffer(): ByteBuffer {
  const bb = bbStack.pop();
  if (!bb) return { bytes: new Uint8Array(64), offset: 0, limit: 0 };
  bb.offset = bb.limit = 0;
  return bb;
}

function pushByteBuffer(bb: ByteBuffer): void {
  bbStack.push(bb);
}

function wrapByteBuffer(bytes: Uint8Array): ByteBuffer {
  return { bytes, offset: 0, limit: bytes.length };
}

function toUint8Array(bb: ByteBuffer): Uint8Array {
  let bytes = bb.bytes;
  let limit = bb.limit;
  return bytes.length === limit ? bytes : bytes.subarray(0, limit);
}

function skip(bb: ByteBuffer, offset: number): void {
  if (bb.offset + offset > bb.limit) {
    throw new Error('Skip past limit');
  }
  bb.offset += offset;
}

function isAtEnd(bb: ByteBuffer): boolean {
  return bb.offset >= bb.limit;
}

function grow(bb: ByteBuffer, count: number): number {
  let bytes = bb.bytes;
  let offset = bb.offset;
  let limit = bb.limit;
  let finalOffset = offset + count;
  if (finalOffset > bytes.length) {
    let newBytes = new Uint8Array(finalOffset * 2);
    newBytes.set(bytes);
    bb.bytes = newBytes;
  }
  bb.offset = finalOffset;
  if (finalOffset > limit) {
    bb.limit = finalOffset;
  }
  return offset;
}

function advance(bb: ByteBuffer, count: number): number {
  let offset = bb.offset;
  if (offset + count > bb.limit) {
    throw new Error('Read past limit');
  }
  bb.offset += count;
  return offset;
}

function readBytes(bb: ByteBuffer, count: number): Uint8Array {
  let offset = advance(bb, count);
  return bb.bytes.subarray(offset, offset + count);
}

function writeBytes(bb: ByteBuffer, buffer: Uint8Array): void {
  let offset = grow(bb, buffer.length);
  bb.bytes.set(buffer, offset);
}

function readString(bb: ByteBuffer, count: number): string {
  // Sadly a hand-coded UTF8 decoder is much faster than subarray+TextDecoder in V8
  let offset = advance(bb, count);
  let fromCharCode = String.fromCharCode;
  let bytes = bb.bytes;
  let invalid = '\uFFFD';
  let text = '';

  for (let i = 0; i < count; i++) {
    let c1 = bytes[i + offset], c2: number, c3: number, c4: number, c: number;

    // 1 byte
    if ((c1 & 0x80) === 0) {
      text += fromCharCode(c1);
    }

    // 2 bytes
    else if ((c1 & 0xE0) === 0xC0) {
      if (i + 1 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        if ((c2 & 0xC0) !== 0x80) text += invalid;
        else {
          c = ((c1 & 0x1F) << 6) | (c2 & 0x3F);
          if (c < 0x80) text += invalid;
          else {
            text += fromCharCode(c);
            i++;
          }
        }
      }
    }

    // 3 bytes
    else if ((c1 & 0xF0) == 0xE0) {
      if (i + 2 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        c3 = bytes[i + offset + 2];
        if (((c2 | (c3 << 8)) & 0xC0C0) !== 0x8080) text += invalid;
        else {
          c = ((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F);
          if (c < 0x0800 || (c >= 0xD800 && c <= 0xDFFF)) text += invalid;
          else {
            text += fromCharCode(c);
            i += 2;
          }
        }
      }
    }

    // 4 bytes
    else if ((c1 & 0xF8) == 0xF0) {
      if (i + 3 >= count) text += invalid;
      else {
        c2 = bytes[i + offset + 1];
        c3 = bytes[i + offset + 2];
        c4 = bytes[i + offset + 3];
        if (((c2 | (c3 << 8) | (c4 << 16)) & 0xC0C0C0) !== 0x808080) text += invalid;
        else {
          c = ((c1 & 0x07) << 0x12) | ((c2 & 0x3F) << 0x0C) | ((c3 & 0x3F) << 0x06) | (c4 & 0x3F);
          if (c < 0x10000 || c > 0x10FFFF) text += invalid;
          else {
            c -= 0x10000;
            text += fromCharCode((c >> 10) + 0xD800, (c & 0x3FF) + 0xDC00);
            i += 3;
          }
        }
      }
    }

    else text += invalid;
  }

  return text;
}

function writeString(bb: ByteBuffer, text: string): void {
  // Sadly a hand-coded UTF8 encoder is much faster than TextEncoder+set in V8
  let n = text.length;
  let byteCount = 0;

  // Write the byte count first
  for (let i = 0; i < n; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
      c = (c << 10) + text.charCodeAt(++i) - 0x35FDC00;
    }
    byteCount += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  writeVarint32(bb, byteCount);

  let offset = grow(bb, byteCount);
  let bytes = bb.bytes;

  // Then write the bytes
  for (let i = 0; i < n; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
      c = (c << 10) + text.charCodeAt(++i) - 0x35FDC00;
    }
    if (c < 0x80) {
      bytes[offset++] = c;
    } else {
      if (c < 0x800) {
        bytes[offset++] = ((c >> 6) & 0x1F) | 0xC0;
      } else {
        if (c < 0x10000) {
          bytes[offset++] = ((c >> 12) & 0x0F) | 0xE0;
        } else {
          bytes[offset++] = ((c >> 18) & 0x07) | 0xF0;
          bytes[offset++] = ((c >> 12) & 0x3F) | 0x80;
        }
        bytes[offset++] = ((c >> 6) & 0x3F) | 0x80;
      }
      bytes[offset++] = (c & 0x3F) | 0x80;
    }
  }
}

function writeByteBuffer(bb: ByteBuffer, buffer: ByteBuffer): void {
  let offset = grow(bb, buffer.limit);
  let from = bb.bytes;
  let to = buffer.bytes;

  // This for loop is much faster than subarray+set on V8
  for (let i = 0, n = buffer.limit; i < n; i++) {
    from[i + offset] = to[i];
  }
}

function readByte(bb: ByteBuffer): number {
  return bb.bytes[advance(bb, 1)];
}

function writeByte(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 1);
  bb.bytes[offset] = value;
}

function readFloat(bb: ByteBuffer): number {
  let offset = advance(bb, 4);
  let bytes = bb.bytes;

  // Manual copying is much faster than subarray+set in V8
  f32_u8[0] = bytes[offset++];
  f32_u8[1] = bytes[offset++];
  f32_u8[2] = bytes[offset++];
  f32_u8[3] = bytes[offset++];
  return f32[0];
}

function writeFloat(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 4);
  let bytes = bb.bytes;
  f32[0] = value;

  // Manual copying is much faster than subarray+set in V8
  bytes[offset++] = f32_u8[0];
  bytes[offset++] = f32_u8[1];
  bytes[offset++] = f32_u8[2];
  bytes[offset++] = f32_u8[3];
}

function readDouble(bb: ByteBuffer): number {
  let offset = advance(bb, 8);
  let bytes = bb.bytes;

  // Manual copying is much faster than subarray+set in V8
  f64_u8[0] = bytes[offset++];
  f64_u8[1] = bytes[offset++];
  f64_u8[2] = bytes[offset++];
  f64_u8[3] = bytes[offset++];
  f64_u8[4] = bytes[offset++];
  f64_u8[5] = bytes[offset++];
  f64_u8[6] = bytes[offset++];
  f64_u8[7] = bytes[offset++];
  return f64[0];
}

function writeDouble(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 8);
  let bytes = bb.bytes;
  f64[0] = value;

  // Manual copying is much faster than subarray+set in V8
  bytes[offset++] = f64_u8[0];
  bytes[offset++] = f64_u8[1];
  bytes[offset++] = f64_u8[2];
  bytes[offset++] = f64_u8[3];
  bytes[offset++] = f64_u8[4];
  bytes[offset++] = f64_u8[5];
  bytes[offset++] = f64_u8[6];
  bytes[offset++] = f64_u8[7];
}

function readInt32(bb: ByteBuffer): number {
  let offset = advance(bb, 4);
  let bytes = bb.bytes;
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

function writeInt32(bb: ByteBuffer, value: number): void {
  let offset = grow(bb, 4);
  let bytes = bb.bytes;
  bytes[offset] = value;
  bytes[offset + 1] = value >> 8;
  bytes[offset + 2] = value >> 16;
  bytes[offset + 3] = value >> 24;
}

function readInt64(bb: ByteBuffer, unsigned: boolean): Long {
  return {
    low: readInt32(bb),
    high: readInt32(bb),
    unsigned,
  };
}

function writeInt64(bb: ByteBuffer, value: Long): void {
  writeInt32(bb, value.low);
  writeInt32(bb, value.high);
}

function readVarint32(bb: ByteBuffer): number {
  let c = 0;
  let value = 0;
  let b: number;
  do {
    b = readByte(bb);
    if (c < 32) value |= (b & 0x7F) << c;
    c += 7;
  } while (b & 0x80);
  return value;
}

function writeVarint32(bb: ByteBuffer, value: number): void {
  value >>>= 0;
  while (value >= 0x80) {
    writeByte(bb, (value & 0x7f) | 0x80);
    value >>>= 7;
  }
  writeByte(bb, value);
}

function readVarint64(bb: ByteBuffer, unsigned: boolean): Long {
  let part0 = 0;
  let part1 = 0;
  let part2 = 0;
  let b: number;

  b = readByte(bb); part0 = (b & 0x7F); if (b & 0x80) {
    b = readByte(bb); part0 |= (b & 0x7F) << 7; if (b & 0x80) {
      b = readByte(bb); part0 |= (b & 0x7F) << 14; if (b & 0x80) {
        b = readByte(bb); part0 |= (b & 0x7F) << 21; if (b & 0x80) {

          b = readByte(bb); part1 = (b & 0x7F); if (b & 0x80) {
            b = readByte(bb); part1 |= (b & 0x7F) << 7; if (b & 0x80) {
              b = readByte(bb); part1 |= (b & 0x7F) << 14; if (b & 0x80) {
                b = readByte(bb); part1 |= (b & 0x7F) << 21; if (b & 0x80) {

                  b = readByte(bb); part2 = (b & 0x7F); if (b & 0x80) {
                    b = readByte(bb); part2 |= (b & 0x7F) << 7;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    low: part0 | (part1 << 28),
    high: (part1 >>> 4) | (part2 << 24),
    unsigned,
  };
}

function writeVarint64(bb: ByteBuffer, value: Long): void {
  let part0 = value.low >>> 0;
  let part1 = ((value.low >>> 28) | (value.high << 4)) >>> 0;
  let part2 = value.high >>> 24;

  // ref: src/google/protobuf/io/coded_stream.cc
  let size =
    part2 === 0 ?
      part1 === 0 ?
        part0 < 1 << 14 ?
          part0 < 1 << 7 ? 1 : 2 :
          part0 < 1 << 21 ? 3 : 4 :
        part1 < 1 << 14 ?
          part1 < 1 << 7 ? 5 : 6 :
          part1 < 1 << 21 ? 7 : 8 :
      part2 < 1 << 7 ? 9 : 10;

  let offset = grow(bb, size);
  let bytes = bb.bytes;

  switch (size) {
    case 10: bytes[offset + 9] = (part2 >>> 7) & 0x01;
    case 9: bytes[offset + 8] = size !== 9 ? part2 | 0x80 : part2 & 0x7F;
    case 8: bytes[offset + 7] = size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7F;
    case 7: bytes[offset + 6] = size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7F;
    case 6: bytes[offset + 5] = size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7F;
    case 5: bytes[offset + 4] = size !== 5 ? part1 | 0x80 : part1 & 0x7F;
    case 4: bytes[offset + 3] = size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7F;
    case 3: bytes[offset + 2] = size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7F;
    case 2: bytes[offset + 1] = size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7F;
    case 1: bytes[offset] = size !== 1 ? part0 | 0x80 : part0 & 0x7F;
  }
}

function readVarint32ZigZag(bb: ByteBuffer): number {
  let value = readVarint32(bb);

  // ref: src/google/protobuf/wire_format_lite.h
  return (value >>> 1) ^ -(value & 1);
}

function writeVarint32ZigZag(bb: ByteBuffer, value: number): void {
  // ref: src/google/protobuf/wire_format_lite.h
  writeVarint32(bb, (value << 1) ^ (value >> 31));
}

function readVarint64ZigZag(bb: ByteBuffer): Long {
  let value = readVarint64(bb, /* unsigned */ false);
  let low = value.low;
  let high = value.high;
  let flip = -(low & 1);

  // ref: src/google/protobuf/wire_format_lite.h
  return {
    low: ((low >>> 1) | (high << 31)) ^ flip,
    high: (high >>> 1) ^ flip,
    unsigned: false,
  };
}

function writeVarint64ZigZag(bb: ByteBuffer, value: Long): void {
  let low = value.low;
  let high = value.high;
  let flip = high >> 31;

  // ref: src/google/protobuf/wire_format_lite.h
  writeVarint64(bb, {
    low: (low << 1) ^ flip,
    high: ((high << 1) | (low >>> 31)) ^ flip,
    unsigned: false,
  });
}
