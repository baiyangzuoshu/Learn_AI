
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { GameType, ModelName, UIControllerName, UIName } from "../Constant";
import ScoreData from "../DataModel/ScoreData";
import GameSocketService from "../GameSocketService";
import UIBackUICtrl from "../UI/UIBackUICtrl";
import UIBagTipUICtrl from "../UI/UIBagTipUICtrl";
import UICommonTipUICtrl from "../UI/UICommonTipUICtrl";
import UICommonUICtrl from "../UI/UICommonUICtrl";
import UIDiamondBuyUICtrl from "../UI/UIDiamondBuyUICtrl";
import UIDiamondTipUICtrl from "../UI/UIDiamondTipUICtrl";
import UIFirstUICtrl from "../UI/UIFirstUICtrl";
import UIGameUICtrl from "../UI/UIGameUICtrl";
import UIMainUICtrl from "../UI/UIMainUICtrl";
import UIPaySuccessCtrl from "../UI/UIPaySuccessCtrl";
import UIPayTipUICtrl from "../UI/UIPayUICtrl";
import UIRankUICtrl from "../UI/UIRankUICtrl";
import UIRestartUICtrl from "../UI/UIRestartUICtrl";
import UIRewardCommonUICtrl from "../UI/UIRewardCommonUICtrl";
import UIRewardInfoCtrl from "../UI/UIRewardInfoUICtrl";
import UISetUICtrl from "../UI/UISetUICtrl";
import UIShareRewardUICtrl from "../UI/UIShareRewardUICtrl";
import UIShareTipUICtrl from "../UI/UIShareTipUICtrl";
import UIShareWinUICtrl from "../UI/UIShareWinUICtrl";
import UIWinUICtrl from "../UI/UIWinUICtrl";
import DataManager from "./DataManager";
import GameManager from "./GameManager";
import PlayerManager from "./PlayerManager";

export default class UIController extends UIComponent {
    // LIFE-CYCLE CALLBACKS:


    onLoad() {
        this.addUIEventListener(UIControllerName.UIController_uiMain, this.uiMain, this);
        this.addUIEventListener(UIControllerName.UIController_uiGame, this.uiGame, this);
        this.addUIEventListener(UIControllerName.UIController_uiSet, this.uiSet, this);
        this.addUIEventListener(UIControllerName.UIController_uiWin, this.uiWin, this);
        this.addUIEventListener(UIControllerName.UIController_uiBag, this.uiBag, this);
        this.addUIEventListener(UIControllerName.UIController_uiRestart, this.uiRestart, this);
        this.addUIEventListener(UIControllerName.UIController_uiCommonTip, this.uiCommonTip, this);
        this.addUIEventListener(UIControllerName.UIController_uiRank, this.uiRank, this);
        this.addUIEventListener(UIControllerName.UIController_UIPayTip, this.UIPayTip, this);
        this.addUIEventListener(UIControllerName.UIController_UIPaySuccess, this.UIPaySuccess, this);
        this.addUIEventListener(UIControllerName.UIController_UIDiamondBuy, this.UIDiamondBuy, this);
        this.addUIEventListener(UIControllerName.UIController_UIDiamondTip, this.UIDiamondTip, this);
        this.addUIEventListener(UIControllerName.UIController_UIRewardInfo, this.UIRewardInfo, this);
        this.addUIEventListener(UIControllerName.UIController_UIRewardCommon, this.UIRewardCommon, this);
        this.addUIEventListener(UIControllerName.UIController_uiShareReward, this.uiShareReward, this);
        this.addUIEventListener(UIControllerName.UIController_uiShareWin, this.uiShareWin, this);
        this.addUIEventListener(UIControllerName.UIController_uiShareTip, this.uiShareTip, this);
        this.addUIEventListener(UIControllerName.UIController_uiFirst, this.uiFirst, this);
        this.addUIEventListener(UIControllerName.UIController_uiCommon, this.uiCommon, this);
        this.addUIEventListener(UIControllerName.UIController_rankonChallengeStart, this.rankonChallengeStart, this);
        this.addUIEventListener(UIControllerName.UIController_UIKeyExit, this.UIKeyExit, this);
    }

    /*
    新增能力：终端安卓返回键。
     适用玩法：终端cocos引擎做的玩法：连连看，华容道。
     对应效果： 参考菜王来对标吧。

    1、如果此时没有弹窗，点击安卓返回键，等价于点击界面左上角返回键。  
    2、如果此时有弹窗，点击安卓返回键，等价于关闭弹窗。
    */
    async UIKeyExit() {
        const arr=[UIName.UIBack,UIName.UIBagTip,UIName.UICommon,UIName.UIDiamondBuy,UIName.UIFirst,UIName.UIRank,UIName.UISet];
        for(const name of arr){
            const isView = UIManager.Instance.isUiMapHas(name);
            if (isView) {
                UIManager.Instance.DestroyUIView(name);
                return;
            }
        }

        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIBack);
        if (!view) return;
        view.addComponent(UIBackUICtrl);
    }

    rankonChallengeStart(data: { scoreKey: string, subScoreKey: number }) {
        const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
        dataModel.netGameChange(data.subScoreKey);
    }

    async uiCommon(data: { type: number, texts: string[] }) {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UICommon);
        if (!view) return;
        const ts = view.addComponent(UICommonUICtrl);
        ts.initData(data);
    }

    async uiFirst(data: {
        ranks: {
            avatar: string,
            name: string,
            stage_time: number
        }[],
        id: number
    }) {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIFirst);
        if (!view) return;
        const ts = view.addComponent(UIFirstUICtrl);
        ts.initData(data);
    }

    async uiShareTip() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIShareTip);
        if (!view) return;
        view.addComponent(UIShareTipUICtrl)
    }

    async uiShareWin() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIShareWin);
        if (!view) return;
        view.addComponent(UIShareWinUICtrl)
    }

    async uiShareReward(data: { names: string[], add: number }) {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIShareReward);
        if (!view) return;
        const ts = view.addComponent(UIShareRewardUICtrl);
        ts.initData(data.names, data.add);
    }

    async UIRewardCommon(data: { type: number, arr: { id: number, num: number }[] }) {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIRewardInfo);
        if (!view) return;
        view.addComponent(UIRewardCommonUICtrl).initData(data);
    }

    async UIRewardInfo() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIRewardInfo);
        if (!view) return;
        view.addComponent(UIRewardInfoCtrl)
    }

    async UIPaySuccess(res: unknown) {
        const data: { type: number } = res as { type: number }
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIPaySuccess);
        if (!view) return;
        const ts = view.addComponent(UIPaySuccessCtrl);
        ts.init(data["type"]);
    }

    async UIPayTip(res: unknown) {
        const data: { type: number } = res as { type: number }
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIPayTip);
        if (!view) return;
        const ts = view.addComponent(UIPayTipUICtrl);
        ts.init(data["type"]);
    }

    async UIDiamondBuy() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIDiamondBuy);
        if (!view) return;
        view.addComponent(UIDiamondBuyUICtrl)
    }

    async UIDiamondTip() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIDiamondTip);
        if (!view) return;
        view.addComponent(UIDiamondTipUICtrl)
    }

    async uiRank() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIRank);
        if (!view) return;
        view.addComponent(UIRankUICtrl);
    }


    async uiCommonTip(data: { text: string }) {
        util.Log("uiCommonTip", data);

        const view = await UIManager.Instance.IE_ShowUIView(UIName.UICommonTip);
        if (!view) return;
        view.addComponent(UICommonTipUICtrl).initText(data.text);
    }

    async uiRestart() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIRestart);
        if (!view) return;
        view.addComponent(UIRestartUICtrl)
    }

    async uiGame(data: { gameType: number }) {
        GameManager.getInstance().gameType = data.gameType;
        await this.enterSocketStage(data.gameType);
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIGame);
        if (!view) return;
        view.addComponent(UIGameUICtrl)
    }

    private async enterSocketStage(gameType: number): Promise<void> {
        GameManager.getInstance().socketSnapshot = null;
        if (gameType !== GameType.Normal) {
            return;
        }

        const stageId = PlayerManager.getInstance().getMapID();
        util.Log("[GameSocketService] enter stage request", stageId);
        try {
            const snapshot = await GameSocketService.getInstance().enterStage(stageId, 1500);
            GameManager.getInstance().socketSnapshot = snapshot;
            util.Log("[GameSocketService] enter stage success", snapshot);
        }
        catch (err: any) {
            util.Log("[GameSocketService] enter stage failed, continue local game", err.message);
        }
    }

    async uiSet(data: { type: number }) {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UISet);
        if (!view) return;
        view.addComponent(UISetUICtrl).initData(data.type);
    }

    async uiMain() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIMain);
        if (!view) return;
        view.addComponent(UIMainUICtrl)
    }

    async uiWin() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIWin);
        if (!view) return;
        view.addComponent(UIWinUICtrl)
    }

    async uiBag(data: { type: number }) {

        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIBagTip);
        if (!view) return;
        view.addComponent(UIBagTipUICtrl).initData(data.type);
    }

    // update (dt) {}
}
