import HttpManager from "../../FrameWork/manager/HttpManager";
import LoadRemoteManager from "../../FrameWork/manager/LoadRemoteManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { ArtPath, BundleName, GameType, NetRequestCode, SDKState, SeverIPs, ShareType, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import type { ErrorResponse, MapPlayRewardRequest, MapPlayRewardResponse, PlayResponse, PlayTestRequest, Titem } from "../types";
import MainMap from "./MainMap";
import UIBackUICtrl from "./UIBackUICtrl";
import UIScoreUICtrl from "./UIScoreUICtrl";

const timeAwait = 2;

export default class UIMainUICtrl extends UIComponent {
    private realHeight = 0;
    private btnAwait = 0;
    private tsMainMap!: MainMap;
    updateTime = 0;
    onLoad() {
        super.onLoad();

        ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_duigou, cc.Prefab);

        this.AddDelayButtonListener("bottom/startBtn", this.clickStartBtn, this);
        this.AddDelayButtonListener("bottom/setBtn", this.clickSetBtn, this);
        this.AddDelayButtonListener("bottom/unionBtn", this.clickUnionBtn, this);
        this.AddDelayButtonListener("bottom/shareBtn", this.clickShareBtn, this);
        this.AddDelayButtonListener("top/backBtn", this.clickBackBtn, this);
        this.AddDelayButtonListener("bottom/scoreBtn", this.clickScoreBtn, this);
        this.AddDelayButtonListener("bottom/rankBtn", this.clickRankBtn, this);
        this.AddDelayButtonListener("right/curBtn", this.jumpToMap.bind(this, true), this);

        this.addUIEventListener(UIEventName.UIMain_refreshShareBtn, this.refreshShareBtn, this);

        this.adaptMain();

        this.tsMainMap = this.node.addComponent(MainMap);
        this.tsMainMap.loadTableView(this.realHeight);

        this.getChildByUrl("bottom/startBtn/gk").active = PlayerManager.getInstance().pass_stage < GameManager.getInstance().maxMapID;
        this.getChildByUrl("bottom/startBtn/gk").getComponent(cc.Label).string = "第" + PlayerManager.getInstance().getMapID() + "关";
        this.getChildByUrl("bottom/shareBtn/hot").active = PlayerManager.getInstance().share_game == 0;

        this.getChildByUrl("bottom/shareBtn").active=!SDKAdapter.getInstance().isAppHarmonyGame();

        
        this.getChildByUrl("bottom/unionBtn").active = false//!SDKAdapter.getInstance().isApp() && 1 == PlayerManager.getInstance().rank_app;
        this.getChildByUrl("bottom/scoreBtn").active = false;

        HttpManager.Instance.request<MapPlayRewardResponse, MapPlayRewardRequest>(
            { msgId: NetRequestCode.MapPlayReward, param: { "id": 0 } },
            this._onMapPlayRewardSuccess.bind(this),
            this._onMapPlayRewardFailed.bind(this)
        );

        if (PlayerManager.getInstance().rank_reward > 0) {
            HttpManager.Instance.request<MapPlayRewardResponse, MapPlayRewardRequest>(
                { msgId: NetRequestCode.RewardScore, param: { "id": 0 } },
                this._onRewardScoreSuccess.bind(this),
                this._onMapPlayRewardFailed.bind(this)
            );
        }

        if (PlayerManager.getInstance().subScoreKey > 0) {
            const ret = PlayerManager.getInstance();
            console.warn('擂台赛开始', ret.scoreKey);
            console.warn('关卡数', ret.subScoreKey);
            this.emitUI(UIControllerName.UIController_rankonChallengeStart, { scoreKey: ret.scoreKey, subScoreKey: ret.subScoreKey });
            PlayerManager.getInstance().subScoreKey = 0;
        }

        //通用奖励
        const show = PlayerManager.getInstance().reward_items;
        const arr: { id: number, num: number }[] = [];
        for (let i = 0; i < show.length; i++) {
            if (show[i] <= 0) continue;

            arr.push({ id: i, num: show[i] });
        }
        if (arr.length <= 0) return;

        this.emitUI(UIControllerName.UIController_UIRewardCommon, { type: 2, arr });
        PlayerManager.getInstance().reward_items = [];
    }

    jumpToMap(isCur: boolean) {
        this.tsMainMap.jumpToMap(isCur);
    }

    startTouch() {
        this.getChildByUrl("touch").active = false;
    }

    async start() {
        const timeLabel = this.getChildByUrl("top/backBtn/num").getComponent(cc.Label);
        timeLabel.string = util.getCurrentTimeString();
        this.getChildByUrl("bottom/shadow1").active = false;
        this.getChildByUrl("bottom/shadow2").active = false;
        this.getChildByUrl("gk").active = SeverIPs.official != HttpManager.address;
        const gkEditBox = this.getChildByUrl("gk/EditBox").getComponent(cc.EditBox);
        if (gkEditBox) gkEditBox.string = PlayerManager.getInstance().getMapID() + "";

        if (!SDKAdapter.getInstance().isWebDev()) {
            HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
                msgId: NetRequestCode.Rank, param: { "id": 1 }
            }, this._onRankSuccess.bind(this), this._onRankFailed.bind(this));
        }
    }

    adaptMain(): void {
        const frameSize = cc.view.getFrameSize();
        const visibleSize = cc.view.getVisibleSize();
        const designSize = cc.view.getDesignResolutionSize();
        const realSize = new cc.Rect(0, 0, 0, 0);
        const curDesign = new cc.Rect(0, 0, util.getDesignSize().width, util.getDesignSize().height);
        const designWidth = curDesign.width;
        const designHeight = curDesign.height;
        realSize.width = designWidth;
        realSize.height = designWidth / (frameSize.width / frameSize.height);
        this.realHeight = util.clamp(realSize.height, designHeight, designHeight * 2);
        const rect = cc.sys.getSafeAreaRect();
        console.warn("safeAreaRect", rect.x, rect.y, rect.width, rect.height);
        console.warn("designSize", designSize.width, designSize.height);
        console.warn("frameSize", frameSize.width, frameSize.height);
        console.warn("visibleSize", visibleSize.width, visibleSize.height);

        if (realSize.height <= designHeight) {
            this.getChildByUrl("top").setPosition(0, 0);
            return;
        }
        const area = cc.v2(60, 60);
        this.getChildByUrl("bottom").setPosition(0, -(realSize.height - designHeight) / 2);
        const diffY = realSize.height / 2 - designHeight / 2 - area.y;
        if (diffY > 0) this.getChildByUrl("top").setPosition(0, diffY);
    }

    refreshShareBtn() {
        this.getChildByUrl("bottom/shareBtn/hot").active = PlayerManager.getInstance().share_game == 0;
    }

    _onRewardScoreSuccess(res: MapPlayRewardResponse) {
        util.Log("_onRewardScoreSuccess", res);
        PlayerManager.getInstance().rank_reward = 0;
        const items = res["items"] || [];
        for (const item of items) {
            PlayerManager.getInstance().magic[item["id"]] = item["num"];
        }
        const show = res["show"] || [];
        const arr: { id: number, num: number }[] = [];
        for (const item of show) {
            arr.push({ id: item["id"], num: item["num"] });
        }
        if (arr.length <= 0) return;

        this.emitUI(UIControllerName.UIController_UIRewardCommon, { type: 1, arr });
    }

    _onMapPlayRewardSuccess(res: MapPlayRewardResponse) {
        util.Log("MapPlayRewardSuccess", res);
        PlayerManager.getInstance().friends = 0;
        const add = res["friends"];
        PlayerManager.getInstance().friend_items = res["friend_items"];
        const names: string[] = [];
        for (const f of res["friend_name"]) names.push(f);
        this.emitUI(UIControllerName.UIController_uiShareReward, { names: names, add: add });
    }
    _onMapPlayRewardFailed(res: ErrorResponse) {
        util.Log("MapPlayRewardFailed", res);
    }

    clickRankBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (this.btnAwait > 0) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "操作过于频繁，请稍后再试！" });
            return;
        }
        this.btnAwait = timeAwait;
        this.emitUI(UIControllerName.UIController_uiRank);
    }

    clickStartBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (GameManager.getInstance().maxMapID <= PlayerManager.getInstance().pass_stage) {
            this.emitUI(UIControllerName.UIController_uiCommon, { type: 1, texts: ["全部通关", "敬请期待后续关卡更新"] });
            return;
        }
        if (SeverIPs.official != HttpManager.address) {
            const gkEditBox = this.getChildByUrl("gk/EditBox").getComponent(cc.EditBox);
            const mapID = gkEditBox ? Number(gkEditBox.string) : PlayerManager.getInstance().getMapID();
            PlayerManager.getInstance().setMapID(mapID);
        }
        this.netPlay();
    }

    netPlay() {
        const params: PlayTestRequest = { "id": PlayerManager.getInstance().getMapID() };
        let msgId = NetRequestCode.Play;
        if (PlayerManager.getInstance().vipLevel == 1) {
            msgId = NetRequestCode.Playvip;
        }
        else if (PlayerManager.getInstance().vipLevel == 2) {
            msgId = NetRequestCode.PlayC;
        }
        else if (SeverIPs.official == HttpManager.address) {
            msgId = NetRequestCode.Play;
        }
        else {
            msgId = NetRequestCode.PlayTest;
        }

        HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
            msgId: msgId,
            param: params
        }, this._onPlaySuccess.bind(this), this._onPlayFailed.bind(this));
    }

    _onPlaySuccess(response: PlayResponse) {
        GameManager.getInstance().setDataMap(response);
        UIManager.Instance.DestroyUIView(UIName.UIMain);
        this.emitUI(UIControllerName.UIController_uiGame, { gameType: GameType.Normal });
    }

    _onPlayFailed(response: ErrorResponse) {
        console.error("PlayFailed", response);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    clickSetBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (this.btnAwait > 0) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "操作过于频繁，请稍后再试！" });
            return;
        }
        this.btnAwait = timeAwait;
        this.emitUI(UIControllerName.UIController_uiSet, { type: 0 });
    }

    clickUnionBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);

        GameManager.getInstance().sdkState = SDKState.Share;
        GameManager.getInstance().report.shareOpen++;
        SDKAdapter.getInstance().HLDDZ_shareMessage(ShareType.Union, { realShare: false, rankName: "stage" }, (data: number) => {
            GameManager.getInstance().sdkState = SDKState.None;
            SoundManager.Instance.ResumeMusic();
            util.Log(data);
            if (data === 0) {
                util.Log(data);
            } else {
                util.Log(data);
            }
        });
    }

    clickShareBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (PlayerManager.getInstance().share_game == 1) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "今日已分享" });
            return;
        }
        if (this.btnAwait > 0) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "操作过于频繁，请稍后再试！" });
            return;
        }
        this.btnAwait = timeAwait;
        this.emitUI(UIControllerName.UIController_uiShareTip);
    }

    async clickScoreBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIScore);
        if (!view) return;
        view.addComponent(UIScoreUICtrl)
    }

    async clickBackBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIBack);
        if (!view) return;
        view.addComponent(UIBackUICtrl)
    }

    _onRankSuccess(res: unknown) {
        const responseData: { own: Titem; all: Titem[]; } = res as { own: Titem; all: Titem[]; }
        LoadRemoteManager.getInstance().loadImage(util.processUrl(responseData["own"]["avatar"]));
        for (const v of responseData["all"]) {
            LoadRemoteManager.getInstance().loadImage(util.processUrl(v["avatar"]));
        }
    }

    _onRankFailed(err: unknown) {
        console.error("RankFailed", err);
    }

    update(dt: number) {
        if (this.btnAwait > 0) {
            this.btnAwait -= dt;
        }
        this.updateTime += dt;
        if (this.updateTime >= 60) {
            this.updateTime = 0;
            const timeLabel = this.getChildByUrl("top/backBtn/num").getComponent(cc.Label);
            timeLabel.string = util.getCurrentTimeString();
        }
    }
}
