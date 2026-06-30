
//import { platform } from 'minigame-std';

import { __HLDDZ_APP__, __HLDDZ_CP_DEV__, __HLDDZ_MINA__, __MINIGAME_STD_MINA__, platform } from "../sdk/hlddz-sdk";

import { EventManager } from "../FrameWork/manager/EventManager";
import { SoundManager } from "../FrameWork/manager/SoundManager";
import { util } from "../FrameWork/Utils/util";
import * as AppHLDDZSDKManager from "./AppHLDDZSDKManager";
import { UIControllerName, UIEventName } from "./Constant";
import * as HLDDZSDKManager from "./HLDDZSDKManager";
import PlayerManager from "./Manager/PlayerManager";
import ShareManager from './Manager/ShareManager';
import * as WebHLDDZSDKManager from "./WebHLDDZSDKManager";

export default class SDKAdapter {
    private static _instance: SDKAdapter;

    private constructor() {
        //
    }

    public static getInstance(): SDKAdapter {
        if (!SDKAdapter._instance) {
            SDKAdapter._instance = new SDKAdapter();
        }
        return SDKAdapter._instance;
    }

    isMiniPCGame() {
        return __MINIGAME_STD_MINA__&& (platform.isMiniGameWin() || platform.isMiniGameMac());
    }

    public isWebDev(){
        return __HLDDZ_CP_DEV__;
    }

    public isApp(){
        return __HLDDZ_APP__;
    }

    public isMini(){
        return __HLDDZ_MINA__;
    }

    public isAppHarmonyGame() {
        if (__HLDDZ_APP__) {
            const ua = navigator.userAgent.toLowerCase();
            if (ua.includes("openharmony")) {
                return true;
            }
        }

        return false;
    }
    //擂台赛功能
    HLDDZ_rankUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankUpdate(data, cb);
    }
    //查询用户最新得分
    HLDDZ_rankGetScore(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankGetScore(data, cb);
    }
    //创建擂台赛
    HLDDZ_rankCreateChallenge(data: { scoreKey: string, subScoreKey: number }, cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankCreateChallenge(data, cb);
    }
    //监听擂台赛开始事件
    HLDDZ_rankonChallengeStart(cb: (res: unknown) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankonChallengeStart(cb);
    }
    HLDDZ_offChallengeStart(cb: (res: unknown) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_offChallengeStart(cb);
    }
    //中途上报分数。擂台赛的最终分数将取中途上报分数和最终上报分数中最高的一次。中途上报不会结束擂台赛
    HLDDZ_rankmiddleUpdate(data: { scoreKey: string, score: number, subScoreKey: number }, cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankmiddleUpdate(data, cb);
    }
    //中途退出擂台赛
    HLDDZ_rankAbort(cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_rankAbort(cb);
    }
    //
    HLDDZ_skipGame() {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_skipGame();
    }

    HLDDZ_getExtraStr(cb: (data: string) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_getExtraStr(cb);
    }

    HLDDZ_requestAuth(cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_requestAuth(cb);
    }

    HLDDZ_getPlayerProfile(cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_getPlayerProfile(cb);
    }

    HLDDZ_showRewardedVideoAd(cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_showRewardedVideoAd(cb);
    }

    HLDDZ_shareMessage(id: number, data: { realShare: boolean, rankName: string }, cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_shareMessage(id, data, cb);
    }

    HLDDZ_shareMessage2(data: { id: number, realShare: boolean, extraStr: string, cb: (data: number) => void }) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_shareMessage2(data);
    }

    HLDDZ_buyDiamond(cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_buyDiamond(cb);
    }

    HLDDZ_backTo() {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_backTo();
    }

    HLDDZ_queryViewableAdCount(cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_queryViewableAdCount(cb);
    }

    HLDDZ_payDiamond(id: number, billNo: string, cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_payDiamond(id, billNo, cb);
    }

    HLDDZ_vibrateShort() {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_vibrateShort();
    }

    HLDDZ_getSafeArea(): cc.Vec2 {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_getSafeArea();
    }
    //设置从分享链接进入的回调。
    HLDDZ_onEnterFromShareLink(fn: () => void) {
        if (__HLDDZ_MINA__) {
            HLDDZSDKManager.HLDDZ_onEnterFromShareLink(fn);
        }
    }

    HLDDZ_showShareRewardsGuide() {
        if (__HLDDZ_MINA__) {
            HLDDZSDKManager.HLDDZ_showShareRewardsGuide();
        }
    }
    //月卡充值
    HLDDZ_useDiamondNum(num: number, cb: (data: number, shopid: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_useDiamondNum(num, cb);
    }
    HLDDZ_buyDiamondByShopID(id: number, cb: (data: number) => void) {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_buyDiamondByShopID(id, cb);
    }

    HLDDZ_OnKeyCodeBackResult(ret: number): void {
        return (__HLDDZ_MINA__ ? HLDDZSDKManager : __HLDDZ_APP__ ? AppHLDDZSDKManager : WebHLDDZSDKManager).HLDDZ_OnKeyCodeBackResult(ret);
    }
}

if (__HLDDZ_APP__) {
    // 响应显示激励广告
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspShowRewardedVideoAd = (isSuccess: number) => {//isSuccess为整形 0:成功，大于0：失败
        console.warn(`rspShowRewardedVideoAd isSuccess = ${isSuccess}`);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == isSuccess) {
            cb(1);
        }
        else {
            /*
            isSuccess=1：点击看广告按钮后，出现轻度提示【地主哥正在准备广告，请稍后再来】
            isSuccess=2，3： 点击看广告按钮后，出现轻度提示【真抱歉，当前暂无可观看的广告】
            isSuccess=4： 返回到看广告按钮界面，不做任何提示（这个场景是 广告没看完玩家提前点了返回）
            */
            cb(-isSuccess);
        }
    };

    // 响应可用广告数目查询
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspqueryViewableAdCount = (canCPMiniGameAd: number) => {//canCPMiniGameAd 为整形 0:能，大于0：不能
        console.warn(`rspqueryViewableAdCount   isSuccess = ${canCPMiniGameAd}`);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == canCPMiniGameAd) {
            cb(1);
        }
        else {
            //canCPMiniGameAd > 0 :  点击按钮后，出现轻度提示【地主哥正在准备广告，请稍后再来】
            cb(0);
        }
    };

    // 响应授权请求
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/max-params
    (window as any).rspRequestAuth = (result: number, sessionKey: string, userId: string, netType: number, canBuyDiamond: number, musicOn: number, soundEffectOn: number, extraStr: string, channelId: number) => {
        console.warn(`rspRequestAuth sessionKey = ${sessionKey}, userId = ${userId}, netType = ${netType}, canBuyDiamond = ${canBuyDiamond}, musicOn = ${musicOn}, soundEffectOn = ${soundEffectOn}, result = ${result}, extraStr = ${extraStr}, channelId = ${channelId}`);
        EventManager.getInstance().emit(UIEventName.UIRoot_Log, `rspRequestAuth sessionKey = ${sessionKey}, userId = ${userId}, netType = ${netType}, canBuyDiamond = ${canBuyDiamond}, musicOn = ${musicOn}, soundEffectOn = ${soundEffectOn}, result = ${result}, extraStr = ${extraStr}, channelId = ${channelId}`);

        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        PlayerManager.getInstance().HLDDZ_user.sessionKey = sessionKey;
        PlayerManager.getInstance().HLDDZ_user.userid = userId;
        PlayerManager.getInstance().netType = netType;
        PlayerManager.getInstance().canBuyDiamond = canBuyDiamond;
        PlayerManager.getInstance().musicOn = musicOn;
        PlayerManager.getInstance().soundEffectOn = soundEffectOn;
        PlayerManager.getInstance().extraStr = extraStr;
        PlayerManager.getInstance().channelId = channelId;

        SoundManager.Instance.SetMusicMute(musicOn == 1);
        SoundManager.Instance.SetSoundMute(soundEffectOn == 1);

        if (0 == result) {
            cb(1);
        }
        else {
            cb(0);
        }
    };

    // 响应获取玩家信息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/max-params
    (window as any).rspGetPlayerProfile = (accessToken: string, accessType: number, avatarUrl: string, clientType: number, diamondCount: number, nickName: string, openId: number, refreshToken: number, uin: number, cutWidth: number) => {
        console.warn(`rspGetPlayerProfile accessToken = ${accessToken}, accessType = ${accessType}, avatarUrl = ${avatarUrl}, cutWidth = ${cutWidth}, openId = ${openId}, refreshToken = ${refreshToken}, uin = ${uin}, diamondCount = ${diamondCount}`);
        //1. accessType：1为微信；0，2，4为qq
        //2. clientType：13为iOS；64为安卓；32，33为PC；136为小游戏安卓；263小游戏ios; 152为小游戏PC
        if (1 == accessType) {
            PlayerManager.getInstance().HLDDZ_user.accountType = 1;
        }
        else {
            PlayerManager.getInstance().HLDDZ_user.accountType = 2;
        }

        if (13 == clientType) {
            PlayerManager.getInstance().HLDDZ_user.clientType = 1;
        }
        else {
            PlayerManager.getInstance().HLDDZ_user.clientType = 2;
        }

        PlayerManager.getInstance().HLDDZ_user.avatarUrl = avatarUrl;
        PlayerManager.getInstance().HLDDZ_user.clientType = clientType;
        PlayerManager.getInstance().HLDDZ_user.diamondCount = diamondCount;
        PlayerManager.getInstance().HLDDZ_user.nickName = nickName;

        PlayerManager.getInstance().cutWidth = cutWidth;
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        cb(1);

    };

    // 响应购买钻石
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspBuyDiamond = (isSuccess: number, curDiamond: number) => {//isSuccess为整形 0:成功，大于0：失败， curDiamond:为当前钻石数
        console.warn(`rspBuyDiamond isSuccess = ${isSuccess}, curDiamond = ${curDiamond}`);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == isSuccess) {
            PlayerManager.getInstance().HLDDZ_user.diamondCount = curDiamond;
            cb(1);
        }
        else {
            cb(0);
        }
    };

    // 响应分享消息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspShareMessage = (shareID: number, isSuccess: number) => {//isSuccess为整形 0:成功，大于0：失败
        console.warn(shareID, `rspShareMessage isSuccess = ${isSuccess}`);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == isSuccess) {
            cb(1);
        }
        else {
            cb(0);
        }
    };

    // 响应通过分享进入游戏
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspCpMiniGameByShare = (extraStr: string) => {//extraStr 拉起游戏后，带回来的自定义内容，用作小游戏内的系统跳转
        util.Log(`rspCpMiniGameByShare extraStr = ${extraStr}`);
        PlayerManager.getInstance().extraStr = extraStr;
        EventManager.getInstance().emit(UIEventName.UIRoot_Log, "rspCpMiniGameByShare extraStr =" + PlayerManager.getInstance().extraStr);
        if (PlayerManager.getInstance().extraStr && PlayerManager.getInstance().extraStr.length > 0) {
            if (PlayerManager.getInstance().HLDDZ_user.userid == "") return;

            ShareManager.getInstance().parseExtraStr();
        }
    };

    //CP小游戏扣钻回包：result为整形 0:成功，大于0：失败， payDiamondCount:扣掉的钻石数, leftDiamond:为当前钻石数, billno:帐单id(string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/max-params
    (window as any).rspPayDiamond = (result: number, payDiamondCount: number, leftDiamond: number, billno: number) => {
        console.warn("rspPayDiamond ", result, payDiamondCount, leftDiamond, billno);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == result) {
            PlayerManager.getInstance().HLDDZ_user.diamondCount = leftDiamond;
            cb(1);
        }
        else {
            /*
            result=1，钻石为0：弹窗提示：您的钻石不足，是否要花费3元…… （钻石不足提示充值的流程）
            result=100016，弹窗提示：您的钻石不足，是否要花费3元…… （钻石不足提示充值的流程）
            result=其他：弹窗提示：“扣钻失败，请重新尝试” 【确定】按钮
            */
            cb(-result);
        }
    };

    //CP小游戏根据商品id充值回包： -->
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspbuyDiamondByShopID = (result: number, curDiamondNum: number) => {
        console.warn("rspbuyDiamondByShopID ", result, curDiamondNum);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number) => void;
        if (0 == result) {
            PlayerManager.getInstance().HLDDZ_user.diamondCount = curDiamondNum;
            cb(1);
        }
        else {
            cb(-result);
        }
    };

    //CP小游戏获取推荐充值数据回包： -->
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/max-params
    (window as any).rspRecommendBuyDiamond = (result: number, shopid: number, lacknum: number, chargePrice: number, getDiamondNum: number) => {
        //result: 0 成功获取推荐购钻id；1：不需要充值，本地钻石够；2：没有需要的充值档位
        //shopid: 推荐的购钻id（充值时调用接口需要）
        //lacknum: 缺少的钻石
        //chargePrice：需要的金额
        //getDiamondNum: 充值的钻石数
        console.warn("rspRecommendBuyDiamond ", result, shopid, lacknum, chargePrice, getDiamondNum);
        const cb = AppHLDDZSDKManager.awaitCB as unknown as (data: number, shopid: number) => void;
        if (0 == result) {
            cb(1, shopid);
        }
        else {
            cb(-result, 0);
        }

    };

    //H5返回键处理回调
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).rspKeyCodeBack = () => {
        console.warn("rspKeyCodeBack ");
        EventManager.getInstance().emit(UIControllerName.UIController_UIKeyExit);
        SDKAdapter.getInstance().HLDDZ_OnKeyCodeBackResult(0);
    };
}