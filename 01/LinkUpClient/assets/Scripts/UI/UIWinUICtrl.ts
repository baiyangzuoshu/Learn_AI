

import { MD5 } from "../../FrameWork/Lib/MD5";
import HttpManager from "../../FrameWork/manager/HttpManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { BundleName, GameType, ModelName, MusicID, NetRequestCode, SDKState, SeverIPs, ShareType, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import ScoreData from "../DataModel/ScoreData";
import DataManager from "../Manager/DataManager";
import GameControl from "../Manager/GameControl";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import type { ErrorResponse, MapPlayResultResponse, MapPlayRewardRequest, MapPlayRewardResponse, PlayResponse, PlayTestRequest, WinRequest, WinResponse } from "../types";
import UIMainUICtrl from "./UIMainUICtrl";
export default class UIWinUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        GameManager.getInstance().isWin = true;
        GameManager.getInstance().isPlayUp = true;
        SoundManager.Instance.PlaySound(SoundID.win);
        SoundManager.Instance.StopMainMusic();
        this.AddButtonListener("bg/mainBtn", this._onClickMainBtn, this);
        this.AddButtonListener("bg/battleBtn", this._onClickBattleBtn, this);
        this.AddButtonListener("bg/shareBtn", this._onClickShareBtn, this);
        this.AddButtonListener("bg/passBtn", this._onClickMainBtn, this);
        this.AddButtonListener("bg/lingquBtn", this._onClickSkipBtn, this);

        this.AddButtonListener("error/bg3/useBtn", this.netWin, this);

        this.addUIEventListener(UIEventName.ScoreWin, this.scoreWin, this);
        this.addUIEventListener(UIEventName.ScoreFail, this.scoreFail, this);

        this.getChildByUrl("error").active = false;
        this.getChildByUrl("bg").active = false;
        this.getChildByUrl("bg/lingquBtn").active = true;
        this.getChildByUrl("bg/shareBtn").active=!SDKAdapter.getInstance().isAppHarmonyGame();
        this.node.active = 1 < PlayerManager.getInstance().getMapID();

        const guang = this.getChildByUrl("bg/11");
        cc.tween(guang)
            .repeatForever(cc.tween().by(1, { angle: -180 }).by(1, { angle: -180 }))
            .start();

        for (let i = 1; i < 5; i++) {
            const star = this.getChildByUrl("bg/star/" + i);
            const random = Math.random();
            const scaleRange1 = util.clamp(random + 1, 1, 1.5);
            const scaleRange2 = util.clamp(random, 0.2, 0.7);
            cc.tween(star)
                .repeatForever(cc.tween().to(1, { scale: scaleRange1 }).to(1, { scale: scaleRange2 }))
                .start();
        }

        if (PlayerManager.getInstance().getMapID() == 2 || PlayerManager.getInstance().getMapID() == 10) {
            this.loadFX_jingxihaoli();
        }

        if (GameType.Score == GameManager.getInstance().gameType || GameType.ScoreChange == GameManager.getInstance().gameType) {
            const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
            dataModel.netWin();

            this.getChildByUrl("bg/battleBtn/New Node").getComponent(cc.Label).string = "继续游戏"
        }
        else {
            this.netWin();
        }
    }

    scoreWin() {
        this.getChildByUrl("error").active = false;
        this.getChildByUrl("bg").active = true;

        this.getChildByUrl("bg/battleBtn").active = PlayerManager.getInstance().pass_stage < GameManager.getInstance().maxMapID;
        this.getChildByUrl("bg/mainBtn").active = PlayerManager.getInstance().pass_stage < GameManager.getInstance().maxMapID;
        this.getChildByUrl("bg/passBtn").active = PlayerManager.getInstance().pass_stage >= GameManager.getInstance().maxMapID;
    }

    scoreFail() {
        this.getChildByUrl("error").active = true;
        this.getChildByUrl("bg").active = false;

        this.node.active = true;
    }

    async loadFX_jingxihaoli() {
        const lingquBtn = this.getChildByUrl("bg/lingquBtn");
        lingquBtn.removeAllChildren();
        const FX_jingxihaoliPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Art/prefab/FX_jingxihaoli", cc.Prefab) as cc.Prefab;
        const FX_jingxihaoliNode = cc.instantiate(FX_jingxihaoliPrefab);
        FX_jingxihaoliNode.parent = lingquBtn;
        FX_jingxihaoliNode.setPosition(cc.v2(0, 0));
        FX_jingxihaoliNode.getComponent(cc.Animation).play("win");
    }

    private _onClickSkipBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        SDKAdapter.getInstance().HLDDZ_skipGame();
    }

    async _onClickShareBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        /*
        if (GameManager.getInstance().gameType == GameType.Score || GameManager.getInstance().gameType == GameType.ScoreChange) {
            const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
            const score = GameManager.getInstance().stage_time;
            const subScoreKey = GameManager.getInstance().planMap["id"];
            dataModel.share(score, subScoreKey);
            return;
        }
        if (GameManager.getInstance().gameType == GameType.Normal && PlayerManager.getInstance().getMapID() < 1000 && !SDKAdapter.getInstance().isAppGame()) {
            const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
            const score = GameManager.getInstance().stage_time;
            const subScoreKey = GameManager.getInstance().planMap["id"];
            dataModel.share(score, subScoreKey);
            return;
        }*/

        GameManager.getInstance().sdkState = SDKState.Share;
        GameManager.getInstance().report.shareOpen++;
        SDKAdapter.getInstance().HLDDZ_shareMessage(ShareType.Win, { realShare: false, rankName: "" }, (data: number) => {
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
    private async _onClickMainBtn() {
        GameControl.Instance.reset();

        this.getChildByUrl("bg/mainBtn").getComponent(cc.Button).enabled = false;
        this.getChildByUrl("bg/battleBtn").getComponent(cc.Button).enabled = false;

        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIMain);
        if (!view) return;
        view.addComponent(UIMainUICtrl);

        const uiGame = UIManager.Instance.GetUIView(UIName.UIGame);
        if (uiGame) {
            uiGame.zIndex = 9998;
        }
        const uiWin = UIManager.Instance.GetUIView(UIName.UIWin);
        if (uiWin) {
            uiWin.zIndex = 9999;
        }

        this.scheduleOnce(() => {
            UIManager.Instance.DestroyUIView(UIName.UIWin);
            UIManager.Instance.DestroyUIView(UIName.UIGame);
        }, 0.5);
    }

    private _onClickBattleBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        SoundManager.Instance.PlayMusic(MusicID.main);
        const params: PlayTestRequest = {
            "id": PlayerManager.getInstance().getMapID(),
        }

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
        GameManager.getInstance().gameType = GameType.Normal;
        GameManager.getInstance().setDataMap(response);
        PlayerManager.getInstance().friends = response["friends"];
        this.emitUI(UIEventName.UIGame_nextMap);
        UIManager.Instance.DestroyUIView(UIName.UIWin);
    }

    _onPlayFailed(err: unknown) {
        console.error("PlayFailed", err);
        this.node.active = true;
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    _onMapPlayResultSuccess(res: MapPlayResultResponse) {
        util.Log("MapPlayResultSuccess", res);
    }

    _onMapPlayResultFailed(res: ErrorResponse) {
        console.error("MapPlayResultFailed", res);
        this.node.active = true;
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "网络异常，请检查网络！" });
    }

    netWin() {
        const val = GameManager.getInstance().gameMD5Time + "yueli2025";
        const token = MD5.getMD5(val);

        const params: WinRequest = {
            "win": 1,
            "token": token,
            "ad": GameManager.getInstance().reportADCount
        }
        //
        let msgId = NetRequestCode.Win;
        if (PlayerManager.getInstance().vipLevel == 1) {
            msgId = NetRequestCode.Resultvip;
        }
        else if (PlayerManager.getInstance().vipLevel == 2) {
            msgId = NetRequestCode.ResultC;
        }
        else {
            msgId = NetRequestCode.Win;
        }
        HttpManager.Instance.request<WinResponse, WinRequest>({
            msgId: msgId,
            param: params
        }, this._onWinSuccess.bind(this), this._onWinFailed.bind(this));
    }

    private _onWinSuccess(res: WinResponse) {
        this.getChildByUrl("error").active = false;
        this.getChildByUrl("bg").active = true;
        PlayerManager.getInstance().setMapID(res["next_id"]);
        PlayerManager.getInstance().pass_stage = res["stage_id"];
        GameManager.getInstance().stage_time = res["stage_time"];
        PlayerManager.getInstance().rank_reward = res["rank_reward"] || 0;
        if (PlayerManager.getInstance().rank_reward > 0) {
            HttpManager.Instance.request<MapPlayRewardResponse, MapPlayRewardRequest>(
                { msgId: NetRequestCode.RewardScore, param: { "id": 0 } },
                this._onRewardScoreSuccess.bind(this),
                this._onRewardScoreFailed.bind(this)
            );
        }

        this.getChildByUrl("bg/battleBtn").active = PlayerManager.getInstance().pass_stage < GameManager.getInstance().maxMapID;
        this.getChildByUrl("bg/mainBtn").active = PlayerManager.getInstance().pass_stage < GameManager.getInstance().maxMapID;
        this.getChildByUrl("bg/passBtn").active = PlayerManager.getInstance().pass_stage >= GameManager.getInstance().maxMapID;

        if (2 == PlayerManager.getInstance().getMapID()) {
            this._onClickBattleBtn();
        }
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
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIControllerName.UIController_UIRewardCommon, { type: 1, arr });
    }

    _onRewardScoreFailed(res: ErrorResponse) {
        util.Log("_onRewardScoreFailed", res);
    }

    private _onWinFailed(err: ErrorResponse) {
        console.error("_onWinFailed", err);
        this.getChildByUrl("error").active = true;
        this.getChildByUrl("bg").active = false;

        this.node.active = true;
    }

    // update (dt) {}
}
