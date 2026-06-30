import { ResManager } from '../../FrameWork/manager/ResManager';
import { UIComponent } from '../../FrameWork/ui/UIComponent';
import { util } from '../../FrameWork/Utils/util';
import type { CollapseStrategy } from '../Collapse/CollapseStrategy';
import { ArtPath, BlockIDs, BundleName, dirs, GameDirection, GameState, GameType, SoundID, UIControllerName, UIEventName } from '../Constant';
import { BlockManager } from '../Manager/BlockManager';
import GameManager from '../Manager/GameManager';
import MapManager from '../Manager/MapManager';
import ShareManager from '../Manager/ShareManager';
import { Pos } from '../types';
import { GameBlock } from './GameBlock';

export class HandlerTiles extends UIComponent {
    public static instance: HandlerTiles = new HandlerTiles();

    private collapse: CollapseStrategy | undefined;

    public setCollapse(collapse: CollapseStrategy) {
        this.collapse = collapse;
    }

    handlerMove(delayTime = 0.25, rm: Pos[]) {
        //判断上下左右方向图块，是否有冰图块
        delayTime = this.handlerIce(delayTime, rm);
        //坍塌方向
        this.handlerCollapse(delayTime, rm);
    }

    handlerCollapse(delayTime = 0.25, rm: Pos[]) {
        if (this.collapse) {
            this.collapse.collapse(delayTime, rm);
        }
    }

    handlerGreenGrass(rm: Pos[]) {
        const board: number[][] = MapManager.getInstance().getBoard();
        const mapTitles = MapManager.getInstance().mapTitles;
        for (const data of rm) {
            for (const dir of dirs) {
                const col = data.x + dir.dx;
                const row = data.y + dir.dy;
                if (col < 0 || col >= board[0].length || row < 0 || row >= board.length) {
                    continue;
                }

                const type = mapTitles[col][row].getComponent(GameBlock).getBaseData().type;
                if (BlockIDs.Green == type) {
                    mapTitles[col][row].getComponent(GameBlock).doGreenAction(GameManager.getInstance().gameBlock);
                }
                if (BlockIDs.Grass == type) {
                    mapTitles[col][row].getComponent(GameBlock).doGrassAction();
                }
            }

        }
    }

    async handlerRocket(rk: Pos[]) {
        util.Log(rk.length);
        // 1) 获取当前逻辑板（不含边界）
        const rawBoard = MapManager.getInstance().getBoard();
        // 2) 随机挑 1 对
        const removed = BlockManager.getInstance().selectRandomPairs(rawBoard, 1);
        const rm: Pos[] = [];
        const FX_tbzhadan = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tbzhadan, cc.Prefab) as cc.Prefab;
        const width = MapManager.getInstance().mapWidth;
        const height = MapManager.getInstance().mapHeight;
        const FX_tubiaoguang = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tubiaoguang, cc.Prefab) as cc.Prefab;

        let maxDur = 0;
        for (let i = 0; i < removed.length; i = i + 2) {
            const firstTile = MapManager.getInstance().mapTitles[removed[i].x][removed[i].y];
            const secondTile = MapManager.getInstance().mapTitles[removed[i + 1].x][removed[i + 1].y];

            const firstPos = firstTile.getComponent(GameBlock).getBaseData();
            const secondPos = secondTile.getComponent(GameBlock).getBaseData();
            if (GameManager.getInstance().gameType == GameType.Share) {
                ShareManager.getInstance().shareClickPos = [];
                ShareManager.getInstance().shareClickPos.push({ x: firstPos.x, y: firstPos.y });
                ShareManager.getInstance().shareClickPos.push({ x: secondPos.x, y: secondPos.y });
                GameManager.getInstance().state = GameState.Win;
                this.emitUI(UIControllerName.UIController_uiShareWin);
            }
            const targetPos1 = util.getBlockPos({ x: firstPos.y, y: firstPos.x, width, height });
            const targetPos2 = util.getBlockPos({ x: secondPos.y, y: secondPos.x, width, height });
            const rkPos1 = cc.v2(0, 200);//util.getBlockPos({ x: rk[0].y, y: rk[0].x, width, height });
            const rkPos2 = cc.v2(0, 200);//util.getBlockPos({ x: rk[1].y, y: rk[1].x, width, height });

            firstTile.getComponent(GameBlock).setSleepTime(20);
            secondTile.getComponent(GameBlock).setSleepTime(20);

            this.handlerGreenGrass([firstPos, secondPos]);

            rm.push({ x: firstPos.x, y: firstPos.y });
            rm.push({ x: secondPos.x, y: secondPos.y });

            const fx = cc.instantiate(FX_tbzhadan);
            fx.parent = GameManager.getInstance().gameBlock;
            fx.setPosition(cc.v2(rkPos1.x, rkPos1.y));
            fx.scale = 1.5;
            cc.tween(fx)
                .by(0.5, { position: cc.v3(0, -200, 0) })
                .delay(1.3)
                .call(() => {
                    fx.destroy();
                })
                .start()

            const FX_tubiaoguangNode = cc.instantiate(FX_tubiaoguang);
            FX_tubiaoguangNode.parent = fx;
            FX_tubiaoguangNode.setPosition(0, 0);
            FX_tubiaoguangNode.getComponent(cc.Animation).play("guangdian");
            FX_tubiaoguangNode.setSiblingIndex(0);
            FX_tubiaoguangNode.setScale(0.5);

            const fx1 = cc.instantiate(FX_tbzhadan);
            fx1.parent = GameManager.getInstance().gameBlock;
            fx1.setPosition(cc.v2(rkPos1.x, rkPos1.y));
            fx1.scale = 1.5;
            const baseDur = 0.7;
            cc.tween(fx1)
                .by(0.5, { position: cc.v3(0, -200, 0) })
                .delay(0.3)
                .call(() => {
                    rkPos1.y = 0;
                    const pos1 = cc.v2(rkPos1.x, rkPos1.y), pos2 = cc.v2(targetPos1.x, targetPos1.y);
                    const dur1 = util.throwSimple({ node: fx1, pos1: pos1, pos2: pos2, baseDur: baseDur });
                    cc.tween(fx1)
                        .delay(dur1 + 0.1)
                        .call(() => {
                            fx1.removeFromParent();
                            firstTile.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
                            GameManager.getInstance().curBlockCount++;
                        })
                        .start();
                    //
                    cc.tween(this.node)
                        .delay(0.1)
                        .call(() => { GameManager.getInstance().playSoundBlock(SoundID.zhadan); })
                        .start()
                })
                .start();
            //
            const fx2 = cc.instantiate(FX_tbzhadan);
            fx2.parent = GameManager.getInstance().gameBlock;
            fx2.setPosition(cc.v2(rkPos2.x, rkPos2.y));
            fx2.scale = 1.5;
            cc.tween(fx2)
                .by(0.5, { position: cc.v3(0, -200, 0) })
                .delay(0.3)
                .call(() => {
                    rkPos2.y = 0;
                    const p1 = cc.v2(rkPos2.x, rkPos2.y), p2 = cc.v2(targetPos2.x, targetPos2.y);
                    const dur2 = util.throwSimple({ node: fx2, pos1: p1, pos2: p2, baseDur: baseDur });
                    //
                    cc.tween(fx2)
                        .delay(dur2 + 0.1)
                        .call(() => {
                            fx2.removeFromParent();
                            secondTile.getComponent(GameBlock).connect(GameManager.getInstance().gameBlock);
                            GameManager.getInstance().curBlockCount++;
                        })
                        .start();

                    maxDur = dur2;

                    GameManager.getInstance().clickLinkUp += 1;

                    this.emitUI(UIEventName.UIGame_linkupAction, rm);
                    GameManager.getInstance().checkTime = 60 * 3;

                    this.handlerMove(maxDur + 0.5, rm);

                    cc.tween(this.node)
                        .delay(maxDur + 0.5)
                        .call(() => {
                            this.emitUI(UIEventName.UIGame_checkGameState);
                            this.emitUI(UIEventName.UIGame_testShare);
                        })
                        .start();
                })
                .start();
        }
    }

    handlerIce(delayTime: number, rm: Pos[]) {
        const gm = MapManager.getInstance();
        const newRm: Pos[] = [];
        for (const data of rm) {
            for (const dir of dirs) {
                const col = data.x + dir.dx;
                const row = data.y + dir.dy;
                if (col < 0 || col >= gm.mapHeight || row < 0 || row >= gm.mapWidth) {
                    continue;
                }

                const block = gm.mapTitles[col][row];

                if (block.getComponent(GameBlock).doIceAction(GameManager.getInstance().gameBlock)) {
                    const x = block.getComponent(GameBlock).getBaseData().x;
                    const y = block.getComponent(GameBlock).getBaseData().y;
                    const icePos = { x: x, y: y };
                    const rmPos = rm.find((item) => {
                        return item.x == icePos.x && item.y == icePos.y;
                    })
                    util.Log("rmPos", rmPos);
                    if (rmPos) {
                        continue;
                    }
                    newRm.push({ x: icePos.x, y: icePos.y });
                    delayTime = delayTime + 0.25;
                }
            }
        }

        for (const item of newRm) {
            rm.push({ x: item.x, y: item.y });
        }

        return delayTime;
    }

    handleMagnet(rm: Pos[]) {
        const gm = MapManager.getInstance();
        const w = gm.mapWidth;
        const h = gm.mapHeight;

        const newRm: Pos[] = [];
        newRm.push(...rm);
        for (const data of rm) {
            const magnetPos = { x: data.x, y: data.y };
            switch (MapManager.getInstance().dirction) {
                case GameDirection.Down:
                    for (let j = -1; j < 2; j++) {
                        const y = magnetPos.y + j;
                        if (y < 0 || y >= w) {
                            continue;
                        }
                        for (let i = magnetPos.x + 1; i < h; i++) {
                            if (!gm.mapTitles[i][y].active) {
                                newRm.push({ x: i, y: y });
                            }
                        }
                    }
                    break;
                case GameDirection.Up:
                    for (let j = -1; j < 2; j++) {
                        const y = magnetPos.y + j;
                        if (y < 0 || y >= w) {
                            continue;
                        }
                        for (let i = magnetPos.x - 1; i >= 0; i--) {
                            if (!gm.mapTitles[i][y].active) {
                                newRm.push({ x: i, y: y });
                            }
                        }
                    }
                    break;
                case GameDirection.Left:
                    for (let i = -1; i < 2; i++) {
                        const x = magnetPos.x + i;
                        if (x < 0 || x >= h) {
                            continue;
                        }
                        for (let j = magnetPos.y - 1; j >= 0; j--) {
                            if (!gm.mapTitles[x][j].active) {
                                newRm.push({ x: x, y: j });
                            }
                        }
                    }

                    break;
                case GameDirection.Right:
                    for (let i = -1; i < 2; i++) {
                        const x = magnetPos.x + i;
                        if (x < 0 || x >= h) {
                            continue;
                        }
                        for (let j = magnetPos.y + 1; j < w; j++) {
                            if (!gm.mapTitles[x][j].active) {
                                newRm.push({ x: x, y: j });
                            }
                        }
                    }
                    break;
                case GameDirection.UpDown:
                    //up
                    for (let j = -1; j < 2; j++) {
                        const y = magnetPos.y + j;
                        if (y < 0 || y >= w) {
                            continue;
                        }
                        for (let i = magnetPos.x - 1; i >= 0; i--) {
                            if (!gm.mapTitles[i][y].active) {
                                newRm.push({ x: i, y: y });
                            }
                        }
                    }
                    //down
                    for (let j = -1; j < 2; j++) {
                        const y = magnetPos.y + j;
                        if (y < 0 || y >= w) {
                            continue;
                        }
                        for (let i = magnetPos.x + 1; i < h; i++) {
                            if (!gm.mapTitles[i][y].active) {
                                newRm.push({ x: i, y: y });
                            }
                        }
                    }
                    break;
                case GameDirection.LeftRight:
                    //left
                    for (let i = -1; i < 2; i++) {
                        const x = magnetPos.x + i;
                        if (x < 0 || x >= h) {
                            continue;
                        }
                        for (let j = magnetPos.y - 1; j >= 0; j--) {
                            if (!gm.mapTitles[x][j].active) {
                                newRm.push({ x: x, y: j });
                            }
                        }
                    }
                    //right
                    for (let i = -1; i < 2; i++) {
                        const x = magnetPos.x + i;
                        if (x < 0 || x >= h) {
                            continue;
                        }
                        for (let j = magnetPos.y + 1; j < w; j++) {
                            if (!gm.mapTitles[x][j].active) {
                                newRm.push({ x: x, y: j });
                            }
                        }
                    }
                    break;
                case GameDirection.RightLeft:
                    break;
                case GameDirection.DownUp:
                    break;
                case GameDirection.Rotate:
                case GameDirection.Rotate4:
                case GameDirection.Rotate3:
                    break;
                case GameDirection.DoubleRotate:
                    break;
                default:
                    break;
            }
        }
        return newRm;
    }
}



