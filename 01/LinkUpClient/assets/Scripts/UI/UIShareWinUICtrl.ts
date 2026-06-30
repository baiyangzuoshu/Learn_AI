

import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { GameType, MusicID, NetRequestCode, SeverIPs, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import GameControl from "../Manager/GameControl";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import type { ErrorResponse, MapPlayResultRequest, MapPlayResultResponse, PlayResponse, PlayTestRequest } from "../types";
export default class UIShareWinUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        SoundManager.Instance.StopMainMusic();
        SoundManager.Instance.PlaySound(SoundID.win);
        this.AddButtonListener("bg1/battleBtn", this._onClickBattleBtn, this);
        this.AddButtonListener("bg1/cutBtn", this._onClickCutBtn, this);

        if (ShareManager.instance.useBag) {
            this.getChildByUrl("bg1/cutBtn").active = false;
            this.getChildByUrl("bg1/battleBtn").position = cc.v3(0, -302.495, 0);
        }

        const guang11 = this.getChildByUrl("bg2/guang/11");
        cc.tween(guang11)
            .repeatForever(cc.tween().by(1, { angle: -180 }).by(1, { angle: -180 }))
            .start();

        const guang1 = this.getChildByUrl("bg1/12");
        cc.tween(guang1)
            .repeatForever(cc.tween().by(1, { angle: -180 }).by(1, { angle: -180 }))
            .start();

        const title = this.getChildByUrl("bg2/title");
        cc.tween(title)
            .by(0.5, { position: cc.v3(1500, 0, 0) })
            .delay(1.0)
            .by(0.5, { position: cc.v3(0, 500, 0) })
            .delay(1.7)
            .to(0.25, { scale: 0.001 })
            .start();

        const guang = this.getChildByUrl("bg2/guang");
        guang.setScale(0.1);
        guang.active = false;
        cc.tween(guang)
            .delay(1.7)
            .call(() => {
                guang.active = true;
            })
            .to(0.25, { scale: 1.3 })
            .to(0.25, { scale: 1 })
            .delay(1.5)
            .to(0.25, { scale: 0.001 })
            .delay(0.3)
            .call(() => {
                SoundManager.Instance.PlaySound(SoundID.link3_4);
                this.getChildByUrl("bg1").active = true;
                this.getChildByUrl("bg2").active = false;
            })
            .start();
    }

    _onClickCutBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        this.emitUI(UIEventName.UIGame_showGuideCut);
        UIManager.Instance.DestroyUIView(UIName.UIShareWin);
    }

    _onClickEventBtn() {
        this.getChildByUrl("bg1").active = true;
        this.getChildByUrl("bg2").active = false;
    }

    private _onClickBattleBtn() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (PlayerManager.getInstance().pass_stage >= GameManager.getInstance().maxMapID) {
            GameControl.Instance.reset();
            UIManager.Instance.removeAllUI();

            this.emitUI(UIControllerName.UIController_uiMain);
            return;
        }

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
        SoundManager.Instance.PlayMusic(MusicID.main);
        GameManager.getInstance().gameType = GameType.Normal;
        GameManager.getInstance().setDataMap(response);
        PlayerManager.getInstance().friends = response["friends"];
        this.emitUI(UIEventName.UIGame_nextMap);
        UIManager.Instance.DestroyUIView(UIName.UIShareWin);
    }

    _onPlayFailed(err: unknown) {
        console.error("PlayFailed", err);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    start() {
        this.netShare();
    }

    netShare() {
        HttpManager.Instance.request<MapPlayResultResponse, MapPlayResultRequest>({
            msgId: NetRequestCode.MapPlayResult,
            param: {
                "id": ShareManager.getInstance().getRoleID(),
                "stage": ShareManager.getInstance().getMapID(),
                "win": 1
            }
        }, this._onMapPlayResultSuccess.bind(this), this._onMapPlayResultFailed.bind(this));
    }

    _onMapPlayResultSuccess(res: MapPlayResultResponse) {
        util.Log("MapPlayResultSuccess", res);
    }

    _onMapPlayResultFailed(res: ErrorResponse) {
        console.error("MapPlayResultFailed", res);
    }
}
