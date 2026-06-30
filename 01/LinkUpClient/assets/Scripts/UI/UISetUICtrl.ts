
import { MD5 } from "../../FrameWork/Lib/MD5";
import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { GameState, GameType, LLKVersion, ModelName, NetRequestCode, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import ScoreData from "../DataModel/ScoreData";
import DataManager from "../Manager/DataManager";
import GameControl from "../Manager/GameControl";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import type { ErrorResponse, WinRequest, WinResponse } from "../types";
import UIMainUICtrl from "./UIMainUICtrl";

export default class UISetUICtrl extends UIComponent {
    private soundState = false;
    private musicState = false;
    private shakeState = false;

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        cc.audioEngine.setMusicVolume(1);
        cc.audioEngine.setEffectsVolume(1);
        this.getChildByUrl("bg").active = true;
        this.getChildByUrl("bg2").active = false;
        this.getChildByUrl("version").getComponent(cc.Label).string = LLKVersion;

        this.musicState = SoundManager.Instance.GetMusicMute();
        this.soundState = SoundManager.Instance.GetSoundMute();
        this.shakeState = SoundManager.Instance.GetShakeMute();

        if (!SDKAdapter.getInstance().isMini() || SDKAdapter.getInstance().isMiniPCGame()) {
            const musicNode = this.getChildByUrl("bg/music");
            const effectNode = this.getChildByUrl("bg/effect");
            const shakeNode = this.getChildByUrl("bg/shake");
            musicNode.setPosition(cc.v3(-120, 38));
            effectNode.setPosition(cc.v3(-120, -98));

            shakeNode.active = false;
        } else {
            // minigame
            const musicNode = this.getChildByUrl("bg/music");
            const effectNode = this.getChildByUrl("bg/effect");
            const shakeNode = this.getChildByUrl("bg/shake");
            musicNode.setPosition(cc.v3(-120, 58));
            effectNode.setPosition(cc.v3(-120, -30));
            shakeNode.setPosition(cc.v3(-120, -128));
        }

        this._refreshStates();
        this._addEventListeners();

        this.AddButtonListener("bg/battleBtn", this._onBtnQuit, this);
        this.AddButtonListener("bg/mainBtn", this.clickMainBtn, this);
        this.AddButtonListener("bg2/mainBtn", this.mainBtn, this);
        this.AddButtonListener("bg2/battleBtn", this._onBtnQuit, this);

        this.addUIEventListener(UIEventName.ScoreExit, this.scoreExit, this);
    }

    scoreExit() {
        if (GameManager.getInstance().gameType == GameType.ScoreChange) {
            SDKAdapter.getInstance().HLDDZ_rankAbort((data) => {
                console.log("中途退出", data);
            });
        }

        this.exit();
    }

    initData(type = 0) {
        this.getChildByUrl("bg/mainBtn").active = type == 1;
        this.getChildByUrl("bg/battleBtn").active = type == 1;
        this.getChildByUrl("version").active = 0 == type;
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    clickMainBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        this.getChildByUrl("bg").active = false;
        this.getChildByUrl("bg2").active = true;

        this.getChildByUrl("bg2/kk").active = GameManager.getInstance().gameType != GameType.Share;
        this.getChildByUrl("bg2/New Label").active = GameManager.getInstance().gameType != GameType.Share;
        this.getChildByUrl("bg2/shareTip").active = GameManager.getInstance().gameType == GameType.Share;

        const percentNode = this.getChildByUrl("bg2/New Label/percent");
        const percentLabel = percentNode.getComponent(cc.Label);
        let num = GameManager.getInstance().curBlockCount * 100 / GameManager.getInstance().maxBlockCount;
        num = Math.min(100, num);
        percentLabel.string = Math.floor(num) + "%";
    }

    mainBtn() {
        this.getChildByUrl("bg2/mainBtn").getComponent(cc.Button).enabled = false;
        this.getChildByUrl("bg2/battleBtn").getComponent(cc.Button).enabled = false;
        const mapID = PlayerManager.getInstance().getMapID();
        //
        GameManager.getInstance().report.mapID = mapID;
        GameManager.getInstance().report.pass = 3;//1结束且过关，2结束未过关，3未结束主动退出
        GameManager.getInstance().report.gkCount = 1;
        GameManager.getInstance().reportNew.pass = 3;
        GameManager.getInstance().report.time = Math.floor(GameManager.getInstance().time);
        GameManager.getInstance().gameResultReport();
        //
        if (GameManager.getInstance().gameType == GameType.Normal) {
            this.netFail();
        }
        else if (GameManager.getInstance().gameType == GameType.Score || GameManager.getInstance().gameType == GameType.ScoreChange) {
            const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
            dataModel.netFail();
        }
        else {
            this.exit();
        }
    }

    netFail() {
        const val = GameManager.getInstance().gameMD5Time + "yueli2025";
        const token = MD5.getMD5(val);

        const params: WinRequest = {
            "win": 0,
            "token": token,
            "ad": GameManager.getInstance().reportADCount
        }

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

    async exit() {
        GameControl.Instance.reset();

        this.getChildByUrl("bg2/mainBtn").getComponent(cc.Button).enabled = false;
        this.getChildByUrl("bg2/battleBtn").getComponent(cc.Button).enabled = false;

        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIMain);
        if (!view) return;
        view.addComponent(UIMainUICtrl);

        const uiGame = UIManager.Instance.GetUIView(UIName.UIGame);
        if (uiGame) {
            uiGame.zIndex = 9998;
        }
        const uiSet = UIManager.Instance.GetUIView(UIName.UISet);
        if (uiSet) {
            uiSet.zIndex = 9999;
        }

        this.scheduleOnce(() => {
            UIManager.Instance.DestroyUIView(UIName.UISet);
            UIManager.Instance.DestroyUIView(UIName.UIGame);
        }, 0.5);
    }

    _onWinSuccess(res: WinResponse) {
        util.Log(res);
        //
        this.exit();
    }

    _onWinFailed(res: ErrorResponse) {
        console.error("WinFailed", res);
        this.getChildByUrl("bg2/mainBtn").getComponent(cc.Button).enabled = true;
        this.getChildByUrl("bg2/battleBtn").getComponent(cc.Button).enabled = true;
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "网络异常，请检查网络！" });
    }

    private _refreshStates(): void {
        this._refreshMusicState();
        this._refreshSoundState();
        this._refreshShakeState();
    }

    private _refreshMusicState(): void {
        this.getChildByUrl("bg/music/on").active = this.musicState;
        this.getChildByUrl("bg/music/off").active = !this.musicState;
    }

    private _refreshSoundState(): void {
        this.getChildByUrl("bg/effect/on").active = this.soundState;
        this.getChildByUrl("bg/effect/off").active = !this.soundState;
    }

    private _refreshShakeState(): void {
        this.getChildByUrl("bg/shake/on").active = this.shakeState;
        this.getChildByUrl("bg/shake/off").active = !this.shakeState;
    }

    private _addEventListeners(): void {
        this.AddButtonListener("bg/closeBtn", this._onBtnQuit, this);
        this.AddButtonListener("bg/music/event", this._onToggleMusic, this);
        this.AddButtonListener("bg/effect/event", this._onToggleSound, this);
        this.AddButtonListener("bg/shake/event", this._onToggleShake, this);
    }

    private _onBtnQuit(): void {
        GameManager.getInstance().state = GameState.Start;
        SoundManager.Instance.PlaySound(SoundID.point);

        UIManager.Instance.DestroyUIView(UIName.UISet);
    }

    private _onToggleMusic(): void {
        SoundManager.Instance.PlaySound(SoundID.point);

        this.musicState = !this.musicState;

        this._refreshMusicState();

        SoundManager.Instance.SetMusicMute(this.musicState);
    }

    private _onToggleSound(): void {
        SoundManager.Instance.PlaySound(SoundID.point);

        this.soundState = !this.soundState;

        this._refreshSoundState();

        SoundManager.Instance.SetSoundMute(this.soundState);
    }

    private _onToggleShake(): void {
        SoundManager.Instance.PlaySound(SoundID.point);

        this.shakeState = !this.shakeState;

        this._refreshShakeState();

        SoundManager.Instance.SetShakeMute(this.shakeState);
    }
}
