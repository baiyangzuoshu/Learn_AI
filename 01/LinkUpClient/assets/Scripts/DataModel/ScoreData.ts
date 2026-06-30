import { MD5 } from "../../FrameWork/Lib/MD5";
import { EventManager } from "../../FrameWork/manager/EventManager";
import HttpManager from "../../FrameWork/manager/HttpManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { util } from "../../FrameWork/Utils/util";
import { GameType, NetRequestCode, ScoreKey, UIControllerName, UIEventName } from "../Constant";
import GameManager from "../Manager/GameManager";
import SDKAdapter from "../SDKAdapter";
import { type ErrorResponse, type PlayResponse, type PlayTestRequest, type WinRequest, type WinResponse } from "../types";
import { IDataModel } from "./IDataModel";

export default class ScoreData extends IDataModel {
    netGameChange(id: number) {
        const params: PlayTestRequest = {
            "id": id,
        };

        HttpManager.Instance.request<PlayResponse, PlayTestRequest>(
            {
                msgId: NetRequestCode.PlayScore,
                param: params,
            },
            this._onGameChangeSuccess.bind(this),
            this._onGameFailed.bind(this)
        );
    }

    _onGameChangeSuccess(response: PlayResponse) {
        console.log("_onGameChangeSuccess", response);
        GameManager.getInstance().setDataMap(response);
        UIManager.Instance.removeAllUI();
        EventManager.getInstance().emit(UIControllerName.UIController_uiGame, { gameType: GameType.ScoreChange });
    }
    //
    netGame(id: number) {
        const params: PlayTestRequest = {
            "id": id,
        };

        HttpManager.Instance.request<PlayResponse, PlayTestRequest>(
            {
                msgId: NetRequestCode.PlayScore,
                param: params,
            },
            this._onGameSuccess.bind(this),
            this._onGameFailed.bind(this)
        );
    }

    _onGameSuccess(response: PlayResponse) {
        console.log("_onGameSuccess", response);
        GameManager.getInstance().setDataMap(response);
        UIManager.Instance.removeAllUI();
        EventManager.getInstance().emit(UIControllerName.UIController_uiGame, { gameType: GameType.Score });
    }

    _onGameFailed(res: ErrorResponse) {
        console.log("_onGameFailed", res);
    }
    //
    netFail() {
        const val = GameManager.getInstance().gameMD5Time + "yueli2026";
        const token = MD5.getMD5(val);

        const params: WinRequest = {
            "win": 0,
            "token": token,
            "ad": GameManager.getInstance().reportADCount
        }

        HttpManager.Instance.request<WinResponse, WinRequest>({
            msgId: NetRequestCode.ResultScore,
            param: params
        }, this._onFailSuccess.bind(this), this._onWinFailed.bind(this));
    }

    _onFailSuccess(res: WinResponse) {
        util.Log(res);
        this.emitUI(UIEventName.ScoreExit);
    }

    _onWinFailed(res: ErrorResponse) {
        console.error("WinFailed", res);
        this.emitUI(UIEventName.ScoreFail);
    }
    //
    netWin() {
        const val = GameManager.getInstance().gameMD5Time + "yueli2026";
        const token = MD5.getMD5(val);

        const params: WinRequest = {
            "win": 1,
            "token": token,
            "ad": GameManager.getInstance().reportADCount
        }
        HttpManager.Instance.request<WinResponse, WinRequest>({
            msgId: NetRequestCode.ResultScore,
            param: params
        }, this._onWinSuccess.bind(this), this._onWinFailed.bind(this));
    }

    private _onWinSuccess(res: WinResponse) {
        const score = res["stage_time"];
        const subScoreKey = GameManager.getInstance().planMap["id"];
        GameManager.getInstance().stage_time = res["stage_time"];

        this.emitUI(UIEventName.ScoreWin);
        //
        this.share(score, subScoreKey);
    }

    public share(score: number, subScoreKey: number) {
        SDKAdapter.getInstance().HLDDZ_rankUpdate({ scoreKey: ScoreKey, score: score, subScoreKey: subScoreKey }, (data) => {
            if ("1" == data) {
                console.warn("更新分数成功");
                if (GameType.ScoreChange == GameManager.getInstance().gameType) return;

                SDKAdapter.getInstance().HLDDZ_rankCreateChallenge({ scoreKey: ScoreKey, subScoreKey: subScoreKey }, (data2) => {
                    if ("1" == data2) {
                        console.warn("创建擂台赛成功");
                    }
                    else {
                        console.warn("创建擂台赛失败");
                    }
                });
            }
            else {
                console.warn("更新分数失败");
            }
        })
    }
}
