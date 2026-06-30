import HttpManager from "../../FrameWork/manager/HttpManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { DoubleRotateCollapse } from "../Collapse/DoubleRotateCollapse";
import { DownCollapse } from "../Collapse/DownCollapse";
import { DownUpCollapse } from "../Collapse/DownUpCollapse";
import { LeftCollapse } from "../Collapse/LeftCollapse";
import { LeftRightCollapse } from "../Collapse/LeftRightCollapse";
import { NoneCollapse } from "../Collapse/NoneCollapse";
import { RightCollapse } from "../Collapse/RightCollapse";
import { RightLeftCollapse } from "../Collapse/RightLeftCollapse";
import { RotateCollapse } from "../Collapse/RotateCollapse";
import { RotateType3Collapse } from "../Collapse/RotateType3Collapse";
import { RotateType4Collapse } from "../Collapse/RotateType4Collapse";
import { UpCollapse } from "../Collapse/UpCollapse";
import { UpDownCollapse } from "../Collapse/UpDownCollapse";
import { ArtPath, BlockTip, BundleName, GameDirection, GameMagic, GameState, GameType, LinkUpEnum, NetRequestCode, SeverIPs, SoundID, UIControllerName, UIEventName } from "../Constant";
import GameAction from "../Game/GameAction";
import GameCreate from "../Game/GameCreate";
import GameGuide from "../Game/GameGuide";
import GameRefresh from "../Game/GameRefresh";
import { GameTouch } from "../Game/GameTouch";
import { HandlerTiles } from "../Game/HandlerTiles";
import { LinePath } from "../Game/LinePath";
import WorkFlow from "../Game/WorkFlow";
import { BlockManager } from "../Manager/BlockManager";
import GameControl from "../Manager/GameControl";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import SDKAdapter from "../SDKAdapter";
import { type ErrorResponse, type GuildRequest, type GuildResponse, MapData, type MapPlayRewardRequest, type MapPlayRewardResponse, Pos, ShareMapData } from "../types";
const BAGState = {
    None: 0,
    Close: 1,
    Open: 2
}
export default class UIGameUICtrl extends UIComponent {
    private gameCreate!: GameCreate;
    private gameGuide!: GameGuide;
    private gameRefresh!: GameRefresh;
    private gameTouch = new GameTouch();
    private workFlow = new WorkFlow();
    //private gameTest = new GameTest();
    private bagState: number = BAGState.None;

    onLoad() {
        super.onLoad();
        this.adaptUI();

        ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_zhadan, cc.Prefab);

        GameManager.getInstance().gameBlock = this.getChildByUrl("map");
        //
        HandlerTiles.instance = this.node.addComponent(HandlerTiles);
        this.gameTouch = this.addComponent(GameTouch);
        GameManager.getInstance().linePath = this.addComponent(LinePath);
        this.workFlow = this.addComponent(WorkFlow);
        this.gameCreate = this.addComponent(GameCreate);
        this.gameGuide = this.addComponent(GameGuide);
        this.gameRefresh = this.addComponent(GameRefresh);
        //this.gameTest = this.addComponent(GameTest);
        this.adaptMap(BAGState.Close);
        GameManager.getInstance().gameAction = this.addComponent(GameAction);
        //
        this.AddButtonListener("top/dirRoot", this.workFlow.onDirBtnClick, this.workFlow);
        this.AddButtonListener("top/dirRoot2", this.workFlow.onFirstBtnClick, this.workFlow);
        this.AddButtonListener("gameTip", this.gameTipBtnClick, this);
        this.AddButtonListener("guide2/mask", this.guide2BtnClick, this);
        this.AddButtonListener("startAction", this.startActionBtnClick, this);
        this.AddButtonListener("shareAction", this.shareActionBtnClick, this);
        this.AddDelayButtonListener("top/setBtn", this.workFlow.onSetBtnClick, this.workFlow);
        this.AddDelayButtonListener("top/scoreBtn", this.onScoreBtnClick, this);
        this.AddDelayButtonListener("guideScore/closeBtn", this.onScoreCloseClick, this);
        this.AddDelayButtonListener("guideCut/top/backBtn", this.onBackBtnClick, this);

        this.getChildByUrl("top/scoreBtn").active = GameManager.getInstance().gameType == GameType.Score || GameManager.getInstance().gameType == GameType.ScoreChange;

        //this.AddButtonListener("top/setBtn", this.showWin, this);
        //this.AddButtonListener("test/testBtn", this.gameTest.onTestBtnClick, this.gameTest);
        //this.AddButtonListener("test/stopBtn", this.gameTest.onStopBtnClick, this.gameTest);
        //this.AddButtonListener("test/resumeBtn", this.gameTest.onResumeBtnClick, this.gameTest);
        //this.AddButtonListener("test/restartBtn", this.gameTest.onRestartBtnClick, this.gameTest);

        this.AddDelayButtonListener("bottomBtn/bag/share/shareBtn", this.onShareBtnClick, this);
        this.AddDelayButtonListener("guideShare/shareBtn", this.onShareBtnClick2, this);
        this.AddDelayButtonListener("bottomBtn/bag/matchBtn", this.workFlow.onMatchClick, this.workFlow);
        this.AddDelayButtonListener("bottomBtn/bag/refreshBtn", this.workFlow.onRefreshClick, this.workFlow);
        this.AddDelayButtonListener("bottomBtn/bag/cleanBtn", this.workFlow.onCleanClick, this.workFlow);

        this.getChildByUrl("bottomBtn/bag/share/shareBtn").active=!SDKAdapter.getInstance().isAppHarmonyGame();
        this.getChildByUrl("guideShare/shareBtn").active=!SDKAdapter.getInstance().isAppHarmonyGame();
        //
        this.addUIEventListener(UIEventName.UIGame_checkGameState, this.checkGameState, this);
        this.addUIEventListener(UIEventName.UIGame_nextMap, this.nextMap, this);
        this.addUIEventListener(UIEventName.UIGame_refreshBagUI, this.refreshBagUI, this);
        this.addUIEventListener(UIEventName.UIGame_refreshBagTip, this.linkupAction, this);
        this.addUIEventListener(UIEventName.UIGame_linkupAction, this.linkupAction, this);
        this.addUIEventListener(UIEventName.UIGame_refreshBagVisible, this.refreshBagVisible, this);
        this.addUIEventListener(UIEventName.UIGame_useBagEffect, this.useBagEffect, this);
        this.addUIEventListener(UIEventName.UIGame_onTileClick, this.onTileClick, this);
        this.addUIEventListener(UIEventName.UIGame_onRefreshClick, this.onRefreshClick, this);
        this.addUIEventListener(UIEventName.UIGame_netRefresh, this.netRefresh, this);
        this.addUIEventListener(UIEventName.UIGame_resetCollapse, this.resetCollapse, this);
        this.addUIEventListener(UIEventName.UIGame_testShare, this.testShare, this);
        this.addUIEventListener(UIEventName.UIGame_onBagClick, this.onBagClick, this);
        this.addUIEventListener(UIEventName.UIGame_hideRefreshBagTip, this.hideRefreshBagTip, this);
        this.addUIEventListener(UIEventName.UIGame_touchStart, this.touchStart, this);
        this.addUIEventListener(UIEventName.UIGame_refreshPercentUI, this.refreshPercentUI, this);
        this.addUIEventListener(UIEventName.UIGame_tip, this.showGameTip, this);
        this.addUIEventListener(UIEventName.UIGame_guide, this.showGuide, this);
        this.addUIEventListener(UIEventName.UIGame_showGuideCut, this.showGuideCut, this);
        //
        this.nextMap();
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

    onScoreBtnClick() {
        this.getChildByUrl("guideScore").active = true;
    }

    onScoreCloseClick() {
        this.getChildByUrl("guideScore").active = false;
    }

    async showGuideCut() {
        const map: ShareMapData = ShareManager.getInstance().getMapData();
        await this.gameCreate.onShareMap(map);

        this.gameRefresh.showGuideCut();
    }

    onBackBtnClick() {
        GameControl.Instance.reset();
        UIManager.Instance.removeAllUI();

        this.emitUI(UIControllerName.UIController_uiMain);
    }

    onShareBtnClick2() {
        this.workFlow.onShareBtnClick();
        this.getChildByUrl("guideShare").active = false;
    }

    onShareBtnClick() {
        const guideState = PlayerManager.getInstance().guideState.split("&");
        let id0 = guideState[0] || "0";
        let id1 = guideState[1] || "0";
        if (id1 == "") {
            id1 = "0";
        }
        if (id0 == "") {
            id0 = "0";
        }

        if (Number(id1) < 2) {
            this.getChildByUrl("guideShare").active = true;
            const ret = Number(id1) + 1;
            PlayerManager.getInstance().guideState = id0 + "&" + ret;
            // 发起排行榜请求
            HttpManager.Instance.request<GuildResponse, GuildRequest>({
                msgId: NetRequestCode.Guild,
                param: { "guild": id0 + "&" + ret }
            }, this._onGuildSuccess.bind(this), this._onGuildFailed.bind(this));
        }
        else {
            this.workFlow.onShareBtnClick();
        }
    }

    shareActionBtnClick() {
        this.touchStart();
        this.getChildByUrl("shareAction").active = false;
    }

    startActionBtnClick() {
        this.touchStart();
        this.getChildByUrl("startAction").active = false;
    }

    showGuide() {
        const guideState = PlayerManager.getInstance().guideState.split("&");
        let id0 = guideState[0] || "0";
        let id1 = guideState[1] || "0";
        if (id1 == "") {
            id1 = "0";
        }
        if (id0 == "") {
            id0 = "0";
        }
        if (Number(id0) < 2) {
            const ret = Number(id0) + 1;
            this.getChildByUrl("guide2").active = true;
            PlayerManager.getInstance().guideState = ret + "&" + id1;
            // 发起排行榜请求
            HttpManager.Instance.request<GuildResponse, GuildRequest>({
                msgId: NetRequestCode.Guild,
                param: { "guild": ret + "&" + id1 }
            }, this._onGuildSuccess.bind(this), this._onGuildFailed.bind(this));
        }
        else {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: BlockTip.LinkUpError3 });
        }
    }

    _onGuildSuccess(res: GuildResponse) {
        util.Log("GuildResponse", res);
    }

    _onGuildFailed() {
        util.Log("GuildResponse");
    }

    guide2BtnClick() {
        this.getChildByUrl("guide2").active = false;
    }

    gameTipBtnClick() {
        this.getChildByUrl("gameTip").active = false;
    }

    showGameTip(data: { text: string }) {
        console.log("showGameTip", data.text);
        const gameTipBg = this.getChildByUrl("gameTip/bg");
        this.getChildByUrl("gameTip").active = true;
        gameTipBg.scale = 0.1;
        this.getChildByUrl("gameTip/bg/text").getComponent(cc.Label).string = data.text;
        cc.Tween.stopAllByTarget(gameTipBg);
        cc.tween(gameTipBg)
            .to(0.2, { scale: 1.2 })
            .to(0.1, { scale: 1.0 })
            .delay(3)
            .to(0.2, { scale: 0.1 })
            .call(() => {
                this.getChildByUrl("gameTip").active = false;
            })
            .start();
    }

    refreshPercentUI() {
        this.gameRefresh.refreshPercent();
    }

    touchStart() {
        this.getChildByUrl("touch").active = false;
    }

    onBagClick(type: number) {
        switch (type) {
            case GameMagic.Match:
                this.workFlow.useMatch();
                break;
            case GameMagic.Refresh: {
                this.workFlow.useRefresh();
                break;
            }
            case GameMagic.Clean: {
                this.workFlow.useClean();
                break;
            }
            default:
                break;
        }
    }

    private adaptMap(s: number) {
        if (this.bagState == s || util.isAppPCGame()) {
            return false;
        }

        this.bagState = s;

        const frameSize = cc.view.getFrameSize();
        const realSize = new cc.Rect(0, 0, 0, 0);
        const curDesign = new cc.Rect(0, 0, util.getDesignSize().width, util.getDesignSize().height);
        const designWidth = curDesign.width;
        const designHeight = curDesign.height;

        realSize.width = designWidth;
        realSize.height = designWidth / (frameSize.width / frameSize.height);
        util.Log("UIGameUICtrl frameSize", frameSize.width, frameSize.height);
        util.Log("UIGameUICtrl realSize", realSize.width, realSize.height);
        util.Log("UIGameUICtrl curDesign", curDesign.width, curDesign.height);

        if (realSize.height <= designHeight) {
            this.node.scale = 0.9;

            this.getChildByUrl("top").setPosition(0, 70);
            this.getChildByUrl("guideCut/top").setPosition(0, 70);
            this.getChildByUrl("bottomBtn").setPosition(0, 80);
            this.getChildByUrl("guideCut/shareGuide").setPosition(0, 80);
            this.getChildByUrl("startAction").setPosition(0, 20);
            this.getChildByUrl("map").setPosition(10, 20);

            return true;
        }
        const area = cc.v2(80, 80);//SDKAdapter.getInstance().HLDDZ_getSafeArea();
        const diffY = realSize.height / 2 - designHeight / 2 - area.y;
        this.getChildByUrl("bottomBtn").setPosition(0, diffY);
        this.getChildByUrl("guideCut/shareGuide").setPosition(0, diffY);
        this.getChildByUrl("startAction").setPosition(0, diffY - 50);
        this.getChildByUrl("map").setPosition(10, diffY - 50);

        return true;
    }

    private resetCollapse() {
        switch (MapManager.getInstance().dirction) {
            case GameDirection.Down:
                HandlerTiles.instance.setCollapse(new DownCollapse());
                break;
            case GameDirection.Up:
                HandlerTiles.instance.setCollapse(new UpCollapse());
                break;
            case GameDirection.Left:
                HandlerTiles.instance.setCollapse(new LeftCollapse());
                break;
            case GameDirection.Right:
                HandlerTiles.instance.setCollapse(new RightCollapse());
                break;
            case GameDirection.UpDown:
                HandlerTiles.instance.setCollapse(new UpDownCollapse());
                break;
            case GameDirection.LeftRight:
                HandlerTiles.instance.setCollapse(new LeftRightCollapse());
                break;
            case GameDirection.RightLeft:
                HandlerTiles.instance.setCollapse(new RightLeftCollapse());
                break;
            case GameDirection.DownUp:
                HandlerTiles.instance.setCollapse(new DownUpCollapse());
                break;
            case GameDirection.Rotate:
                HandlerTiles.instance.setCollapse(new RotateCollapse());
                break;
            case GameDirection.DoubleRotate:
                HandlerTiles.instance.setCollapse(new DoubleRotateCollapse());
                break;
            case GameDirection.Rotate3:
                HandlerTiles.instance.setCollapse(new RotateType3Collapse());
                break;
            case GameDirection.Rotate4:
                HandlerTiles.instance.setCollapse(new RotateType4Collapse());
                break;
            default:
                HandlerTiles.instance.setCollapse(new NoneCollapse());
                break;
        }
    }

    netRefresh() {
        this.workFlow.netRefresh();
    }
    onRefreshClick() {
        this.workFlow.onRefreshClick();
    }

    onTileClick(block: cc.Node) {
        this.gameTouch.onTileClick(block);
    }

    linkupAction(rm: Pos[]) {
        const size = { width: MapManager.getInstance().mapWidth, height: MapManager.getInstance().mapHeight };
        GameManager.getInstance().gameAction.linkupAction(rm, GameManager.getInstance().clickLinkUp, size);
        GameManager.getInstance().clickLinkUpTime = LinkUpEnum.LinkTime;
    }

    useBagEffect(data: { type: number }) {
        GameManager.getInstance().gameAction.useBagEffect(data);
    }

    nextMap() {
        const touchNode = this.getChildByUrl("touch");
        touchNode.active = true;
        cc.tween(touchNode)
            .delay(10)
            .call(() => {
                touchNode.active = false;
            })
            .start();

        GameControl.Instance.reset();

        GameManager.getInstance().state = GameState.Start;
        GameManager.getInstance().gameAction.closeShareAction();
        SoundManager.Instance.PlaySound(SoundID.startGame);
        const nameLabel = this.getChildByUrl("top/name");
        nameLabel.setPosition(0, 620);
        nameLabel.getComponent(cc.Label).string = "第" + (PlayerManager.getInstance().getMapID()) + "关";

        if (GameManager.getInstance().gameType == GameType.Share) {
            const name = util.abbreviateByDisplayWidth(ShareManager.getInstance().getMapData().name, { widthInHan: 4 });
            nameLabel.getComponent(cc.Label).string = name + "的场外求助";
            nameLabel.setPosition(0, 620);
        }
        else if (GameType.Score == GameManager.getInstance().gameType || GameType.ScoreChange == GameManager.getInstance().gameType) {
            nameLabel.getComponent(cc.Label).string = "擂台挑战";
        }
        this.getChildByUrl("top/percent").active = GameManager.getInstance().gameType != GameType.Share;
        this.getChildByUrl("top/shareTip").active = GameManager.getInstance().gameType == GameType.Share;
        this.getChildByUrl("top/dirRoot").removeAllChildren();
        this.getChildByUrl("top/dirRoot2").removeAllChildren();
        this.initMap();
        this.refreshBagUI();
        //分享奖励
        if (PlayerManager.getInstance().friends > 0) {
            HttpManager.Instance.request<MapPlayRewardResponse, MapPlayRewardRequest>(
                { msgId: NetRequestCode.MapPlayReward, param: { "id": 0 } },
                this._onMapPlayRewardSuccess.bind(this),
                this._onMapPlayRewardFailed.bind(this)
            );
        }
    }

    _onMapPlayRewardSuccess(res: MapPlayRewardResponse) {
        util.Log("MapPlayRewardSuccess", res);
        const add = res["friend_items"] - PlayerManager.getInstance().friend_items;
        PlayerManager.getInstance().friends = res["friends"];
        PlayerManager.getInstance().friend_items = res["friend_items"];
        const names = res["friend_name"];
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIControllerName.UIController_uiShareReward, { names: names, add: add });
    }
    _onMapPlayRewardFailed(res: ErrorResponse) {
        console.error("MapPlayRewardFailed", res);
    }

    async initMap() {
        if (SeverIPs.Local == HttpManager.address) {
            util.Log("本地服务", PlayerManager.getInstance().getMapID());
            if (GameManager.getInstance().gameType == GameType.Share) {
                const map: ShareMapData = ShareManager.getInstance().getMapData();
                await this.gameCreate.onShareMap(map);
                this.gameCreate.loadMapAfter();
            }
            else {
                const tableMap = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Tables/map/" + GameManager.getInstance().planMap["id"], cc.JsonAsset) as cc.JsonAsset;
                const map: MapData = tableMap.json as MapData;
                await this.gameCreate.onLoadMap(map);
            }
        }
        else {
            if (GameManager.getInstance().gameType == GameType.Share) {
                const map: ShareMapData = ShareManager.getInstance().getMapData();
                await this.gameCreate.onShareMap(map);
                this.gameCreate.loadMapAfter();
                this.touchStart();
                const arr = ["考考你的眼力！找出可消除的方块", "别笑，你也找不出哪里可消除！", "消除一对就成啦", "强力玩家一眼就能找到可消除方块"];

                const index = Math.floor(Math.random() * arr.length);
                this.emitUI(UIEventName.UIGame_tip, { text: arr[index] });
            }
            else {
                const map: MapData = GameManager.getInstance().gameMap;
                await this.gameCreate.onLoadMap(map);
            }
        }

        this.gameGuide.initNewAction();
        this.refreshPercentUI();
    }

    refreshBagUI() {
        this.gameRefresh.refreshBagUI();
    }

    hideRefreshBagTip() {
        this.gameRefresh.hideRefreshBagTip();
    }

    refreshBagVisible(data: { isActive: boolean }) {
        this.gameRefresh.refreshBagVisible(data);
    }

    refreshBagTip() {
        this.adaptMap(BAGState.Open);
        this.gameRefresh.refreshBagTip();
    }

    private showWin() {
        GameManager.getInstance().report.mapID = PlayerManager.getInstance().getMapID();
        GameManager.getInstance().reportNew.pass = 1;
        GameManager.getInstance().report.pass = 1;
        GameManager.getInstance().report.gkCount = 1;
        GameManager.getInstance().report.time = Math.floor(GameManager.getInstance().time);

        GameManager.getInstance().gameResultReport();

        GameManager.getInstance().state = GameState.Win;
        this.emitUI(UIControllerName.UIController_uiWin);
    }

    private checkGameState() {
        if (GameManager.getInstance().state != GameState.Start) {
            util.Log("checkGameState state=", GameManager.getInstance().state);
            return;
        }
        this.refreshPercentUI();
        //检测胜利
        if (MapManager.getInstance().checkWin()) {
            util.Log("胜利");
            if (GameManager.getInstance().gameType == GameType.Share) {
                cc.tween(this.node)
                    .delay(1.0)
                    .call(() => {
                        GameManager.getInstance().state = GameState.Win;
                        this.emitUI(UIControllerName.UIController_uiShareWin);
                    })
                    .start();
            }
            else {
                this.showWin();
            }
        }
        else {
            if (GameManager.getInstance().gameType == GameType.Share) {
                return;
            }
            //死局判断
            const raw = MapManager.getInstance().getBoard(); // y×x 原始数据，不含边界
            if (BlockManager.getInstance().isDeadlock(raw)) {
                util.Log("死局：提示自动刷新或使用道具");
                GameManager.getInstance().checkTime = -99999;
                GameManager.getInstance().state = GameState.Restart;
                GameManager.getInstance().gameAction.closeShareAction();
                this.emitUI(UIControllerName.UIController_uiRestart);
            }
            else {
                util.Log("正常");
            }
        }
    }

    private testShare() {
        this.gameRefresh.testShare();
    }
}
