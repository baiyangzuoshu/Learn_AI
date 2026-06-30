

import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { GameType, NetRequestCode, SeverIPs, SoundID, UIControllerName, UIName } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import { type ErrorResponse, type PlayResponse, type PlayTestRequest, type RankStageRequest, type RankStageResponse } from "../types";
export default class GKItem extends UIComponent {
    private id = 0;

    setData(id: number) {
        this.id = id;
        super.onLoad();
        if (this.getChildByUrl("complete/10")) {
            this.AddButtonListener("complete/10", this.onClickComplete, this);
        }
        if (this.getChildByUrl("select/event")) {
            this.AddButtonListener("select/event", this.onClickSelect, this);
        }
    }

    onClickSelect() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (GameManager.getInstance().maxMapID <= PlayerManager.getInstance().pass_stage) {
            this.emitUI(UIControllerName.UIController_uiCommon, { type: 1, texts: ["全部通关", "敬请期待后续关卡更新"] });
            return;
        }
        this.netPlay();
    }

    netPlay() {
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
        GameManager.getInstance().setDataMap(response);
        UIManager.Instance.DestroyUIView(UIName.UIMain);
        this.emitUI(UIControllerName.UIController_uiGame, { gameType: GameType.Normal });
    }

    _onPlayFailed(response: ErrorResponse) {
        console.error("PlayFailed", response);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    onClickComplete() {
        SoundManager.Instance.PlaySound(SoundID.point);
        HttpManager.Instance.request<RankStageResponse, RankStageRequest>(
            { msgId: NetRequestCode.RankStage, param: { "id": this.id } },
            this._onRankStageSuccess.bind(this),
            this._onRankStageFailed.bind(this)
        );
    }

    _onRankStageSuccess(res: RankStageResponse) {
        console.log("UIMainUICtrl _onRankStageSuccess", res["ranks"]);
        const ranks = res["ranks"];
        this.emitUI(UIControllerName.UIController_uiFirst, { ranks, id: this.id });
    }

    _onRankStageFailed(res: ErrorResponse) {
        console.error("UIMainUICtrl _onRankStageFailed", res);
    }
}
