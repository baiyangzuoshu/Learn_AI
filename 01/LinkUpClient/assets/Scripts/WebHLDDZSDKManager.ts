import { util } from "../FrameWork/Utils/util";
import PlayerManager from "./Manager/PlayerManager";

export function HLDDZ_OnKeyCodeBackResult(ret: number) {
    util.Log("WebHLDDZSDKManager: HLDDZ_OnKeyCodeBackResult called.", ret);
}

export function HLDDZ_rankUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankUpdate called.", data);
    cb("1");
}

export function HLDDZ_rankGetScore(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankGetScore called.", data);
    cb("1");
}
export function HLDDZ_rankCreateChallenge(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankCreateChallenge called.", data);
    cb("1");
}
export function HLDDZ_rankonChallengeStart(cb: (res: unknown) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankonChallengeStart called.", cb);
    //cb("1");
}
export function HLDDZ_offChallengeStart(cb: (res: unknown) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_offChallengeStart called.");
    cb("1");
}
export function HLDDZ_rankmiddleUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankmiddleUpdate called.", data);
    cb("1");
}
export function HLDDZ_rankAbort(cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_rankAbort called.");
    cb("1");
}

export function HLDDZ_skipGame(): void {
    util.Log("WebHLDDZSDKManager: HLDDZ_skipGame called.");
}

export function HLDDZ_getExtraStr(cb: (data: string) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_getExtraStr called.");
    cb("");
}

export function HLDDZ_payDiamond(id: number, billNo: string, cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_payDiamond called.", id, billNo);
    PlayerManager.getInstance().HLDDZ_user.diamondCount -= 10;
    cb(1);
}

export function HLDDZ_getSafeArea(): cc.Vec2 {
    return new cc.Vec2(90, 40);
}

export function HLDDZ_queryViewableAdCount(cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_queryViewableAdCount called.");
    cb(1);
}

export function HLDDZ_requestAuth(cb: (data: number) => void): void {
    util.Log("WebHLDDZSDKManager: HLDDZ_requestAuth called.");
    cb(1);
}

export function HLDDZ_getPlayerProfile(cb: (data: number) => void): void {
    util.Log("WebHLDDZSDKManager: HLDDZ_getPlayerProfile called.");
    PlayerManager.getInstance().HLDDZ_user.nickName = "test";
    PlayerManager.getInstance().HLDDZ_user.userid = "test";
    cb(1);
}

export function HLDDZ_backTo(): void {
    util.Log("WebHLDDZSDKManager: HLDDZ_backTo called.");
}

export function HLDDZ_showRewardedVideoAd(cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_showRewardedVideoAd called.");
    cb(1);
}

export function HLDDZ_shareMessage(id: number, data: { realShare: boolean, rankName: string }, cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_shareMessage called.", id, data.realShare, data.rankName);
    let index = Math.ceil(Math.random() * 2);
    index = util.clamp(index, 1, 2);

    util.Log("shareId", index);
    cb(1);
}

export function HLDDZ_shareMessage2(data: { id: number, realShare: boolean, extraStr: string, cb: (data: number) => void }) {
    const { id, realShare, extraStr, cb } = data;
    util.Log("WebHLDDZSDKManager: HLDDZ_shareMessage2 called.", id, extraStr, realShare);
    let index = Math.ceil(Math.random() * 2);
    index = util.clamp(index, 1, 2);

    util.Log("shareId", index);
    cb(1);
}

export function HLDDZ_buyDiamond(cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_buyDiamond called.");
    cb(1);
}

export function HLDDZ_vibrateShort() {
    util.Log("HLDDZ_vibrateShort");
}

export function HLDDZ_onEnterFromShareLink(fn: () => void) {
    setTimeout(() => {
        fn();
    }, 1000);
}

export function HLDDZ_showShareRewardsGuide() {
    util.Log("HLDDZ_showShareRewardsGuide");
}

export function HLDDZ_useDiamondNum(num: number, cb: (data: number, shopid: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_useDiamondNum called.", num);
    const result = 1;
    const shopID = 1;
    cb(result, shopID);
}

export function HLDDZ_buyDiamondByShopID(id: number, cb: (data: number) => void) {
    util.Log("WebHLDDZSDKManager: HLDDZ_buyDiamondByShopID called.", id);
    PlayerManager.getInstance().HLDDZ_user.diamondCount += 300;
    const result = 1;

    cb(result);
}
