import { util } from "../FrameWork/Utils/util";
import { ShareType } from "./Constant";
import PlayerManager from "./Manager/PlayerManager";

function jumpUrl(url: string) {
    util.Log(`url = ${url}`);

    const shareUrl = `fakelink://${url}`;
    util.Log(`shareUrl = ${shareUrl}`);
    const ex = window.external as unknown as { sendGameFakeUrl: (data: string) => void };
    try {
        if (ex && ex.sendGameFakeUrl) {
            util.Log('PC');
            ex.sendGameFakeUrl(shareUrl);
        } else {
            const ua = navigator.userAgent.toLowerCase();
            util.Log(`userAgent = ${ua}`);

            if (ua.includes("openharmony")) {
                util.Log("HarmonyOS");
                location.href = shareUrl;
            } else if (ua.includes('android')) {
                util.Log('Android');
                confirm(shareUrl);
            } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || ua.includes('mac')) {
                util.Log('iOS');
                location.href = shareUrl;
            } else {
                console.error('不支持的平台');

                return false;
            }
        }
    } catch (error) {
        console.error(error);
    }

    return true;
}

const Operation = {
    getPlayerProfile: "&Operation=getPlayerProfile",
    requestAuth: "&Operation=requestAuth",
    PlayerAuth: "&Operation=PlayerAuth",
    backToHLDDZ: "&Operation=backToHLDDZ",
    showRewardedVideoAd: "&Operation=showRewardedVideoAd",
    shareMessage: "&Operation=shareMessage&shareId=",
    shareMessage2: "&Operation=shareMessage&shareId=30101&extraStr=",
    buyDiamond: "&Operation=buyDiamond",
    queryViewableAdCount: "&Operation=queryViewableAdCount",
    payDiamond: "&Operation=payDiamond&payDiamondId=",
    useDiamondNum: "&Operation=recommendBuyDiamond&useDiamondNum=",
    buyDiamondByShopID: "&Operation=buyDiamondByShopID&shopID=",
    skipGame: "&Operation=FromCPGameJumpDDZFakeLink&fakeLinkUrlId=25122101",
    OnKeyCodeBackResult: "&Operation=OnKeyCodeBackResult&action=",
};

export let awaitCB: unknown;

export function HLDDZ_OnKeyCodeBackResult(ret: number) {
    if (jumpUrl(Operation.OnKeyCodeBackResult + ret)) {
        util.Log("AppHLDDZSDKManager: HLDDZ_OnKeyCodeBackResult called.", ret);
    }
}

export function HLDDZ_rankUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankUpdate called.", data);
    cb("1");
}

export function HLDDZ_rankGetScore(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankGetScore called.", data);
    cb("1");
}
export function HLDDZ_rankCreateChallenge(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankCreateChallenge called.", data);
    cb("1");
}
export function HLDDZ_rankonChallengeStart(cb: (res: unknown) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankCreateChallenge called.", cb);
}
export function HLDDZ_offChallengeStart(cb: (res: unknown) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_offChallengeStart called.");
    cb("1");
}
export function HLDDZ_rankmiddleUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankmiddleUpdate called.", data);
    cb("1");
}
export function HLDDZ_rankAbort(cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_rankAbort called.");
    cb("1");
}

export function HLDDZ_skipGame(): void {
    util.Log("AppHLDDZSDKManager: HLDDZ_skipGame called.");
    if (jumpUrl(Operation.skipGame)) {
        util.Log("AppHLDDZSDKManager: HLDDZ_skipGame success.");
    }
}

export function HLDDZ_getExtraStr(cb: (data: string) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_getExtraStr called.");
    cb("");
}

export function HLDDZ_useDiamondNum(num: number, cb: (data: number, shopid: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_useDiamondNum called.", num);
    if (jumpUrl(Operation.useDiamondNum + num)) {
        awaitCB = cb;
    }
}

export function HLDDZ_buyDiamondByShopID(id: number, cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_buyDiamondByShopID called.", id);
    if (jumpUrl(Operation.buyDiamondByShopID + id)) {
        awaitCB = cb;
    }
}

export function HLDDZ_payDiamond(id: number, billNo: string, cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_payDiamond called.");
    //const billNo = PlayerManager.getInstance().HLDDZ_user.userid + Date.now();
    //10001001&billNo=
    if (jumpUrl(Operation.payDiamond + id + "&billNo=" + billNo)) {
        awaitCB = cb;
    }
}

export function HLDDZ_getSafeArea(): cc.Vec2 {
    return new cc.Vec2(PlayerManager.getInstance().cutWidth, 40);
}

export function HLDDZ_queryViewableAdCount(cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_queryViewableAdCount called.");

    if (jumpUrl(Operation.queryViewableAdCount)) {
        awaitCB = cb;
    }
}

export function HLDDZ_requestAuth(cb: (data: number) => void): void {
    util.Log("AppHLDDZSDKManager: HLDDZ_requestAuth called.");

    if (jumpUrl(Operation.requestAuth)) {
        awaitCB = cb;
    }
}

export function HLDDZ_getPlayerProfile(cb: (data: number) => void): void {
    util.Log("AppHLDDZSDKManager: HLDDZ_getPlayerProfile called.");

    if (jumpUrl(Operation.getPlayerProfile)) {
        awaitCB = cb;
    }
}

export function HLDDZ_backTo(): void {
    util.Log("AppHLDDZSDKManager: HLDDZ_backTo called.");

    jumpUrl(Operation.backToHLDDZ);
}

export function HLDDZ_showRewardedVideoAd(cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_showRewardedVideoAd called.");

    if (jumpUrl(Operation.showRewardedVideoAd)) {
        awaitCB = cb;
    }
}

export function HLDDZ_shareMessage(id: number, data: { realShare: boolean, rankName: string }, cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_shareMessage called.", data.realShare);
    let index = 1000401;

    if (ShareType.First == id) {
        const r = Math.floor(Math.random() * 3);
        index = util.clamp(r, 0, 2);
        index = 1000401 + index;
    }
    else if (ShareType.Rank == id) {
        const r = Math.floor(Math.random() * 3);
        index = util.clamp(r, 0, 2);
        index = 1000404 + index;
    }
    else if (ShareType.Win == id) {
        const r = Math.floor(Math.random() * 3);
        index = util.clamp(r, 0, 2);
        index = 1000407 + index;
    }

    console.warn("share", id, index);

    if (jumpUrl(Operation.shareMessage + index + "&extraStr=")) {
        awaitCB = cb;
    }

}

export function HLDDZ_shareMessage2(data: { id: number, realShare: boolean, extraStr: string, cb: (data: number) => void }) {
    const { id, realShare, extraStr, cb } = data;
    util.Log("AppHLDDZSDKManager: HLDDZ_shareMessage called.", realShare);
    let index = 1000413;

    if (ShareType.Share == id) {
        const r = Math.floor(Math.random() * 5);
        index = util.clamp(r, 0, 4);
        index = 1000413 + index;
    }

    console.warn("share", id, index);

    if (jumpUrl(Operation.shareMessage + index + "&extraStr=" + extraStr)) {
        awaitCB = cb;
    }
}

export function HLDDZ_buyDiamond(cb: (data: number) => void) {
    util.Log("AppHLDDZSDKManager: HLDDZ_buyDiamond called.");

    if (jumpUrl(Operation.buyDiamond)) {
        awaitCB = cb;
    }

}

export function HLDDZ_vibrateShort() {
    util.Log("HLDDZ_vibrateShort");
}
