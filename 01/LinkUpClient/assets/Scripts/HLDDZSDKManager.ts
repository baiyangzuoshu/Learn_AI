//import * as hlddzSdk from 'hlddz-sdk';
//import { platform } from 'minigame-std';
import { SoundManager } from '../FrameWork/manager/SoundManager';
import { util } from "../FrameWork/Utils/util";
import { ShareType } from './Constant';
import PlayerManager from "./Manager/PlayerManager";
import type { HLDDZ_USER } from './types';

export async function HLDDZ_skipGame() {
    util.Log("HLDDZSDKManager: HLDDZ_skipGame called.");

    const url = "&Operation=OpenActivityCenter&Tab=1&ContentID=1086";

    await hlddzSdk.runFakeLink(url);
}

export async function HLDDZ_getExtraStr(cb: (data: string) => void) {
    const x = hlddzSdk.getExtraStr();
    cb(x);
}

export async function HLDDZ_useDiamondNum(num: number, cb: (data: number, shopid: number) => void) {
    const myPromise = await hlddzSdk.recommendBuyDiamond(num);

    myPromise.inspect((x: hlddzSdk.RecommendBuyResult) => {
        cb(1, x.shopid);
    })
    myPromise.inspectErr((err: number) => {
        console.warn("HLDDZ_buyDiamondByShopID:", err);
        cb(0, 0);
    });
}

export async function HLDDZ_buyDiamondByShopID(id: number, cb: (data: number) => void) {
    const myPromise = await hlddzSdk.buyDiamondByShopID(id);

    myPromise.inspect(() => {
        cb(1);
    })
    myPromise.inspectErr((err: { message: string; }) => {
        console.warn("HLDDZ_buyDiamondByShopID:", err);
        cb(0);
    });
}

export async function HLDDZ_payDiamond(id: number, billNo: string, cb: (data: number) => void) {
    //const billNo = PlayerManager.getInstance().HLDDZ_user.userid + Date.now();
    const options = { payDiamondId: id, billNo: billNo };

    const myPromise = (await hlddzSdk.payDiamond(10004, options));

    myPromise.inspect((x: number) => {
        PlayerManager.getInstance().HLDDZ_user.diamondCount = x;
        cb(1);
    })
    myPromise.inspectErr((err: unknown) => {
        console.warn('HLDDZ_payDiamond', err);
        cb(-2);
    });
}

export function HLDDZ_getSafeArea(): cc.Vec2 {
    const rect = cc.sys.getSafeAreaRect();
    return new cc.Vec2(Math.max(rect.x, rect.y), rect.y);
}

export function HLDDZ_backTo() {
    hlddzSdk.backToHLDDZ();
}

export function HLDDZ_queryViewableAdCount(cb: (data: number) => void) {
    const count = hlddzSdk.queryViewableAdCount();//1可以看 0次数用完

    cb(count);
}

export async function HLDDZ_requestAuth(cb: (data: number) => void) {
    const myPromise = (await hlddzSdk.requestAuth(10004))

    myPromise.inspect((x: hlddzSdk.PlayerAuth) => {

        PlayerManager.getInstance().HLDDZ_user.sessionKey = x.sessionKey;
        PlayerManager.getInstance().HLDDZ_user.userid = x.userid;
        PlayerManager.getInstance().netType = x.netType;
        PlayerManager.getInstance().canBuyDiamond = x.canBuyDiamond;
        PlayerManager.getInstance().musicOn = x.musicOn;
        PlayerManager.getInstance().soundEffectOn = x.soundEffectOn;
        //PlayerManager.getInstance().expStrategy = x.expStrategy;
        PlayerManager.getInstance().extraStr = x.extraStr;
        PlayerManager.getInstance().channelId = x.channelId;
        PlayerManager.getInstance().expStrategies = x.expStrategies;
        const challengeStartResult = x.challengeStartResult;
        console.error("challengeStartResult=", challengeStartResult);
        console.error("extraStr=", PlayerManager.getInstance().extraStr);
        console.error("expStrategies=", PlayerManager.getInstance().expStrategies);
        if (challengeStartResult) {
            PlayerManager.getInstance().scoreKey = challengeStartResult.scoreKey;
            PlayerManager.getInstance().subScoreKey = challengeStartResult.subScoreKey || 0;
        }

        SoundManager.Instance.SetMusicMute(x.musicOn == 1);
        SoundManager.Instance.SetSoundMute(x.soundEffectOn == 1);
        cb(1);
    })
    myPromise.inspectErr((err: unknown) => {
        console.warn('HLDDZ_requestAuth', err);
        cb(0);
    });
}

export async function HLDDZ_getPlayerProfile(cb: (data: number) => void) {
    const data: HLDDZ_USER = hlddzSdk.getPlayerProfile() as unknown as HLDDZ_USER;
    /*clientType
    QQ小游戏
    HL_CLIENT_ANDROID_QQ_MINA = 138,
    HL_CLIENT_IOS_QQ_MINA = 265,

    腾讯斗地主，基于微信小游戏+20
    HL_CLIENT_TXDDZ_WX_ANDROID = 156,
    HL_CLIENT_TXDDZ_WX_IOS = 283,
    HL_CLIENT_TXDDZ_WX_PC =172,
    */

    PlayerManager.getInstance().HLDDZ_user.accountType = data.accountType;
    PlayerManager.getInstance().HLDDZ_user.clientType = data.clientType;
    PlayerManager.getInstance().HLDDZ_user.avatarUrl = data.avatarUrl;
    PlayerManager.getInstance().HLDDZ_user.diamondCount = data.diamondCount;
    PlayerManager.getInstance().HLDDZ_user.nickName = data.nickName;

    cb(1);
}

export async function HLDDZ_showRewardedVideoAd(cb: (data: number) => void) {
    const myPromise = await hlddzSdk.showRewardedVideoAd()

    myPromise.inspect(() => {
        cb(1);
    })

    myPromise.inspectErr((err: { message: string }) => {
        console.warn("HLDDZ_showRewardedVideoAd:", err);
        cb(0);
    });
}

export async function HLDDZ_shareMessage(id: number, data: { realShare: boolean, rankName: string }, cb: (data: number) => void) {
    let text = "LlkFirstPageShare1";
    if (ShareType.First == id) {
        const r = Math.ceil(Math.random() * 3);
        const index = util.clamp(r, 1, 3);
        text = "LlkFirstPageShare" + index;
    }
    else if (ShareType.Rank == id) {
        const r = Math.ceil(Math.random() * 3);
        const index = util.clamp(r, 1, 3);
        text = "LlkRankShare" + index;
    }
    else if (ShareType.Win == id) {
        const r = Math.ceil(Math.random() * 3);
        const index = util.clamp(r, 1, 3);
        text = "LlkWinShare" + index;
    }
    else if (ShareType.Union == id) {
        text = "LlkQunRankShare";
    }

    const ret = data.rankName != "" ? { realShare: data.realShare, rankName: data.rankName } : { realShare: data.realShare }
    const myPromise = await hlddzSdk.shareMessage(text, ret);
    console.warn("shareId", id, text, ret);

    myPromise.inspect(() => {
        util.Log("HLDDZ_shareMessage:1");
        cb(1);
    })
    myPromise.inspectErr((err: { message: string; }) => {
        console.warn("HLDDZ_shareMessage:", err);
        cb(0);
    });
}

export async function HLDDZ_shareMessage2(data: { id: number, realShare: boolean, extraStr: string, cb: (data: number) => void }) {
    const { id, realShare, extraStr, cb } = data;
    let text = "LlkHelpShare1";

    if (ShareType.Share == id) {
        const r = Math.ceil(Math.random() * 5);
        const index = util.clamp(r, 1, 5);
        text = "LlkHelpShare" + index;
    }
    //text = "SscwRankShare1";
    console.log("shareId", id, text, extraStr);

    const myPromise = await hlddzSdk.shareMessage(text, { realShare: realShare, extraStr: extraStr });

    myPromise.inspect(() => {
        util.Log("HLDDZ_shareMessage:1");
        cb(1);
    })
    myPromise.inspectErr((err: { message: string; }) => {
        console.warn("HLDDZ_shareMessage:", err);
        cb(0);
    });
}

export async function HLDDZ_buyDiamond(cb: (data: number) => void) {
    const myPromise = await hlddzSdk.buyDiamond();

    myPromise.inspect(() => {
        util.Log("HLDDZ_buyDiamond:1");
        cb(1);
    })
    myPromise.inspectErr((err: { message: string; }) => {
        console.warn("HLDDZ_buyDiamond:", err);
        cb(0);
    });
}

/**
 * 封装微信小程序的 wx.vibrateShort 方法，触发设备的短震动。
 */
export function HLDDZ_vibrateShort(): void {
    if (platform.isMiniGame()) {
        // 调用 wx.vibrateShort 方法
        wx.vibrateShort({
            // 可选参数 type，指定震动类型：'heavy' 或 'light'
            type: 'heavy',
            // 这里我们使用默认震动类型，如需自定义，可在调用函数时进行扩展
            success: function () {
                // 震动成功，调用回调函数传递成功信息
                util.Log('震动成功');
            },
            fail: function () {
                // 震动失败，调用回调函数传递错误信息
                util.Log('震动失败');
            },
            complete: function () {
                // 震动操作完成，无论成功或失败都会调用此回调
                util.Log('wx.vibrateShort 操作完成');
            }
        });
    }
}

//
export async function HLDDZ_onEnterFromShareLink(fn: () => void) {
    hlddzSdk.onEnterFromShareLink(fn);
}

export async function HLDDZ_showShareRewardsGuide() {
    hlddzSdk.showShareRewardsGuide();
}
//上报用户分数
export async function HLDDZ_rankUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    if (platform.isMiniGame()) {
        // 获取擂台赛管理器实例
        const rankManager = wx.getRankManager();
        // 上报用户分数
        rankManager.update({
            scoreKey: data.scoreKey, // 在MP配置的scoreKey
            score: data.score * 1000, // 具体分数值
            subScoreKey: data.subScoreKey,//可选子 key，正整数，取值范围1-1000。该参数可用于游戏同一玩法的关卡区分，从基础库版本3.12.1开始支持
            success: function (res: unknown) {
                console.warn('分数上报成功', res, data);
                cb("1");
            },
            fail: function (err: unknown) {
                console.warn('分数上报失败', err, data);
                cb("0");
            },
        });
    }
}
//查询用户最新得分
export async function HLDDZ_rankGetScore(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    if (platform.isMiniGame()) {
        const rankManager = wx.getRankManager()
        rankManager.getScore({
            scoreKeys: [data.scoreKey],
            periodType: 1, // 自然日最高分
            success: function (res: unknown) {
                console.warn('分数信息', res, data)
                cb("1");
                //cb("" + res.scores['score_key'].score);
                // res.scores 格式: { 'score_key': { score: 100, timestamp: 1234567890 } }
            }
        })
    }
}

export async function HLDDZ_rankCreateChallenge(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
    if (platform.isMiniGame()) {
        // 发起擂台赛
        wx.getRankManager().createChallenge({
            scoreKey: data.scoreKey,
            subScoreKey: data.subScoreKey,
            success: function (res: unknown) {
                console.warn('擂台赛创建成功', res, data);
                cb("1");
            },
            fail: function (err: unknown) {
                console.warn('擂台赛创建失败', err, data);
                cb("0");
            },
        });
    }
}

export async function HLDDZ_rankonChallengeStart(cb: (res: unknown) => void) {
    if (platform.isMiniGame()) {
        // 监听擂台赛开始事件
        const rankManager = wx.getRankManager()
        rankManager.onChallengeStart(cb);
    }
}
export async function HLDDZ_offChallengeStart(cb: (res: unknown) => void) {
    if (platform.isMiniGame()) {
        // 取消监听擂台赛开始事件
        const rankManager = wx.getRankManager()
        rankManager.offChallengeStart(cb);
    }
}

export async function HLDDZ_rankmiddleUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
    if (platform.isMiniGame()) {
        // 游戏过程中上报中间分数
        wx.getRankManager().middleUpdate({
            scoreKey: data.scoreKey,
            score: data.score * 1000, // 当前分数

            success: function (res: unknown) {
                console.warn('中途分数上报成功', res, data);
                cb("1");
            },
            fail: function (err: unknown) {
                console.warn('中途分数上报失败', err, data);
                cb("0");
            },
        });
    }
}

export async function HLDDZ_rankAbort(cb: (data: string) => void) {
    if (platform.isMiniGame()) {
        // 中途退出擂台赛
        wx.getRankManager().abort({
            success: function (res: unknown) {
                console.warn('擂台赛退出成功', res);
                cb("1");
            },
            fail: function (err: unknown) {
                console.warn('擂台赛退出失败', err);
                cb("0");
            },
        });
    }
}

export async function HLDDZ_OnKeyCodeBackResult(ret: number) {
    util.Log("HLDDZSDKManager: HLDDZ_OnKeyCodeBackResult called.", ret);
}
