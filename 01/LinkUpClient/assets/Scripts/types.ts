//import type { PlayerProfile } from 'hlddz-sdk';

import { PlayerProfile } from "../sdk/hlddz-sdk";

export interface HLDDZ_USER extends PlayerProfile {
    clientType: number;
    accountType: number;
    sessionKey: string;
    userid: string;
}

export class ReportLog {
    mapID = 0;//关卡号
    pass = 0;//本次是否通关
    gkCount = 0;//本次是第几次该关卡结束
    shareCount = 0;//本关 总分享数
    adCount = 0;//本关总看广告数
    adOpen = 0;//本关打开广告弹窗数
    shareOpen = 0;//本关打开 分享弹窗数
    diamond = 0;//本关消耗钻石数
    restartPark = 0;//复活加解锁车位
    restart = 0;//纯复活未解锁车位
    lockPard = 0;//纯解锁车位
    refresh = 0;//刷新
    clean = 0;//消除
    match = 0;//匹配
    person = 0;//本关玩家成功运走蔬菜（小人）数
    time = 0;//本关玩家耗时数
    itemCont = 0;//消耗道具总数
    abnormal_status_type = 0;// 状态类型 0 是正常 1 就是重复 2就是卡关
}

export class ReportLogNew {
    mapID = 0;//关卡号
    pass = 0;//1结束且过关，2结束未过关，3未结束主动退出
    shareReward = 0;//本关分享成功获得奖励数
    trueShareCount = 0;//本关真分享数（通过真分享返回获得奖励）
    adReward = 0;//本关看广告成功获得奖励数
    trueAdCount = 0;//本关真实看广告数（月卡跳过不算）
    adOpen = 0;//本关打开广告弹窗数（无论是否获得广告奖励）
    shareOpen = 0;//本关打开 分享弹窗数（无论是否分享成功）
    diamond = 0;//本关消耗钻石数
    time = 0;//本关玩家耗时数
    match = 0;//匹配
    refresh = 0;//刷新
    clean = 0;//消除
    Resulte1 = 0;// 本局只用了 点击消除 =1，本局只用了 滑动消除 =2，本局既用了点击消除，也用了滑动消除=3
}

export const DEFAULT_REQUEST_OPTIONS = {
    ignoreCache: false,
    headers: {
        // 'Accept': 'application/json, text/javascript, text/plain',
    },
    timeout: 5000,
};

export interface TableViewItem {
    scrollView: cc.ScrollView,
    itemPrefab: cc.Node,
    itemHeight: number,
    spacingY: number,
    diffY: number,
}

export type CaseMode = "preserve" | "upper" | "lower";

export interface RoleData {
    stage: number,
    max_stage: number,
    role_id: number,
    share_game: number,
    item: number,
    friends: number,
    friend_items: number,
    guide: string,
    rank_app: number,
    arena_app: number,
    rank_reward: number,
}

export interface LoginResponse {
    items: [],
    reward_items:[];
    role: RoleData,
    token: string,
}

export interface LoginRequest {
    session: string,
    name: string,
    openid: string,
    avatar: string,
    report: string,
}

export interface VipResponse {
    level: number,
}

export interface VipRequest {
    level: number,
}

export interface StageResponse {
    max_stage: number,
}

export interface StageRequest {
    pl: number,
}

export interface PlayTestRequest {
    id: number,
}

export interface PlayResponse {
    ad_count: number,
    ad_max: number,
    current_stage: number,
    end_time: number,
    link_count: number,
    max_stage: number,
    stage: number,
    map: string,
    plan: TPlan,
    friends: number,
    day_max: number,
}

export interface GuildRequest {
    guild: string,
}

export interface GuildResponse {
    guild: string,
}

export interface MapPlayRequest {
    id: number,
}

export interface MapPlayResponse {
    ad_count: number,
    ad_max: number,
    current_stage: number,
    end_time: number,
    max_stage: number,
    stage: number,
    map: string,
}

export interface MapPlayResultRequest {
    win: number,
    stage: number,
    id: number
}

export interface MapPlayResultResponse {
    friends: number,
    friend_items: number,
}

export interface MapRequest {
    map: string,
}

export interface MapResponse {
    max_count: number,
}

export interface MapPlayRewardRequest {
    id: number,
}

export interface RankStageRequest {
    id: number,
}

export interface RankStageResponse {
    ranks: {
        avatar: string,
        name: string,
        stage_time: number
    }[];
}

export interface MapPlayRewardResponse {
    friend_name: string[],
    friend_items: number,
    friends: number,
    items: [],
    show: [],
}

export interface ErrorResponse { msgId: string, msg: string }

export interface ReportRequest {
    data: string,
    type: number,
}
export interface ReportResponse {
    code: number,
    data: unknown,
    msg: string,
    time: number
}

export interface WinRequest {
    win: number,
    token: string,
    ad: number
}

export interface WinResponse {
    stage_id: number, next_id: number, items: [], show: [], win: number, stage_time: number,rank_reward:number

}

export interface ShareResponse {
    cate: number;
}

export interface ShareRequest {
    cate: number;
}

export interface ItemBuyResponse {
    items: { id: number, num: number }[];
}

export interface ItemBuyRequest {

    id: number;
    token: string;
}

export interface ItemUseResponse {
    id: number;
}

export interface ItemUseRequest {
    item: number;
    friend_items: number;
    items: { id: number, num: number }[];
}

export class Block {
    public id = 0;//普通图块
    public x = 0;
    public y = 0;
    public type = 0;//特殊图块
}

export class MapData {
    public id = 0;
    public width = 0;
    public height = 0;
    public dirction = 0;
    public linkCount = 0;
    public woodenState = 0;//0固定1随机
    public rocketState = 1;//0固定1随机

    public items: Block[] = [];
    public serverItems: number[][] = [];
}

export class Pos {
    public x = 0;
    public y = 0;
}

export interface MoveInfo {
    from: { w: number; h: number };
    to: { w: number; h: number };
};

export interface MoveAction {
    pos: Pos;
    step: number;
}

export type MoveInfoList = MoveInfo[];

export class TMap {
    id = 0;
    randomID = "";

}

export class TPlan {
    block1 = 0;
    block2 = 0;
    block3 = 0;
    block4 = 0;
    block5 = 0;
    block6 = 0;
    block7 = 0;
    block8 = 0;
    id = 0;
    tileTypes = 0;
    fleshRate1 = 0;
    fleshRate2 = 0;
    tile_types = 0;
    flesh_rate1 = 0;
    flesh_rate2 = 0;
    linkCount = 0;
}

export interface IUIState {
    enter(params?: unknown): Promise<void>;
    execute(dt: number): void;
    exit(): Promise<void>;
}

export interface Titem {
    rank: number;
    name: string;
    score: number;
    score1: number;
    avatar: string;
    value: number;
}

export class ShareMapData {
    public role_id = 0;
    public name = "";
    public data: MapData = new MapData();
    public plan: TPlan = new TPlan();
}