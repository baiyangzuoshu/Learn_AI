/* ======================= pack.ts ======================= */

import { type NSchema, pack, unpack } from "../../FrameWork/Lib/pack-core";

/** 你的业务类型定义（保持与你项目一致） **/
export type Item = [type: number, row: number, col: number, state: number];

export interface DataBlock {
    id: number; width: number; height: number; dirction: number;
    linkCount: number; woodenState: number; rocketState: number;
    items: Item[]; tileTypes: number;
}
export interface PlanBlock {
    block1: number; block2: number; block3: number; block4: number;
    block5: number; block6: number; block7: number; block8: number;
    id: number; tileTypes: number; fleshRate1: number; fleshRate2: number; linkCount: number;
}
export interface Payload {
    role_id: number;
    name?: string;         // v2 新增
    data: DataBlock;
    plan: PlanBlock;
}

export interface OriginalData {
    id: number; width: number; height: number; dirction: number; linkCount: number;
    woodenState: number; rocketState: number;
    items?: Item[];
    serverItems: Item[];
    tileTypes: number; tile_types: number;
}
export interface OriginalPlan {
    block1: number; block2: number; block3: number; block4: number;
    block5: number; block6: number; block7: number; block8: number;
    id: number; tileTypes: number; tile_types: number;
    fleshRate1: number; flesh_rate1: number;
    fleshRate2: number; flesh_rate2: number;
    linkCount: number;
}
export interface OriginalShape {
    role_id: number;
    name?: string;
    data: OriginalData;
    plan: OriginalPlan;
}

/** state ↔ (tag,value) 规则 **/
function encodeState(state: number) {
    if (state === 0) return { tag: 0, value: 0 };
    if (state === 1008) return { tag: 1, value: 0 };
    return { tag: 2, value: state & 0x0FFF };
}
function decodeState(tag: number, value: number) {
    if (tag === 0) return 0;
    if (tag === 1) return 1008;
    return value;
}

/** 用 Schema 描述协议（v1/v2 兼容） **/
const HeaderSchema: NSchema[] = [
    { t: 'u', name: 'role_id', bits: 16 },
    { t: 'u', name: 'id', bits: 16 },
    { t: 'u', name: 'width', bits: 6 },
    { t: 'u', name: 'height', bits: 6 },
    { t: 'u', name: 'dirction', bits: 6 },
    { t: 'u', name: 'linkCount', bits: 8 },
    { t: 'u', name: 'woodenState', bits: 4 },
    { t: 'u', name: 'rocketState', bits: 4 },
    { t: 'u', name: 'tileTypes', bits: 6 },
    { t: 'u', name: 'count', bits: 12 },
    { t: 'u', name: 'block1', bits: 8 }, { t: 'u', name: 'block2', bits: 8 }, { t: 'u', name: 'block3', bits: 8 }, { t: 'u', name: 'block4', bits: 8 },
    { t: 'u', name: 'block5', bits: 8 }, { t: 'u', name: 'block6', bits: 8 }, { t: 'u', name: 'block7', bits: 8 }, { t: 'u', name: 'block8', bits: 8 },
    { t: 'u', name: 'planId', bits: 16 },
    { t: 'u', name: 'planTileTypes', bits: 6 },
    { t: 'u', name: 'fleshRate1', bits: 7 },
    { t: 'u', name: 'fleshRate2', bits: 7 },
    { t: 'u', name: 'planLink', bits: 8 },
];

const V1Schema: NSchema[] = [...HeaderSchema];                  // 无 name
const V2Schema: NSchema[] = [...HeaderSchema, { t: 'str8', name: 'name' }];

export const PayloadSchema: NSchema[] = [
    { t: 'ver', name: 'version', bits: 3, cases: { 1: V1Schema, 2: V2Schema } },
    {
        t: 'arr', name: 'items', countFrom: 'count', item: [
            { t: 'uExt', name: 'type', smallBits: 5, extBits: 11, sentinel: 31 },
            { t: 'u', name: 'row', bits: 4 },
            { t: 'u', name: 'col', bits: 3 },
            { t: 'u', name: 'tag', bits: 2 },
            { t: 'u', name: 'value', bits: 12 }, // 对于 tag=0/1，value=0；tag>=2 时为有效值
        ]
    },
];

/** 业务对象 ↔ 通用对象 **/
function toGeneric(payload: Payload): unknown {
    const { role_id, name, data, plan } = payload;
    return {
        version: (name && name.length) ? 2 : 1,
        role_id,
        id: data.id,
        width: data.width,
        height: data.height,
        dirction: data.dirction,
        linkCount: data.linkCount,
        woodenState: data.woodenState,
        rocketState: data.rocketState,
        tileTypes: data.tileTypes ?? 0,
        count: data.items.length,
        block1: plan.block1, block2: plan.block2, block3: plan.block3, block4: plan.block4,
        block5: plan.block5, block6: plan.block6, block7: plan.block7, block8: plan.block8,
        planId: plan.id,
        planTileTypes: plan.tileTypes ?? 0,
        fleshRate1: plan.fleshRate1 ?? 0,
        fleshRate2: plan.fleshRate2 ?? 0,
        planLink: plan.linkCount ?? 0,
        name: name || "",
        items: data.items.map(([type, row, col, state]) => {
            const { tag, value } = encodeState(state);
            return { type, row, col, tag, value };
        }),
    };
}
function fromGeneric(g: {
    role_id: number;
    version?: number;
    name?: string;
    id: number;
    width: number;
    height: number;
    dirction: number;
    linkCount: number;
    woodenState: number;
    rocketState: number;
    tileTypes: number;
    count: number;
    block1: number;
    block2: number;
    block3: number;
    block4: number;
    block5: number;
    block6: number;
    block7: number;
    block8: number;
    planId: number;
    planTileTypes: number;
    fleshRate1: number;
    fleshRate2: number;
    planLink: number;
    items?: {
        type: number;
        row: number;
        col: number;
        tag: number;
        value: number;
    }[];
}): Payload {
    const items: Item[] = (g.items || []).map((it: { type: number; row: number; col: number; tag: number; value: number }) => [it.type, it.row, it.col, decodeState(it.tag, it.value)]);
    return {
        role_id: g.role_id,
        name: (g.version !== undefined && g.version >= 2 ? g.name : ""),
        data: {
            id: g.id, width: g.width, height: g.height, dirction: g.dirction,
            linkCount: g.linkCount, woodenState: g.woodenState, rocketState: g.rocketState,
            tileTypes: g.tileTypes, items,
        },
        plan: {
            block1: g.block1, block2: g.block2, block3: g.block3, block4: g.block4,
            block5: g.block5, block6: g.block6, block7: g.block7, block8: g.block8,
            id: g.planId, tileTypes: g.planTileTypes, fleshRate1: g.fleshRate1, fleshRate2: g.fleshRate2, linkCount: g.planLink,
        }
    };
}

/** 暴露 API：与旧版一致 **/
export function encodeCompact(payload: Payload): string {
    const g = toGeneric(payload);
    return pack(PayloadSchema, g as Record<string, unknown>);
}
export function decodeCompact(b64url: string): Payload {
    const g = unpack(PayloadSchema, b64url);
    return fromGeneric(g as {
        role_id: number;
        version?: number;
        name?: string;
        id: number;
        width: number;
        height: number;
        dirction: number;
        linkCount: number;
        woodenState: number;
        rocketState: number;
        tileTypes: number;
        count: number;
        block1: number;
        block2: number;
        block3: number;
        block4: number;
        block5: number;
        block6: number;
        block7: number;
        block8: number;
        planId: number;
        planTileTypes: number;
        fleshRate1: number;
        fleshRate2: number;
        planLink: number;
        items?: {
            type: number;
            row: number;
            col: number;
            tag: number;
            value: number;
        }[];
    });
}

/** 适配 OriginalShape **/
export function packFromOriginal2(orig: OriginalShape): string {
    const items = (orig.data.serverItems && orig.data.serverItems.length ? orig.data.serverItems : (orig.data.items || []));
    const payload: Payload = {
        role_id: orig.role_id,
        name: orig.name || "",
        data: {
            id: orig.data.id, width: orig.data.width, height: orig.data.height, dirction: orig.data.dirction,
            linkCount: orig.data.linkCount, woodenState: orig.data.woodenState, rocketState: orig.data.rocketState,
            tileTypes: (orig.data.tileTypes ?? orig.data.tile_types ?? 0),
            items,
        },
        plan: {
            block1: orig.plan.block1, block2: orig.plan.block2, block3: orig.plan.block3, block4: orig.plan.block4,
            block5: orig.plan.block5, block6: orig.plan.block6, block7: orig.plan.block7, block8: orig.plan.block8,
            id: orig.plan.id,
            tileTypes: (orig.plan.tileTypes ?? orig.plan.tile_types ?? 0),
            fleshRate1: (orig.plan.fleshRate1 ?? orig.plan.flesh_rate1 ?? 0),
            fleshRate2: (orig.plan.fleshRate2 ?? orig.plan.flesh_rate2 ?? 0),
            linkCount: orig.plan.linkCount,
        }
    };
    return encodeCompact(payload);
}
export function unpackToOriginal2(b64url: string): OriginalShape {
    const p = decodeCompact(b64url);
    return {
        role_id: p.role_id,
        name: p.name || "",
        data: {
            id: p.data.id, width: p.data.width, height: p.data.height, dirction: p.data.dirction,
            linkCount: p.data.linkCount, woodenState: p.data.woodenState, rocketState: p.data.rocketState,
            tileTypes: p.data.tileTypes, tile_types: p.data.tileTypes,
            serverItems: p.data.items,
            items: [],
        },
        plan: {
            block1: p.plan.block1, block2: p.plan.block2, block3: p.plan.block3, block4: p.plan.block4,
            block5: p.plan.block5, block6: p.plan.block6, block7: p.plan.block7, block8: p.plan.block8,
            id: p.plan.id,
            tileTypes: p.plan.tileTypes, tile_types: p.plan.tileTypes,
            fleshRate1: p.plan.fleshRate1, flesh_rate1: p.plan.fleshRate1,
            fleshRate2: p.plan.fleshRate2, flesh_rate2: p.plan.fleshRate2,
            linkCount: p.plan.linkCount,
        }
    };
}
/* ===================== end pack.ts ===================== */
