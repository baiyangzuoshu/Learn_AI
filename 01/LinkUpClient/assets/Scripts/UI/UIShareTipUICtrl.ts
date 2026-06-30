import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { NetRequestCode, SDKState, ShareType, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import { type ErrorResponse, type ShareRequest, type ShareResponse } from "../types";

export default class UIShareTipUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
    }

    start() {
        this.AddButtonListener("bg/closeBtn", this.onCloseClick, this);
        this.AddButtonListener("bg/shareBtn", this.onShareClick, this);
    }

    onShareClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        GameManager.getInstance().sdkState = SDKState.Share;
        GameManager.getInstance().report.shareOpen++;
        const realShare = false;//SDKAdapter.getInstance().isMiniGame();
        SDKAdapter.getInstance().HLDDZ_shareMessage(ShareType.First, { realShare: realShare, rankName: "" }, (data: number) => {
            const shareId = util.clamp(Math.random() * 3, 2, 3);
            GameManager.getInstance().sdkState = SDKState.None;
            SoundManager.Instance.ResumeMusic();
            if (1 == data) {
                HttpManager.Instance.request<ShareResponse, ShareRequest>({ msgId: NetRequestCode.Share, param: { "cate": shareId } }, this._onShareSuccess.bind(this),
                    this._onShareFailed.bind(this));
            }
            else if (0 == data) {
                this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "请分享" });
            }
        });
    }

    _onShareSuccess(response: unknown) {
        const res: { item: number; share_game: number; } = response as { item: number; share_game: number; }
        util.Log(res);
        PlayerManager.getInstance().share_game = res["share_game"];
        PlayerManager.getInstance().item = res["item"];

        this.scheduleOnce(() => {
            this.emitUI(UIControllerName.UIController_UIRewardInfo);
            this.emitUI(UIEventName.UIMain_refreshShareBtn);
            this.node.active = false;
            UIManager.Instance.DestroyUIView(UIName.UIShareTip);
        }, 0.5);
    }

    _onShareFailed(response: ErrorResponse) {
        console.error("_onShareFailed", response);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "分享失败，请重新分享" });
    }

    onCloseClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIShareTip);
    }
}
