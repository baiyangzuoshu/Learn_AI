

import { MD5 } from "../../FrameWork/Lib/MD5";
import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { DiamondSkipAD, GameMagic, GameState, NetRequestCode, PayIDs, SDKState, SoundID, TipText, UIControllerName, UIEventName, UIName } from "../Constant";
import DataManager from "../Manager/DataManager";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import type { ErrorResponse, ItemBuyRequest, ItemBuyResponse } from "../types";

export default class UIRestartUICtrl extends UIComponent {
    private btnAwaitTime = 0;
    private awaitInvertal = 0.3;

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.initUI();
        SoundManager.Instance.PlaySound(SoundID.fail);
        this.AddDelayButtonListener("bg/skipBtn", this.onskipBtnClick, this)
        this.AddDelayButtonListener("bg/useBtn", this.onuseBtnClick, this)
        this.AddDelayButtonListener("bg/useGrayBtn", this.onuseGrayBtnClick, this)
        this.AddDelayButtonListener("bg/useBtn2", this.onuseBtnClick, this)
        this.AddDelayButtonListener("bg/useGrayBtn2", this.onuseGrayBtnClick, this)
        this.AddButtonListener("bg/mainBtn", this.onmainBtnClick, this)

        this.AddButtonListener("refreshBtn", this.onRefreshBtnClick, this)

        this.AddDelayButtonListener("bg2/useBtn", this.onuse2BtnClick, this);
        this.AddDelayButtonListener("bg2/skipBtn", this.onskip2BtnClick, this);
        this.AddButtonListener("bg2/closeBtn", this.onskip2BtnClick, this);

        this.addUIEventListener(UIEventName.UIRestart_refreshUI, this.refreshUI, this);

        SDKAdapter.getInstance().HLDDZ_getPlayerProfile((data: number) => {
            util.Log("H_p", data);
        });
        //
        SDKAdapter.getInstance().HLDDZ_queryViewableAdCount((data: number) => {
            GameManager.getInstance().canAd = data;
            util.Log("HLDDZ_queryViewableAdCount data=", data);
        });

        this.refreshUI();
    }

    protected start(): void {
        GameManager.getInstance().onlyRefresh = true;
        GameManager.getInstance().gameAction.closeShareAction();
        this.emitUI(UIEventName.UIGame_refreshBagVisible, { isActive: false });
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    isUseSpeical() {
        if (util.isAppPCGame()) {
            return false;
        }

        return true;
    }

    onRefreshBtnClick() {
        GameManager.getInstance().state = GameState.Start;
        this.emitUI(UIEventName.UIGame_onRefreshClick);
        UIManager.Instance.DestroyUIView(UIName.UIRestart);
    }

    refreshUI() {
        this.getChildByUrl("bg2/tip2/num").getComponent(cc.Label).string = PlayerManager.getInstance().HLDDZ_user.diamondCount + "";

        let can = true;
        if (PlayerManager.getInstance().canBuyDiamond == 0) {
            can = false;
        }

        if (PlayerManager.getInstance().magic[GameMagic.Refresh] > 0) {
            this.getChildByUrl("bg/skipBtn").active = false
            this.getChildByUrl("bg/useBtn").active = false
            this.getChildByUrl("bg/refreshBtn").active = true
        }
        else if (can) {
            if (GameManager.getInstance().isCanAD() == 0 || !this.isUseSpeical()) {
                this.getChildByUrl("bg/useGrayBtn").active = true
                this.getChildByUrl("bg/skipBtn").active = true
            }
            else {
                this.getChildByUrl("bg/useBtn").active = true
                this.getChildByUrl("bg/skipBtn").active = true
            }
        }
        else {
            if (GameManager.getInstance().isCanAD() == 0) {
                this.getChildByUrl("bg/useGrayBtn2").active = true
                this.getChildByUrl("bg/useBtn").active = false
                this.getChildByUrl("bg/skipBtn").active = false
            }
            else {
                this.getChildByUrl("bg/useBtn2").active = true
                this.getChildByUrl("bg/useBtn").active = false
                this.getChildByUrl("bg/skipBtn").active = false
            }
        }
    }

    onskip2BtnClick() {
        if (this.btnAwaitTime > 0) return;
        this.btnAwaitTime = this.awaitInvertal;
        SoundManager.Instance.PlaySound(SoundID.point);

        this.getChildByUrl("bg").active = true;
        this.getChildByUrl("bg2").active = false;

        let can = true;
        if (PlayerManager.getInstance().canBuyDiamond == 0) {
            can = false;
        }
        this.getChildByUrl("bg/useBtn2").active = !can;
    }

    onuse2BtnClick() {
        if (this.btnAwaitTime > 0) return;
        this.btnAwaitTime = this.awaitInvertal;
        SoundManager.Instance.PlaySound(SoundID.point);

        if (PlayerManager.getInstance().HLDDZ_user.diamondCount < DiamondSkipAD) {
            if (PlayerManager.getInstance().canBuyDiamond == 0) {
                this.emitUI(UIControllerName.UIController_UIDiamondTip)
                return;//不可充值
            }
            this.emitUI(UIControllerName.UIController_UIDiamondBuy);
            GameManager.getInstance().state = GameState.Start;
            UIManager.Instance.DestroyUIView(UIName.UIRestart);
            GameManager.getInstance().checkTime = -99999;
            return;
        }

        this.getChildByUrl("bg").active = true;
        this.getChildByUrl("bg2").active = false;
        this.btnAwaitTime = 20.0;
        GameManager.getInstance().sdkState = SDKState.Diamond;
        const billNo = PlayerManager.getInstance().HLDDZ_user.userid + Date.now();
        SDKAdapter.getInstance().HLDDZ_payDiamond(PayIDs["RefreshBag"], billNo, (data: number) => {
            GameManager.getInstance().sdkState = SDKState.None;
            util.Log(data);
            if (1 == data) {
                GameManager.getInstance().report.diamond += DiamondSkipAD;
                GameManager.getInstance().diamondCount = PlayerManager.getInstance().HLDDZ_user.diamondCount;

                this.skillUse();
            } else if (data < 0) {
                if (-1 == data || -100016 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appDiamond1 });
                }
                else {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appDiamond2 });
                }
            }
            this.btnAwaitTime = 2.0;
        });
    }

    initUI() {
        const percentNode = this.getChildByUrl("bg/info2/percent");
        const percentLabel = percentNode.getComponent(cc.Label);
        let num = GameManager.getInstance().curBlockCount * 100 / GameManager.getInstance().maxBlockCount;
        num = Math.min(100, num);
        percentLabel.string = Math.floor(num) + "%";
    }

    onskipBtnClick() {
        if (this.btnAwaitTime > 0) return;
        this.btnAwaitTime = this.awaitInvertal;

        SoundManager.Instance.PlaySound(SoundID.point);
        this.getChildByUrl("bg2/tip2/num").getComponent(cc.Label).string = PlayerManager.getInstance().HLDDZ_user.diamondCount + "";
        this.getChildByUrl("bg").active = false;
        this.getChildByUrl("bg2").active = true;

        this.getChildByUrl("bg/useBtn2").active = false
    }

    _onPlayFailed(err: unknown) {
        util.Log(err);
    }

    onuseBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);

        if (this.btnAwaitTime > 0) return;
        this.btnAwaitTime = this.awaitInvertal;
        if (GameManager.getInstance().gameADCount >= GameManager.getInstance().gameADMax) {
            this.emitUI(UIControllerName.UIController_uiCommon, { type: 0 });
            return;
        }

        GameManager.getInstance().sdkState = SDKState.Ad;
        GameManager.getInstance().report.adOpen++;
        this.btnAwaitTime = 20;
        SDKAdapter.getInstance().HLDDZ_showRewardedVideoAd((data: number) => {
            SoundManager.Instance.ResumeMusic();
            GameManager.getInstance().sdkState = SDKState.None;
            if (1 == data) {
                GameManager.getInstance().reportNew.trueAdCount++;
                GameManager.getInstance().report.adCount++;
                GameManager.getInstance().gameADCount++;
                GameManager.getInstance().reportADCount++;
                this.skillUse();

                DataManager.getInstance().queryViewableAdCount();
            } else if (data < 0) {
                GameManager.getInstance().state = GameState.Start;
                if (-1 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd1 });
                }
                else if (-2 == data || -3 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd2 });
                }
            }

            this.btnAwaitTime = 2.0;
        });
    }

    skillUse() {
        //
        GameManager.getInstance().state = GameState.Start;
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_onBagClick, GameMagic.Refresh);
        UIManager.Instance.DestroyUIView(UIName.UIRestart);
    }

    doLive() {
        const val = GameManager.getInstance().gameMD5Time + "yuelibuy2025";
        const token = MD5.getMD5(val);

        HttpManager.Instance.request<ItemBuyResponse, ItemBuyRequest>({ msgId: NetRequestCode.ItemBuy, param: { "id": GameMagic.Refresh, "token": token } },
            this._onItemBuySuccess.bind(this),
            this._onItemBuyFailed.bind(this));
    }

    _onItemBuySuccess(data: ItemBuyResponse) {
        util.Log(data);
        const id = data["items"][0]["id"];
        const num = data["items"][0]["num"];

        PlayerManager.getInstance().magic[id] = num;
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        //
        GameManager.getInstance().state = GameState.Start;
        this.emitUI(UIEventName.UIGame_netRefresh);
        this.emitUI(UIEventName.UIGame_onRefreshClick);
        UIManager.Instance.DestroyUIView(UIName.UIRestart);
    }

    _onItemBuyFailed(data: ErrorResponse) {
        console.error("ItemBuyFailed", data);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "网络异常，请检查网络！" });
    }

    onmainBtnClick() {
        if (this.btnAwaitTime > 0) return;
        GameManager.getInstance().checkTime = -99999
        this.btnAwaitTime = this.awaitInvertal;
        SoundManager.Instance.PlaySound(SoundID.point);
        GameManager.getInstance().state = GameState.Start;

        UIManager.Instance.DestroyUIView(UIName.UIRestart);
    }

    onuseGrayBtnClick() {
        util.Log("onuseGrayBtnClick");
        this.emitUI(UIControllerName.UIController_uiCommon, { type: 0 });
    }

    update(dt: number) {
        super.update(dt);
        this.btnAwaitTime -= dt;
    }
}
