
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

export default class UIBagTipUICtrl extends UIComponent {
    private type = 0;
    private awaitTime = 0;
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }

        this.AddButtonListener("bg/closeBtn", this.onBtnClick, this);
        this.AddDelayButtonListener("bg/useBtn", this.onuseBtnClick, this);
        this.AddDelayButtonListener("bg/useGrayBtn", this.onuseGrayBtnClick, this);
        this.AddDelayButtonListener("bg/useBtn2", this.onuseBtnClick, this);
        this.AddDelayButtonListener("bg/useGrayBtn2", this.onuseGrayBtnClick, this);
        this.AddDelayButtonListener("bg/skipBtn", this.onskipBtnClick, this);

        this.AddDelayButtonListener("bg2/useBtn", this.onuse2BtnClick, this);
        this.AddDelayButtonListener("bg2/skipBtn", this.onskip2BtnClick, this);
        this.AddDelayButtonListener("bg2/closeBtn", this.onskip2BtnClick, this);


        this.addUIEventListener(UIEventName.UIBagTip_refreshUI, this.refreshUI, this);

        SDKAdapter.getInstance().HLDDZ_getPlayerProfile((data: number) => {
            util.Log("H_p", data);
            const payDiamond = PlayerManager.getInstance().HLDDZ_user.diamondCount - GameManager.getInstance().diamondCount;
            if (payDiamond > 0) {
                //this.emitUI(UIControllerName.UIController_UIPaySuccess, { type: 2 });
            }

            this.refreshUI();
        });

        SDKAdapter.getInstance().HLDDZ_queryViewableAdCount((data: number) => {
            GameManager.getInstance().canAd = data;
            util.Log("HLDDZ_queryViewableAdCount data=", data);
        });

        this.refreshUI();
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

    refreshUI() {
        this.getChildByUrl("bg2/tip2/num").getComponent(cc.Label).string = PlayerManager.getInstance().HLDDZ_user.diamondCount + "";

        let can = true;
        if (PlayerManager.getInstance().canBuyDiamond == 0) {
            can = false;
            //test
            if ("27WSA6Y5FHH2QXY6DEY6THCQQE" == PlayerManager.getInstance().HLDDZ_user.userid) {
                can = true;
            }
        }

        if (can) {
            if (GameManager.getInstance().isCanAD() == 0 || !this.isUseSpeical()) {
                this.getChildByUrl("bg/useGrayBtn").active = true
                this.getChildByUrl("bg/skipBtn").active = true
                this.getChildByUrl("bg/useBtn").active = false
            }
            else {
                this.getChildByUrl("bg/useBtn").active = true
                this.getChildByUrl("bg/skipBtn").active = true
                this.getChildByUrl("bg/useGrayBtn").active = false
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

    initData(t: number) {
        this.type = t;

        this.getChildByUrl("bg/1").active = t == 1;
        this.getChildByUrl("bg/2").active = t == 2;
        this.getChildByUrl("bg/3").active = t == 3;

        this.getChildByUrl("bg2/get/1").active = t == 1;
        this.getChildByUrl("bg2/get/2").active = t == 2;
        this.getChildByUrl("bg2/get/3").active = t == 3;

        this.getChildByUrl("bg2/tip2/num").getComponent(cc.Label).string = PlayerManager.getInstance().HLDDZ_user.diamondCount + "";
    }

    onskip2BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);

        this.getChildByUrl("bg").active = true;
        this.getChildByUrl("bg2").active = false;
        let can = true;
        if (PlayerManager.getInstance().canBuyDiamond == 0) {
            can = false;
            //test
            if ("27WSA6Y5FHH2QXY6DEY6THCQQE" == PlayerManager.getInstance().HLDDZ_user.userid) {
                can = true;
            }
        }
        this.getChildByUrl("bg/useBtn2").active = !can

    }
    onuse2BtnClick(btn: cc.Button) {
        SoundManager.Instance.PlaySound(SoundID.point);
        console.log("onuse2BtnClick", GameManager.getInstance().state);
        if (this.awaitTime > 0 || GameManager.getInstance().state != GameState.Start) {
            return;
        }

        if (PlayerManager.getInstance().HLDDZ_user.diamondCount < DiamondSkipAD) {
            if (PlayerManager.getInstance().canBuyDiamond == 0) {
                this.emitUI(UIControllerName.UIController_UIDiamondTip)
                return;//不可充值
            }
            this.emitUI(UIControllerName.UIController_UIDiamondBuy);
            this.getChildByUrl("bg").active = true;
            this.getChildByUrl("bg2").active = false;

            UIManager.Instance.DestroyUIView(UIName.UIBagTip);
            return;
        }

        this.awaitTime = 20.0;
        this.getChildByUrl("bg").active = true;
        this.getChildByUrl("bg2").active = false;
        btn.enabled = false;
        GameManager.getInstance().sdkState = SDKState.Diamond;
        const billNo = PlayerManager.getInstance().HLDDZ_user.userid + Date.now();
        let id=PayIDs["Bag"];
        if(this.type==GameMagic.Refresh){
            id=PayIDs["RefreshBag"];
        }
        else if(this.type==GameMagic.Clean){
            id=PayIDs["CleanBag"];
        }
        else if(this.type==GameMagic.Match){
            id=PayIDs["MatchBag"];
        }
        
        SDKAdapter.getInstance().HLDDZ_payDiamond(id, billNo, (data: number) => {
            GameManager.getInstance().viewableAdCb();
            btn.enabled = true;
            util.Log(data, this.type);
            if (1 == data) {
                GameManager.getInstance().report.diamond += DiamondSkipAD;
                GameManager.getInstance().diamondCount = PlayerManager.getInstance().HLDDZ_user.diamondCount;
                this.skillUse();

                this.awaitTime = 2.0;
            }
            else if (data < 0) {
                if (-1 == data || -100016 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appDiamond1 });
                }
                else {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appDiamond2 });
                }
            }
            this.awaitTime = 2.0;
        });
    }

    onBtnClick() {
        GameManager.getInstance().state = GameState.Start;

        SoundManager.Instance.PlaySound(SoundID.point);

        UIManager.Instance.DestroyUIView(UIName.UIBagTip);
    }

    onuseGrayBtnClick() {
        this.emitUI(UIControllerName.UIController_uiCommon, { type: 0 });
    }

    onuseBtnClick() {
        if (GameManager.getInstance().gameADCount >= GameManager.getInstance().gameADMax) {
            this.emitUI(UIControllerName.UIController_uiCommon, { type: 0 });

            return;
        }

        if (this.awaitTime > 0 || GameManager.getInstance().state != GameState.Start) {
            return;
        }

        SoundManager.Instance.PlaySound(SoundID.point);

        switch (this.type) {
            case GameMagic.Refresh:
                this.handleRefresh();
                break;
            case GameMagic.Clean: {
                this.handleClean();
                break;
            }
            case GameMagic.Match: {
                this.handleMatch();
                break;
            }
            default:
                break;
        }
    }

    handleMatch() {
        GameManager.getInstance().sdkState = SDKState.Ad;
        GameManager.getInstance().report.adOpen++;
        SDKAdapter.getInstance().HLDDZ_showRewardedVideoAd((data: number) => {
            util.Log(data);
            SoundManager.Instance.ResumeMusic();
            if (1 == data) {
                GameManager.getInstance().reportNew.trueAdCount++;
                GameManager.getInstance().report.adCount++;
                GameManager.getInstance().reportADCount++;
                GameManager.getInstance().gameADCount++;
                this.skillUse();

                DataManager.getInstance().queryViewableAdCount();
            }
            else if (data < 0) {
                if (-1 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd1 });
                }
                else if (-2 == data || -3 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd2 });
                }
            }

            GameManager.getInstance().viewableAdCb();
        });
    }

    handleClean() {
        GameManager.getInstance().sdkState = SDKState.Ad;
        GameManager.getInstance().report.adOpen++;
        SDKAdapter.getInstance().HLDDZ_showRewardedVideoAd((data: number) => {
            SoundManager.Instance.ResumeMusic();
            if (1 == data) {
                GameManager.getInstance().reportNew.trueAdCount++;
                GameManager.getInstance().report.adCount++;
                GameManager.getInstance().reportADCount++;
                GameManager.getInstance().gameADCount++;
                this.skillUse();

                DataManager.getInstance().queryViewableAdCount();
            } else if (data < 0) {
                if (-1 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd1 });
                }
                else if (-2 == data || -3 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd2 });
                }
            }

            GameManager.getInstance().viewableAdCb();
        });
    }

    handleRefresh() {
        GameManager.getInstance().sdkState = SDKState.Ad;
        GameManager.getInstance().report.adOpen++;
        SDKAdapter.getInstance().HLDDZ_showRewardedVideoAd((data: number) => {
            SoundManager.Instance.ResumeMusic();
            if (1 == data) {
                GameManager.getInstance().reportNew.trueAdCount++;
                GameManager.getInstance().report.adCount++;
                GameManager.getInstance().reportADCount++;
                GameManager.getInstance().gameADCount++;

                this.skillUse();

                DataManager.getInstance().queryViewableAdCount();
            } else if (data < 0) {
                if (-1 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd1 });
                }
                else if (-2 == data || -3 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.appAd2 });
                }
            }

            GameManager.getInstance().viewableAdCb();
        });
    }

    skillUse() {
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_onBagClick, this.type);

        UIManager.Instance.DestroyUIView(UIName.UIBagTip);
    }

    netBuy(id: number) {
        const val = GameManager.getInstance().gameMD5Time + "yuelibuy2025";
        const token = MD5.getMD5(val);

        HttpManager.Instance.request<ItemBuyResponse, ItemBuyRequest>({ msgId: NetRequestCode.ItemBuy, param: { "id": id, "token": token } },
            this._onItemBuySuccess.bind(this),
            this._onItemBuyFailed.bind(this));
    }

    _onItemBuySuccess(data: ItemBuyResponse) {
        util.Log(data);
        const id = data["items"][0]["id"];
        const num = data["items"][0]["num"];


        PlayerManager.getInstance().magic[id] = num;

        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_onBagClick, this.type);

        UIManager.Instance.DestroyUIView(UIName.UIBagTip);
    }

    _onItemBuyFailed(data: ErrorResponse) {
        console.error("ItemBuyFailed", data);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "网络异常，请检查网络！" });
    }

    onskipBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        SDKAdapter.getInstance().HLDDZ_getPlayerProfile((data: number) => {
            util.Log("H_p", data);
            const payDiamond = PlayerManager.getInstance().HLDDZ_user.diamondCount - GameManager.getInstance().diamondCount;
            if (payDiamond > 0) {
                //this.emitUI(UIControllerName.UIController_UIPaySuccess, { type: 2 });
            }

            this.refreshUI();
        });
        this.getChildByUrl("bg").active = false;
        this.getChildByUrl("bg2").active = true;

        this.getChildByUrl("bg/useBtn2").active = false;
    }

    update(dt: number) {
        super.update(dt);

        this.awaitTime -= dt;
    }
}
