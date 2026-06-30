import { SoundManager } from '../../FrameWork/manager/SoundManager';
import { UIComponent } from '../../FrameWork/ui/UIComponent';
import { util } from '../../FrameWork/Utils/util';
import { BlockIDs, BlockTip, dirs, dirsMagnet, GameState, GameType, SoundID, UIControllerName, UIEventName } from '../Constant';
import GameManager from '../Manager/GameManager';
import MapManager from '../Manager/MapManager';
import ShareManager from '../Manager/ShareManager';
import { GameBlock } from './GameBlock';
import { HandlerTiles } from './HandlerTiles';

export class GameTouch extends UIComponent {
    firstTile?: cc.Node;
    secondTile?: cc.Node;
    startPos: cc.Vec2 = new cc.Vec2();
    start() {
        //
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.addUIEventListener(UIEventName.UIGame_resetSelectTitle, this.resetSelectTitle, this);
    }

    onTouchStart(e: cc.Event.EventTouch) {
        //util.Log("touch start", e.getLocation());
        this.startPos = e.getLocation();
    }
    onTouchMove() {
        //util.Log("touch move", e.getLocation());
    }
    onTouchEnd(e: cc.Event.EventTouch) {
        //util.Log("touch end", e.getLocation());
        const itemStart = this.getTouchItem(this.startPos);
        let itemEnd!: cc.Node;
        if (!itemStart) {
            itemEnd = this.getTouchItem(e.getLocation()) as cc.Node;
        }
        else {
            const diff = cc.v2(this.startPos.x - e.getLocation().x, this.startPos.y - e.getLocation().y);
            //console.log("diff", diff.x, diff.y);
            if (Math.abs(diff.x) < 100 && Math.abs(diff.y) < 100) {
                itemEnd = this.getTouchItem(e.getLocation()) as cc.Node;
            }
            else {
                itemEnd = this.getTouchItemScale(e.getLocation(), itemStart) as cc.Node;
            }
        }
        if (itemStart == itemEnd && itemStart) {
            if (itemStart == this.firstTile) {
                this.firstTile = undefined;
                itemStart.getComponent(GameBlock).setSelect(false);
                SoundManager.Instance.PlaySound(SoundID.pointBlock);
                //对局界面，点击某一个方块，所有同图案方块会一起抖动
                const blocks = MapManager.getInstance().getBlocksById(itemStart.getComponent(GameBlock).getBaseData().id);
                for (const block of blocks) {
                    const type = block.getComponent(GameBlock).getBaseData().type
                    if (type == BlockIDs.Green) {
                        continue;
                    }
                    GameManager.getInstance().HLDDZ_vibrateShort();
                    block.getComponent(GameBlock).shake();
                }
            }
            else {
                this.onTileClick(itemStart);
                GameManager.getInstance().isPoint = true;
                util.Log("点击消除");
            }
        }
        else {
            GameManager.getInstance().isMove = true;
            util.Log("滑动消除");
            if (itemStart) {
                this.onTileClick(itemStart);
            }
            if (itemEnd) {
                this.onTileClick(itemEnd);
            }
        }
    }

    resetSelectTitle() {
        GameManager.getInstance().linePath.clear();
    }

    onTileClick(tile: cc.Node) {
        if (!this.firstTile) {
            this.firstTile = tile;
            tile.getComponent(GameBlock).setSelect(true);
            SoundManager.Instance.PlaySound(SoundID.pointBlock);
        } else if (!this.secondTile && tile !== this.firstTile) {
            this.linkUp(tile);
        }

        GameManager.getInstance().openShareTime = 0;

    }

    async linkUp(tile: cc.Node) {
        this.secondTile = tile;
        tile.getComponent(GameBlock).setSelect(true);
        SoundManager.Instance.PlaySound(SoundID.pointBlock);
        GameManager.getInstance().clickLinkUp++;
        GameManager.getInstance().bagTipTime = 0;

        const board: number[][] = MapManager.getInstance().getBoard();
        const playableBoard = util.addBorder(board);

        const firstData = this.firstTile?.getComponent(GameBlock).getBaseData();
        const secondData = this.secondTile?.getComponent(GameBlock).getBaseData();
        if (!firstData || !secondData || !this.firstTile || !this.secondTile) {
            return;
        }

        if (firstData.id != secondData.id) {
            this.firstTile?.getComponent(GameBlock).setSelect(false);
            this.secondTile?.getComponent(GameBlock).setSelect(false);
            this.firstTile = this.secondTile;
            this.secondTile = undefined;
            this.firstTile?.getComponent(GameBlock).setSelect(true);
            GameManager.getInstance().linkUpErrorDouble[0]++;
            if (GameManager.getInstance().linkUpErrorCount[0] < 1 || GameManager.getInstance().linkUpErrorDouble[0] >= 6) {
                GameManager.getInstance().linkUpErrorCount[0]++;
                GameManager.getInstance().linkUpErrorDouble[0] = 0;
                this.emitUI(UIControllerName.UIController_uiCommonTip, { text: BlockTip.LinkUpError1 });
            }
            util.Log("linkUpErrorDouble0", GameManager.getInstance().linkUpErrorDouble[0]);
            return;
        }

        const firstBlock = this.firstTile;
        const secondBlock = this.secondTile;
        this.firstTile = undefined;
        this.secondTile = undefined;

        const can = util.canConnectPath(playableBoard, { x: firstData.x + 1, y: firstData.y + 1 }, { x: secondData.x + 1, y: secondData.y + 1 });
        if (can.length > 0) {
            GameManager.getInstance().HLDDZ_vibrateShort();
            GameManager.getInstance().bagAwaitTime = 1;
            if (GameManager.getInstance().gameType == GameType.Share) {
                GameManager.getInstance().state = GameState.Win;
                ShareManager.getInstance().shareClickPos = [];
                ShareManager.getInstance().shareClickPos.push({ x: firstData.x, y: firstData.y });
                ShareManager.getInstance().shareClickPos.push({ x: secondData.x, y: secondData.y });
            }
            //
            if (firstBlock.getComponent(GameBlock).getBaseData().type == BlockIDs.Rocket) {
                const w = MapManager.getInstance().mapWidth;
                const h = MapManager.getInstance().mapHeight;
                const posArr = [cc.v2(firstData.x, firstData.y), cc.v2(secondData.x, secondData.y)];
                for (const p of posArr) {
                    for (const pos of dirsMagnet) {
                        const curX = p.x + pos.dx;
                        const curY = p.y + pos.dy;
                        if (curX < 0 || curX >= h || curY < 0 || curY >= w) {
                            continue;
                        }
                        const tile = MapManager.getInstance().mapTitles[curX][curY];
                        //tile.getComponent(GameBlock).setSelect(true);
                        tile.getComponent(GameBlock).setSleepTime(3);
                    }
                }
            }
            firstBlock.getComponent(GameBlock).setSleepTime(10);
            secondBlock.getComponent(GameBlock).setSleepTime(10);
            GameManager.getInstance().linePath.drawPath({ path: can, mapWidth: MapManager.getInstance().mapWidth, mapHeight: MapManager.getInstance().mapHeight, _parent: GameManager.getInstance().gameBlock, time: 9999 });
            this.emitUI(UIEventName.UIGame_linkupAction, [{ x: firstData.x, y: firstData.y }, { x: secondData.x, y: secondData.y }]);
            this.emitUI(UIEventName.UIGame_hideRefreshBagTip);
            this.emitUI(UIEventName.GameGuide_touchCancel);

            this.scheduleOnce(() => {
                this.afterLinkUp(firstBlock, secondBlock);
            }, 0.3);
            ;
        } else {
            util.Log("link up failed", firstData, secondData);
            /*
                    1、【连接的2个方块图案不相同】：相同图案才能消除哦
                    2、【图案相同，但是至少有一个方块被其它方块完全包围，导致没有连线路径】：被包围了无法连线哦
                    3、【图案相同，且方块都没有被包围可以连线，但是连线的转折超过2次】：连线转折不超过2次才能消除哦
            */
            firstBlock?.getComponent(GameBlock).shake();
            secondBlock?.getComponent(GameBlock).shake();

            const posArr = [cc.v2(firstData.x, firstData.y), cc.v2(secondData.x, secondData.y)];
            let isRotate = false;
            const w = MapManager.getInstance().mapWidth;
            const h = MapManager.getInstance().mapHeight;
            for (const p of posArr) {
                let count = 0;
                //console.log("p", p.x, p.y);
                for (const pos of dirs) {
                    const curX = p.x + pos.dx;
                    const curY = p.y + pos.dy;
                    //console.log("curX", curX, curY, w, h);
                    if (curX < 0 || curX >= h || curY < 0 || curY >= w) {
                        continue;
                    }
                    const curId = MapManager.getInstance().getBoard()[curY][curX];
                    if (curId > 0) {
                        count++;
                    }
                    //console.log("count", count, curId);
                }

                if (count == 4) {
                    isRotate = true;
                }

                if (isRotate) {
                    break;
                }
            }
            util.Log("linkUpErrorDouble1", GameManager.getInstance().linkUpErrorDouble[1]);
            util.Log("linkUpErrorDouble2", GameManager.getInstance().linkUpErrorDouble[2]);
            if (isRotate) {
                GameManager.getInstance().linkUpErrorDouble[1]++;
                if ((GameManager.getInstance().linkUpErrorCount[1] < 1 || GameManager.getInstance().linkUpErrorDouble[1] >= 3)) {
                    GameManager.getInstance().linkUpErrorCount[1]++;
                    GameManager.getInstance().linkUpErrorDouble[1] = 0;
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: BlockTip.LinkUpError2 });
                }
            }
            else {
                GameManager.getInstance().linkUpErrorDouble[2]++;
                if (GameManager.getInstance().linkUpErrorCount[2] < 1 || GameManager.getInstance().linkUpErrorDouble[2] >= 3) {
                    GameManager.getInstance().linkUpErrorCount[2]++;
                    GameManager.getInstance().linkUpErrorDouble[2] = 0;

                    this.emitUI(UIEventName.UIGame_guide);
                }
            }

            firstBlock?.getComponent(GameBlock).setSelect(true);
            secondBlock?.getComponent(GameBlock).setSelect(true);

            cc.tween(this.node)
                .delay(0.1)
                .call(() => {
                    firstBlock?.getComponent(GameBlock).setSelect(false);
                    secondBlock?.getComponent(GameBlock).setSelect(false);
                })
                .start();
        }
    }

    afterLinkUp(firstBlock: cc.Node, secondBlock: cc.Node) {
        //
        SoundManager.Instance.PlaySound(SoundID.linkup);
        //
        const rm = [{ x: firstBlock.getComponent(GameBlock).getBaseData().x, y: firstBlock.getComponent(GameBlock).getBaseData().y }, { x: secondBlock.getComponent(GameBlock).getBaseData().x, y: secondBlock.getComponent(GameBlock).getBaseData().y }];
        HandlerTiles.instance.handlerGreenGrass(rm);
        GameManager.getInstance().linePath.clear();
        firstBlock.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
        GameManager.getInstance().curBlockCount++;
        secondBlock.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
        GameManager.getInstance().curBlockCount++;
        //
        HandlerTiles.instance.handlerMove(0.3, rm);
        //
        if (firstBlock.getComponent(GameBlock).getBaseData().type == BlockIDs.Rocket) {
            this.scheduleOnce(() => {
                HandlerTiles.instance.handlerRocket(rm);
                this.checkGameState();
            }, 0.5);
        }
        else {
            this.checkGameState();
        }

        //
        const select1Node = GameManager.getInstance().gameBlock.getChildByName("select1");
        select1Node.active = false;
        const select2Node = GameManager.getInstance().gameBlock.getChildByName("select2");
        select2Node.active = false;
        //
        this.emitUI(UIEventName.UIGame_resetSelectTitle);

        if (GameManager.getInstance().gameType == GameType.Share) {
            cc.tween(this.node)
                .delay(1.0)
                .call(() => {
                    this.emitUI(UIControllerName.UIController_uiShareWin);
                })
                .start();
        }
    }

    getTouchItem(pos: cc.Vec2) {
        const mapTitles = MapManager.getInstance().mapTitles;
        const afterArr = [];
        for (const v of mapTitles) {
            for (const item of v) {
                const itemPos = item.convertToWorldSpaceAR(new cc.Vec3(-50, -30));
                const itemSize = item.getContentSize();
                itemPos.x += itemSize.width / 2;
                itemPos.y += itemSize.height / 2;
                if (Math.abs(itemPos.x - pos.x) < 50 && Math.abs(itemPos.y - pos.y) < 50) {
                    if (item.getComponent(GameBlock).isSleep()) {
                        continue;
                    }

                    if (!item.getComponent(GameBlock).canBlockConnect()) {
                        afterArr.push(item);
                        continue;
                    }
                    return item;
                }
            }
        }

        for (const item of afterArr) {
            item.getComponent(GameBlock).shakeSpecial();
        }

        return null;
    }
    //放大触摸
    getTouchItemScale(pos: cc.Vec2, itemStart: cc.Node) {
        const mapTitles = MapManager.getInstance().mapTitles;
        const scaleItems = [];
        for (const v of mapTitles) {
            for (const item of v) {
                const itemPos = item.convertToWorldSpaceAR(new cc.Vec3(-50, -30));
                const itemSize = item.getContentSize();
                itemPos.x += itemSize.width / 2;
                itemPos.y += itemSize.height / 2;
                if (Math.abs(itemPos.x - pos.x) < 80 && Math.abs(itemPos.y - pos.y) < 80) {
                    if (item.getComponent(GameBlock).isSleep()) {
                        continue;
                    }

                    //item.getComponent(GameBlock).shake();
                    scaleItems.push(item);
                }
            }
        }

        const board: number[][] = MapManager.getInstance().getBoard();
        const playableBoard = util.addBorder(board);
        const firstData = itemStart.getComponent(GameBlock).getBaseData();

        for (const item of scaleItems) {
            if (item == itemStart) {
                continue;
            }
            const secondData = item.getComponent(GameBlock).getBaseData();
            const can = util.canConnectPath(playableBoard, { x: firstData.x + 1, y: firstData.y + 1 }, { x: secondData.x + 1, y: secondData.y + 1 });
            if (can.length > 0) {
                return item;
            }
        }

        return null;
    }

    checkGameState() {
        cc.tween(this.node)
            .delay(1)
            .call(() => {
                this.emitUI(UIEventName.UIGame_checkGameState);
                this.emitUI(UIEventName.UIGame_testShare);
                GameManager.getInstance().checkTime = 60 * 3;
            })
            .start();
    }
    // === WebSocket 网络消除结果处理 ===
    afterServerLinkup(firstBlock: cc.Node, secondBlock: cc.Node, result: any) {
        SoundManager.Instance.PlaySound(SoundID.linkup);
        const rm = [
            { x: (result.removed && result.removed[0]) ? result.removed[0].x : 0,
              y: (result.removed && result.removed[0]) ? result.removed[0].y : 0 },
            { x: (result.removed && result.removed[1]) ? result.removed[1].x : 0,
              y: (result.removed && result.removed[1]) ? result.removed[1].y : 0 }
        ];
        HandlerTiles.instance.handlerGreenGrass(rm);
        GameManager.getInstance().linePath.clear();

        firstBlock.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
        GameManager.getInstance().curBlockCount++;
        secondBlock.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
        GameManager.getInstance().curBlockCount++;

        HandlerTiles.instance.handlerMove(0.3, rm);

        if (result.is_win) {
            this.scheduleOnce(() => { this.emitUI(UIEventName.UIGame_checkGameState); }, 0.5);
        }
        if (result.is_deadlock) {
            this.scheduleOnce(() => { this.emitUI(UIEventName.UIGame_checkGameState); }, 1);
        }
    }

    handleLinkupFail(firstBlock: cc.Node, secondBlock: cc.Node, firstData: any, secondData: any) {
        firstBlock?.getComponent(GameBlock).shake();
        secondBlock?.getComponent(GameBlock).shake();
        GameManager.getInstance().linkUpErrorDouble[2]++;
        if (GameManager.getInstance().linkUpErrorCount[2] < 1 || GameManager.getInstance().linkUpErrorDouble[2] >= 3) {
            GameManager.getInstance().linkUpErrorCount[2]++;
            GameManager.getInstance().linkUpErrorDouble[2] = 0;
            this.emitUI(UIEventName.UIGame_guide);
        }
        firstBlock?.getComponent(GameBlock).setSelect(true);
        secondBlock?.getComponent(GameBlock).setSelect(true);
        cc.tween(this.node).delay(0.1).call(() => {
            firstBlock?.getComponent(GameBlock).setSelect(false);
            secondBlock?.getComponent(GameBlock).setSelect(false);
        }).start();
    }

    doLocalLinkup(firstBlock: cc.Node, secondBlock: cc.Node, firstData: any, secondData: any, board: number[][], playableBoard: number[][]) {
        const can = util.canConnectPath(playableBoard, { x: firstData.x + 1, y: firstData.y + 1 }, { x: secondData.x + 1, y: secondData.y + 1 });
        if (can.length > 0) {
            GameManager.getInstance().HLDDZ_vibrateShort();
            GameManager.getInstance().bagAwaitTime = 1;
            if (GameManager.getInstance().gameType == GameType.Share) {
                GameManager.getInstance().state = GameState.Win;
                ShareManager.getInstance().shareClickPos = [];
                ShareManager.getInstance().shareClickPos.push({ x: firstData.x, y: firstData.y });
                ShareManager.getInstance().shareClickPos.push({ x: secondData.x, y: secondData.y });
            }
            if (firstBlock.getComponent(GameBlock).getBaseData().type == BlockIDs.Rocket) {
                const w = MapManager.getInstance().mapWidth;
                const h = MapManager.getInstance().mapHeight;
                const posArr = [cc.v2(firstData.x, firstData.y), cc.v2(secondData.x, secondData.y)];
                for (const p of posArr) {
                    for (const pos of dirsMagnet) {
                        const curX = p.x + pos.dx;
                        const curY = p.y + pos.dy;
                        if (curX < 0 || curX >= h || curY < 0 || curY >= w) continue;
                        const tile = MapManager.getInstance().mapTitles[curX][curY];
                        tile.getComponent(GameBlock).setSleepTime(3);
                    }
                }
            }
            firstBlock.getComponent(GameBlock).setSleepTime(10);
            secondBlock.getComponent(GameBlock).setSleepTime(10);
            GameManager.getInstance().linePath.drawPath({ path: can, mapWidth: MapManager.getInstance().mapWidth, mapHeight: MapManager.getInstance().mapHeight, _parent: GameManager.getInstance().gameBlock, time: 9999 });
            this.emitUI(UIEventName.UIGame_linkupAction, [{ x: firstData.x, y: firstData.y }, { x: secondData.x, y: secondData.y }]);
            this.emitUI(UIEventName.UIGame_hideRefreshBagTip);
            this.emitUI(UIEventName.GameGuide_touchCancel);
            this.scheduleOnce(() => { this.afterLinkUp(firstBlock, secondBlock); }, 0.3);
        } else {
            firstBlock?.getComponent(GameBlock).shake();
            secondBlock?.getComponent(GameBlock).shake();
            const w = MapManager.getInstance().mapWidth;
            const h = MapManager.getInstance().mapHeight;
            const posArr = [cc.v2(firstData.x, firstData.y), cc.v2(secondData.x, secondData.y)];
            let isRotate = false;
            for (const p of posArr) {
                let count = 0;
                for (const pos of dirs) {
                    const curX = p.x + pos.dx;
                    const curY = p.y + pos.dy;
                    if (curX < 0 || curX >= h || curY < 0 || curY >= w) continue;
                    const curId = MapManager.getInstance().getBoard()[curY][curX];
                    if (curId > 0) count++;
                }
                if (count == 4) { isRotate = true; break; }
            }
            if (isRotate) {
                GameManager.getInstance().linkUpErrorDouble[1]++;
                if ((GameManager.getInstance().linkUpErrorCount[1] < 1 || GameManager.getInstance().linkUpErrorDouble[1] >= 3)) {
                    GameManager.getInstance().linkUpErrorCount[1]++;
                    GameManager.getInstance().linkUpErrorDouble[1] = 0;
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: BlockTip.LinkUpError2 });
                }
            } else {
                GameManager.getInstance().linkUpErrorDouble[2]++;
                if (GameManager.getInstance().linkUpErrorCount[2] < 1 || GameManager.getInstance().linkUpErrorDouble[2] >= 3) {
                    GameManager.getInstance().linkUpErrorCount[2]++;
                    GameManager.getInstance().linkUpErrorDouble[2] = 0;
                    this.emitUI(UIEventName.UIGame_guide);
                }
            }
            firstBlock?.getComponent(GameBlock).setSelect(true);
            secondBlock?.getComponent(GameBlock).setSelect(true);
            cc.tween(this.node).delay(0.1).call(() => {
                firstBlock?.getComponent(GameBlock).setSelect(false);
                secondBlock?.getComponent(GameBlock).setSelect(false);
            }).start();
        }
    }


}


