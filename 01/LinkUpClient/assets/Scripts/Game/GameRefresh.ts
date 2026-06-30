import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { BlockIDs, GameState, GameType, SDKState, UIEventName } from "../Constant";
import { BlockManager } from "../Manager/BlockManager";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import { GameBlock } from "./GameBlock";

export default class GameRefresh extends UIComponent {
    refreshPercent() {
        const percentNode = this.node.getChildByName("top").getChildByName("percent");
        const percentLabel = percentNode.getComponent(cc.Label);
        let num = GameManager.getInstance().curBlockCount * 100 / GameManager.getInstance().maxBlockCount;
        num = Math.min(100, num);
        percentLabel.string = Math.floor(num) + "%";
    }

    refreshBagUI() {
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        const matchBg = bagNode.getChildByName("matchBtn").getChildByName("bg");
        const refreshBg = bagNode.getChildByName("refreshBtn").getChildByName("bg");
        const cleanBg = bagNode.getChildByName("cleanBtn").getChildByName("bg");
        matchBg.active = PlayerManager.getInstance().getMatchNum() > 0;
        refreshBg.active = PlayerManager.getInstance().getRefreshNum() > 0;
        cleanBg.active = PlayerManager.getInstance().getCleanNum() > 0;

        const matchNum = matchBg.getChildByName("num")
        matchNum.getComponent(cc.Label).string = PlayerManager.getInstance().getMatchNum().toString();
        const refreshNum = refreshBg.getChildByName("num");
        refreshNum.getComponent(cc.Label).string = PlayerManager.getInstance().getRefreshNum().toString();
        const cleanNum = cleanBg.getChildByName("num");
        cleanNum.getComponent(cc.Label).string = PlayerManager.getInstance().getCleanNum().toString();
    }

    refreshBagVisible(data: { isActive: boolean }) {
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        bagNode.getChildByName("matchBtn").active = data.isActive;
        bagNode.getChildByName("cleanBtn").active = data.isActive;
        bagNode.getChildByName("refreshBtn").getChildByName("22").active = data.isActive;
        bagNode.getChildByName("refreshBtn").getChildByName("29").active = !data.isActive;
    }

    hideRefreshBagTip() {
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        const names = ["matchBtn", "refreshBtn", "cleanBtn"];
        names.forEach(name => {
            const bagTip = bagNode.getChildByName(name).getChildByName("tip");
            bagTip.active = false;
        })
    }

    refreshBagTip() {
        const index = Math.ceil(Math.random() * 3);
        const names = ["matchBtn", "refreshBtn", "cleanBtn"];
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        const bagTip = bagNode.getChildByName(names[index - 1]).getChildByName("tip");
        bagTip.active = true;
        bagTip.setScale(0.9);
        cc.tween(bagTip)
            .to(1, { scale: 1 })
            .to(1, { scale: 0.9 })
            .to(1, { scale: 1 })
            .to(1, { scale: 0.9 })
            .to(0.5, { scale: 0.1 })
            .start();
        this.scheduleOnce(() => {
            bagTip.active = false;
        }, 4.5);
    }

    async showGuideCut() {
        this.node.getChildByName("bottomBtn").getChildByName("bag").active = false;
        this.node.getChildByName("guideCut").active = true;
        this.node.getChildByName("top").getChildByName("setBtn").active = false;
        const shouzhi = this.node.getChildByName("guideCut").getChildByName("shareGuide").getChildByName("shouzhi");
        const tip = this.node.getChildByName("guideCut").getChildByName("shareGuide").getChildByName("tip");
        const pos = ShareManager.getInstance().shareClickPos;
        const firstTile = MapManager.getInstance().mapTitles[pos[0].x][pos[0].y];
        const secondTile = MapManager.getInstance().mapTitles[pos[1].x][pos[1].y];
        const rawBoard = MapManager.getInstance().getBoard();
        const playableBoard = util.addBorder(rawBoard);
        const firstData = firstTile?.getComponent(GameBlock).getBaseData();
        const secondData = secondTile?.getComponent(GameBlock).getBaseData();
        firstTile?.getComponent(GameBlock).setSelect(true);
        secondTile?.getComponent(GameBlock).setSelect(true);
        let title = secondTile;
        let titleX = pos[1].x;
        if (pos[0].y > pos[1].y) {
            title = firstTile;
            titleX = pos[0].x;
        }

        let scale = 0.5;
        let y = 80;
        console.log("titleX=", titleX);
        if (13 == titleX) {
            scale = 0.5;
            y = 40;
        }

        const titleWorld = title.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const nodePos = shouzhi.parent.convertToNodeSpaceAR(titleWorld);
        tip.setPosition(cc.v2(0, nodePos.y + 100));
        this.node.getChildByName("top").getChildByName("shareTip").getComponent(cc.Label).string = "第" + (ShareManager.getInstance().getMapID()) + "关";
        if (titleWorld.x > 500) {
            shouzhi.setScale(cc.v2(-scale, scale));
            shouzhi.setPosition(cc.v2(nodePos.x - 100 * scale, nodePos.y - y));
            cc.tween(shouzhi)
                .repeatForever(
                    cc.tween()
                        .by(1.0, { position: cc.v3(50 * scale, 50 * scale, 0) })
                        .by(1.0, { position: cc.v3(-50 * scale, -50 * scale, 0) })
                )
                .start()
        }
        else {
            shouzhi.setScale(cc.v2(scale, scale));
            shouzhi.setPosition(cc.v2(nodePos.x + 90 * scale, nodePos.y - y));
            cc.tween(shouzhi)
                .repeatForever(
                    cc.tween()
                        .by(1.0, { position: cc.v3(-50 * scale, 50 * scale, 0) })
                        .by(1.0, { position: cc.v3(50 * scale, -50 * scale, 0) })
                )
                .start()
        }

        const can = util.canConnectPath(playableBoard, { x: firstData.x + 1, y: firstData.y + 1 }, { x: secondData.x + 1, y: secondData.y + 1 });
        GameManager.getInstance().linePath.drawPath({ path: can, mapWidth: MapManager.getInstance().mapWidth, mapHeight: MapManager.getInstance().mapHeight, _parent: GameManager.getInstance().gameBlock, time: 300 });
    }
    /*
    降低场外求助的触发门槛，触发条件改为：同时满足以下2个条件时：
    （1）剩余方块数大于10对 
    （2）只剩2对当前可消除方块，或者  30秒没点击任何方块时 （这里门槛降低了）
    */
    testShare() {
        if (GameManager.getInstance().onlyRefresh
            || !GameManager.getInstance().isFirstCreate
            || GameManager.getInstance().gameType == GameType.Share
            || GameManager.getInstance().dayMax >= 3) {
            return;
        }

        const board: number[] = [];
        const raw = MapManager.getInstance().getBoard(); // y×x 原始数据，不含边界
        for (const row of raw) {
            for (const id of row) {
                if (id > BlockIDs.Empty && id < BlockIDs.None) {
                    board.push(id);
                }
            }
        }
        util.Log("board.length=", board.length);
        if (2 * 10 <= board.length) {
            const matches = BlockManager.getInstance().findAllMatches(raw);
            util.Log("matches.length=", matches.length);
            if (matches.length <= 4) {
                GameManager.getInstance().openShareTime = 0;
                //this.adaptMap(BAGState.Open);
                GameManager.getInstance().gameAction.openShareAction();
            }
        }
    }

    updateShare(dt: number) {
        if (GameManager.getInstance().isFirstCreate
            && GameManager.getInstance().gameType == GameType.Normal
            && GameManager.getInstance().dayMax < 3) {
            if (!GameManager.getInstance().onlyRefresh) {
                GameManager.getInstance().openShareTime += dt;
            }

            if (GameManager.getInstance().openShareTime >= 30) {
                GameManager.getInstance().openShareTime = 0;

                const board: number[] = [];
                const raw = MapManager.getInstance().getBoard(); // y×x 原始数据，不含边界
                for (const row of raw) {
                    for (const id of row) {
                        if (id > BlockIDs.Empty && id < BlockIDs.None) {
                            board.push(id);
                        }
                    }
                }
                util.Log("board.length=", board.length);
                if (2 * 10 <= board.length) {
                    GameManager.getInstance().gameAction.openShareAction();
                    //this.adaptMap(BAGState.Open);
                    return;
                }
            }
        }
    }
    //
    update(dt: number): void {
        if (GameManager.getInstance().state != GameState.Start) {
            return;
        }

        if (SDKState.None != GameManager.getInstance().sdkState) {
            return;
        }

        if (GameManager.getInstance().bagTipTime > 20 && GameManager.getInstance().bagTipCount == 0) {
            GameManager.getInstance().bagTipTime = -99999;
            GameManager.getInstance().bagTipCount = 1;
            this.refreshBagTip();
        }

        GameManager.getInstance().checkTime += 1;
        if (GameManager.getInstance().checkTime == 60 * 5) {
            console.log("GameManager.getInstance().checkTime", GameManager.getInstance().checkTime);
            this.emitUI(UIEventName.UIGame_checkGameState);
        }

        this.updateShare(dt);
    }
}
