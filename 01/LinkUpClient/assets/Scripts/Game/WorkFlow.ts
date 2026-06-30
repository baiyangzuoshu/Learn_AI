
import HttpManager from "../../FrameWork/manager/HttpManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { ArtPath, BlockIDs, BundleName, DirectionTip, FirstTip, GameDirection, GameMagic, GameState, GameType, NetRequestCode, ShareType, SoundID, TipText, UIControllerName, UIEventName } from "../Constant";
import { BlockManager } from "../Manager/BlockManager";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import SpriteAtlasManager from "../Manager/SpriteAtlasManager";
import SDKAdapter from "../SDKAdapter";
import { Block, type ErrorResponse, type ItemUseRequest, type ItemUseResponse, type Pos } from "../types";
import { GameBlock } from "./GameBlock";
import { GameSkill } from "./GameSkill";
import { HandlerTiles } from "./HandlerTiles";
import { type OriginalData, type OriginalPlan, type OriginalShape, packFromOriginal, unpackToOriginal } from "./Pack";

export default class WorkFlow extends UIComponent {
    private gameSkill!: GameSkill;
    private use_item = 0;
    onLoad(): void {
        this.gameSkill = this.node.addComponent(GameSkill);

        this.addUIEventListener(UIEventName.WorkFlow_useRefresh, this.useRefresh, (this));
    }
    //
    public onSetBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        this.emitUI(UIEventName.UIGame_checkGameState);
        this.emitUI(UIControllerName.UIController_uiSet, { type: 1 });
    }
    public onShareBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (MapManager.getInstance().checkWin()) {
            GameManager.getInstance().checkTime = 60 * 5 - 3;
            return;
        }

        try {
            // 发起请求
            const name = util.abbreviateByDisplayWidth(PlayerManager.getInstance().HLDDZ_user.nickName);
            ShareManager.getInstance().shareID = PlayerManager.getInstance().role_id;
            const mapTitles = MapManager.getInstance().mapTitles;
            const items: Block[] = [];
            for (const row of mapTitles) {
                for (const block of row) {
                    const ts = block.getComponent(GameBlock).getBaseData();
                    const item = new Block();
                    item.id = ts.id;
                    item.x = ts.x;
                    item.y = ts.y;
                    item.type = ts.type;

                    if (block.getComponent(GameBlock).isVisible) {
                        item.id = ts.id;
                    }
                    else {
                        item.id = 0;
                        item.type = BlockIDs.Placeholder;
                    }
                    items.push(item);
                }
            }
            const map = ShareManager.getInstance().generateMap(PlayerManager.getInstance().role_id, name, items);
            console.log("分享前:", JSON.stringify(map));
            const orig: OriginalShape = {} as OriginalShape;
            orig["role_id"] = PlayerManager.getInstance().role_id + "";
            orig["name"] = name;
            orig["data"] = {} as OriginalData;
            orig["data"]["id"] = map.data.id || 2;
            orig["data"]["width"] = map.data.width || 8;
            orig["data"]["height"] = map.data.height || 14;
            orig["data"]["dirction"] = map.data.dirction || 1;
            orig["data"]["linkCount"] = map.data.linkCount || 10;
            orig["data"]["woodenState"] = map.data.woodenState || 1;
            orig["data"]["rocketState"] = map.data.rocketState || 1;
            orig["data"]["tileTypes"] = 0;
            orig["data"]["tile_types"] = 0;

            orig["plan"] = {} as OriginalPlan;
            orig["plan"]["id"] = map.plan.id || 1;
            orig["plan"]["block1"] = map.plan.block1 || 0;
            orig["plan"]["block2"] = map.plan.block2 || 0;
            orig["plan"]["block3"] = map.plan.block3 || 0;
            orig["plan"]["block4"] = map.plan.block4 || 0;
            orig["plan"]["block5"] = map.plan.block5 || 0;
            orig["plan"]["block6"] = map.plan.block6 || 0;
            orig["plan"]["block7"] = map.plan.block7 || 0;
            orig["plan"]["block8"] = map.plan.block8 || 0;
            orig["plan"]["tileTypes"] = map.plan.tileTypes || 0;
            orig["plan"]["fleshRate1"] = GameManager.getInstance().refreshRate1;
            orig["plan"]["fleshRate2"] = GameManager.getInstance().refreshRate2;
            orig["plan"]["tile_types"] = map.plan.tile_types || 0;
            orig["plan"]["flesh_rate2"] = GameManager.getInstance().refreshRate2;
            orig["plan"]["linkCount"] = GameManager.getInstance().linkCount || 10;

            orig["data"]["serverItems"] = [];
            for (const d of map.data.items) {
                orig["data"]["serverItems"].push([
                    d.id, d.x, d.y, d.type
                ]);
            }
            console.warn("压缩前:", JSON.stringify(orig));
            const mapStr = packFromOriginal(orig);
            console.warn("压缩后:", mapStr)
            const round = unpackToOriginal(mapStr);
            console.warn("解压数据:", JSON.stringify(round));
            console.log("分享id:", round["role_id"]);

            GameManager.getInstance().report.shareOpen++;

            SDKAdapter.getInstance().HLDDZ_shareMessage2({
                id: ShareType.Share, realShare: false, extraStr: mapStr, cb: (data: number) => {
                    SoundManager.Instance.ResumeMusic();
                    util.Log(data);
                    if (data === 1) {
                        util.Log(data);

                    } else {
                        util.Log(data);
                    }
                    GameManager.getInstance().report.shareCount++;
                    GameManager.getInstance().isFirstCreate = false;
                    this.scheduleOnce(() => {
                        GameManager.getInstance().gameAction.successShareAction(GameManager.getInstance().dayMax);
                    }, 0.5);
                }
            });
        }
        catch (error) {
            console.warn("分享失败:", error);
        }
    }

    //
    public onDirBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (MapManager.getInstance().dirction == GameDirection.Rotate) {
            const rotatePath2 = this.node.getChildByName("map").getChildByName("rotatePath2");
            rotatePath2.active = MapManager.getInstance().dirction == GameDirection.Rotate;
            cc.Tween.stopAllByTarget(rotatePath2);
            cc.tween(rotatePath2)
                .delay(2)
                .call(() => {
                    rotatePath2.active = false;
                })
                .start();
        }
        else if (MapManager.getInstance().dirction == GameDirection.DoubleRotate) {
            const rotatePath1 = this.node.getChildByName("map").getChildByName("rotatePath1");
            rotatePath1.active = MapManager.getInstance().dirction == GameDirection.DoubleRotate;
            cc.Tween.stopAllByTarget(rotatePath1);
            cc.tween(rotatePath1)
                .delay(2)
                .call(() => {
                    rotatePath1.active = false;
                })
                .start();
        }
        else if (MapManager.getInstance().dirction == GameDirection.Rotate3) {
            const rotatePath3 = this.node.getChildByName("map").getChildByName("rotatePath3");
            rotatePath3.active = MapManager.getInstance().dirction == GameDirection.Rotate3;
            cc.Tween.stopAllByTarget(rotatePath3);
            cc.tween(rotatePath3)
                .delay(2)
                .call(() => {
                    rotatePath3.active = false;
                })
                .start();
        }
        else if (MapManager.getInstance().dirction == GameDirection.Rotate4) {
            const rotatePath4 = this.node.getChildByName("map").getChildByName("rotatePath4");
            rotatePath4.active = MapManager.getInstance().dirction == GameDirection.Rotate4;
            cc.Tween.stopAllByTarget(rotatePath4);
            cc.tween(rotatePath4)
                .delay(2)
                .call(() => {
                    rotatePath4.active = false;
                })
                .start();
        }

        this.emitUI(UIEventName.UIGame_tip, { text: DirectionTip[MapManager.getInstance().dirction] });
    }

    public onFirstBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (FirstTip[PlayerManager.getInstance().getMapID()]) {
            this.emitUI(UIEventName.UIGame_tip, { text: FirstTip[PlayerManager.getInstance().getMapID()] });
            return;
        }
        this.emitUI(UIEventName.UIGame_tip, { text: DirectionTip[MapManager.getInstance().dirction] });
    }
    //
    public onMatchClick() {
        if (GameManager.getInstance().bagAwaitTime > 0 || GameManager.getInstance().state != GameState.Start) {
            SoundManager.Instance.PlaySound(SoundID.point);
            util.Log("GameManager.getInstance().bagAwaitTime = ", GameManager.getInstance().bagAwaitTime = 1.0);
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.bag2 });
            return;
        }
        if (PlayerManager.getInstance().getMatchNum() <= 0) {
            SoundManager.Instance.PlaySound(SoundID.point);
            this.emitUI(UIControllerName.UIController_uiBag, { type: GameMagic.Match });
            return;
        }
        GameManager.getInstance().bagAwaitTime = 1.0;

        this.use_item = GameMagic.Match;
        SoundManager.Instance.PlaySound(SoundID.bagMatch);
        HttpManager.Instance.request<ItemUseRequest, ItemUseResponse>({ msgId: NetRequestCode.ItemUse, param: { "id": GameMagic.Match } },
            this._onItemUseSuccess.bind(this),
            this._onItemUseFailed.bind(this));
    }

    useMatch() {
        GameManager.getInstance().report.match++;
        GameManager.getInstance().report.itemCont++;
        GameManager.getInstance().openShareTime = 0;

        SoundManager.Instance.PlaySound(SoundID.bagMatch);
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_resetSelectTitle);
        GameManager.getInstance().bagAwaitTime = 1.0;
        this.scheduleOnce(() => {
            // 1) 取出当前逻辑板（不含边界）
            const rawBoard = MapManager.getInstance().getBoard();
            // 2) 调用 BlockManager 进行匹配
            const pos = this.gameSkill.findAnyMatch(rawBoard);
            if (pos.length > 0) {
                util.Log("可消除的图块", pos);
                const firstTile = MapManager.getInstance().mapTitles[pos[0].x - 1][pos[0].y - 1];
                const secondTile = MapManager.getInstance().mapTitles[pos[1].x - 1][pos[1].y - 1];
                const playableBoard = util.addBorder(rawBoard);
                const firstData = firstTile?.getComponent(GameBlock).getBaseData();
                const secondData = secondTile?.getComponent(GameBlock).getBaseData();

                const can = util.canConnectPath(playableBoard, { x: firstData.x + 1, y: firstData.y + 1 }, { x: secondData.x + 1, y: secondData.y + 1 });
                GameManager.getInstance().linePath.drawPath({ path: can, mapWidth: MapManager.getInstance().mapWidth, mapHeight: MapManager.getInstance().mapHeight, _parent: GameManager.getInstance().gameBlock, time: 3 });
            } else {
                util.Log("无可消除的图块");
            }

            this.emitUI(UIEventName.UIGame_checkGameState);
            this.emitUI(UIEventName.UIGame_testShare);

            GameManager.getInstance().checkTime = 60 * 3;
        }, 0.6);
        //
        GameManager.getInstance().onlyRefresh = false;
        this.emitUI(UIEventName.UIGame_refreshBagVisible, { isActive: true });
        this.emitUI(UIEventName.UIGame_useBagEffect, { type: GameMagic.Match });
    }

    _onItemUseSuccess(data: ItemUseRequest) {
        util.Log(data);
        util.Log("PlayerManager.getInstance().item=", PlayerManager.getInstance().item);
        const items = data["items"];
        PlayerManager.getInstance().item = data["item"];
        PlayerManager.getInstance().friend_items = data["friend_items"];
        if (items) {
            const id = data["items"][0]["id"];
            const num = data["items"][0]["num"];
            PlayerManager.getInstance().magic[id] = num;
            if (id == GameMagic.Match) {
                this.useMatch();
            }
            else if (id == GameMagic.Clean) {
                this.useClean();
            }
            else if (id == GameMagic.Refresh) {
                this.useRefresh();
            }
        } else {
            if (this.use_item == GameMagic.Match) {
                this.useMatch();
            }
            else if (this.use_item == GameMagic.Clean) {
                this.useClean();
            }
            else if (this.use_item == GameMagic.Refresh) {
                this.useRefresh();
            }
        }
        GameManager.getInstance().onlyRefresh = false;
        this.emitUI(UIEventName.UIGame_refreshBagVisible, { isActive: true });
        this.emitUI(UIEventName.UIGame_useBagEffect, { type: this.use_item });
    }
    _onItemUseFailed(data: ErrorResponse) {
        console.error("ItemUseFailed", data);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "网络异常，请检查网络！" });
    }
    //优先刷新一对可成对消除的火箭
    public onRefreshClick() {
        util.Log("刷新地图");

        if (GameManager.getInstance().bagAwaitTime > 0 || GameManager.getInstance().state != GameState.Start) {
            SoundManager.Instance.PlaySound(SoundID.point);
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.bag2 });
            util.Log("GameManager.getInstance().bagAwaitTime = ", GameManager.getInstance().bagAwaitTime = 1.0);
            return;
        }
        if (PlayerManager.getInstance().getRefreshNum() <= 0) {
            SoundManager.Instance.PlaySound(SoundID.point);
            this.emitUI(UIControllerName.UIController_uiBag, { type: GameMagic.Refresh });
            return;
        }
        GameManager.getInstance().bagAwaitTime = 1.0;
        SoundManager.Instance.PlaySound(SoundID.bagRefresh);
        this.netRefresh();
    }

    netRefresh() {
        this.use_item = GameMagic.Refresh;
        HttpManager.Instance.request<ItemUseRequest, ItemUseResponse>({ msgId: NetRequestCode.ItemUse, param: { "id": GameMagic.Refresh } },
            this._onItemUseSuccess.bind(this),
            this._onItemUseFailed.bind(this));
    }

    useRefresh() {
        GameManager.getInstance().report.refresh++;
        GameManager.getInstance().report.itemCont++;
        GameManager.getInstance().reshuffleCount++;
        GameManager.getInstance().stopSound = true;
        GameManager.getInstance().openShareTime = 0;
        ShareManager.instance.useBag = true;
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_resetSelectTitle);
        SoundManager.Instance.PlaySound(SoundID.bagRefresh);
        GameManager.getInstance().bagAwaitTime = 1.0;
        this.scheduleOnce(() => {
            // 1) 取出当前逻辑板（不含边界）
            const raw = MapManager.getInstance().getBoard();
            /*
            关卡刷新逻辑；
            分3种情况
           1） 剩余对数大于等于39对（80%）时，用户使用刷新，刷新成对的对数为（当前关卡初始成对数/本局总对数*当前剩余对数），并向上取整
           2）剩余对数∈（4，38），概率为策划配表，当用户本局内第一次使用刷新时，配表1概率；当用户第二次使用刷新时，
           配表2概率；刷新后初始成对数=配置概率*当前剩余对数  往上取整
           3）剩余对数<=3 或 刷新三次后，障碍物消失，配置概率为90%
          */
            const height = raw.length;
            const width = raw[0].length;
            const pools: number[] = [];
            const mapTitles = MapManager.getInstance().mapTitles;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const id = raw[y][x];
                    const tile = mapTitles[x][y];
                    const type = tile.getComponent(GameBlock).getBaseData().type;
                    if (type == BlockIDs.Placeholder) {
                        continue;
                    }
                    if (id > 0 && id <= BlockIDs.None) {
                        pools.push(id);
                    }
                }
            }
            // 2) 第三次及以后，先清除所有特殊图块
            if (pools.length <= 3 || GameManager.getInstance().reshuffleCount >= 3) {
                // 1) 清除所有特殊图块
                SoundManager.Instance.PlaySound(SoundID.clean);
                this.reshuffleRemaining();
                this.cleanSpecial(raw);
            }
            else {
                const raw = MapManager.getInstance().getBoard();
                const newRaw = this.gameSkill.reshuffleRemaining(raw);
                this.applyBoard(newRaw);
                //所有机制捞底,重排后无可消除对，则去掉所有机制；
                if (BlockManager.getInstance().isDeadlock(newRaw)) {
                    this.cleanSpecial(raw);
                }
            }
        }, 1);

        cc.tween(this.node)
            .delay(4.0)
            .call(() => {
                GameManager.getInstance().stopSound = false;

                this.emitUI(UIEventName.UIGame_checkGameState);
                this.emitUI(UIEventName.UIGame_testShare);
                GameManager.getInstance().checkTime = 60 * 3;
            })
            .start();
        //
        GameManager.getInstance().checkTime = 60 * 2;
        GameManager.getInstance().onlyRefresh = false;
        this.emitUI(UIEventName.UIGame_refreshBagVisible, { isActive: true });
        this.emitUI(UIEventName.UIGame_useBagEffect, { type: GameMagic.Refresh });
    }

    reshuffleRemaining() {
        const raw = MapManager.getInstance().getBoard();
        const newRaw = this.gameSkill.reshuffleRemaining(raw);
        // 4) 同步 UI
        this.applyBoard(newRaw);
    }
    //清除特殊图块
    private cleanSpecial(newRaw: number[][]): boolean {
        const h = newRaw.length;
        const w = newRaw[0].length;
        util.Log("h=", h, "w=", w);
        const removePos: Pos[] = [];
        let hasSpecial = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const item = MapManager.getInstance().mapTitles[x][y];
                const type = item.getComponent(GameBlock).getBaseData().type;
                if (type == BlockIDs.Green) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).doGreenAction(GameManager.getInstance().gameBlock);
                }
                else if (type == BlockIDs.Grass) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).doGrassAction();
                }
                else if (type == BlockIDs.Ice || type == BlockIDs.Ice2 || type == BlockIDs.Ice3) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).clearIceAction();
                    item.getComponent(GameBlock).playCleanAction();
                    removePos.push({ x: x, y: y });
                }
                else if (type == BlockIDs.Stone) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).doStoneAction();
                    item.getComponent(GameBlock).playCleanAction();
                    removePos.push({ x: x, y: y });
                }
                else if (type == BlockIDs.Wooden) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).doWoodenAction();
                    item.getComponent(GameBlock).playCleanAction();
                    removePos.push({ x: x, y: y });
                }
                else if (type == BlockIDs.Magnet) {
                    hasSpecial = true;
                    item.getComponent(GameBlock).doMagnetAction();
                    item.getComponent(GameBlock).playCleanAction();
                    const rm = HandlerTiles.instance.handleMagnet([{ x: x, y: y }]);
                    console.log("Magnet1", rm);
                    //removePos排重rm
                    const uniquePos = [];
                    for (const item of rm) {
                        if (removePos.findIndex(t => t.x == item.x && t.y == item.y) == -1) {
                            uniquePos.push(item);
                        }
                    }
                    console.log("Magnet2", uniquePos);
                    removePos.push(...uniquePos);
                }
            }
        }
        //
        if (removePos.length > 0) {
            HandlerTiles.instance.handlerMove(0.3, removePos);
        }
        //
        return hasSpecial;
    }
    /** 将 newRaw[y][x] 同步回 mapTitles 节点与 Sprite */
    private async applyBoard(newRaw: number[][]) {
        const h = newRaw.length;
        const w = newRaw[0].length;
        util.Log("h=", h, "w=", w);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const item = MapManager.getInstance().mapTitles[x][y];
                const id = newRaw[y][x];
                const baseData = item.getComponent(GameBlock).getBaseData();

                if (id == BlockIDs.RK) {
                    baseData.id = id;
                    baseData.type = BlockIDs.Rocket;
                    const specialNode = item.getChildByName("special");
                    specialNode.active = true;
                    item.getChildByName("guang").active = true;
                    item.getComponent(GameBlock).canConnect = true;
                    item.getChildByName("item").opacity = 0;
                    item.getChildByName("special").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(BlockIDs.Rocket + "");
                    specialNode.getComponent(cc.Sprite).enabled = false;
                    specialNode.removeAllChildren();
                    const FX_tbzhadan = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tbzhadan, cc.Prefab) as cc.Prefab;
                    const FX_tbzhadanNode = cc.instantiate(FX_tbzhadan);
                    FX_tbzhadanNode.parent = specialNode;
                    FX_tbzhadanNode.getComponent(cc.Animation).play("tubiaozhadan");
                }
                else if (BlockIDs.Green == baseData.type) {
                    baseData.id = id;
                    item.getComponent(GameBlock).canConnect = false;
                    item.getChildByName("item").opacity = 0;
                    item.getChildByName("item").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(id + "");
                }
                else if (BlockIDs.Grass == baseData.type) {
                    baseData.id = id;
                    item.getComponent(GameBlock).canConnect = false;
                    item.getChildByName("item").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(id + "");
                }
                else if (id > 0 && id < BlockIDs.None) {//随机普通图块
                    baseData.id = id;
                    baseData.type = 0;
                    item.getChildByName("special").active = false;
                    item.getChildByName("guang").active = false;
                    item.getComponent(GameBlock).canConnect = true;
                    item.getChildByName("item").opacity = 255;
                    item.getChildByName("item").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(id + "");
                }
            }
        }
    }
    //清除道具
    canUse() {
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
        if (2 == board.length) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "就剩一对方块啦，直接消除它吧！" });
            return false;
        }

        // 检查是否所有块都是火箭
        let isAllRocket = true;
        for (const id of board) {
            if (id != BlockIDs.RK) {
                isAllRocket = false;
                break;
            }
        }

        if (isAllRocket) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "消除道具，不可消除炸弹！" });
            return false;
        }

        return true;
    }
    public onCleanClick() {
        console.log("onCleanClick", GameManager.getInstance().state);
        if (!this.canUse()) {
            return;
        }

        if (GameManager.getInstance().bagAwaitTime > 0 || GameManager.getInstance().state != GameState.Start) {
            SoundManager.Instance.PlaySound(SoundID.point);
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: TipText.bag2 });
            util.Log("GameManager.getInstance().bagAwaitTime = ", GameManager.getInstance().bagAwaitTime);
            return;
        }
        if (PlayerManager.getInstance().getCleanNum() <= 0) {
            SoundManager.Instance.PlaySound(SoundID.point);
            this.emitUI(UIControllerName.UIController_uiBag, { type: GameMagic.Clean });
            return;
        }
        GameManager.getInstance().bagAwaitTime = 1.0;
        this.use_item = GameMagic.Clean;
        HttpManager.Instance.request<ItemUseRequest, ItemUseResponse>({ msgId: NetRequestCode.ItemUse, param: { "id": GameMagic.Clean } },
            this._onItemUseSuccess.bind(this),
            this._onItemUseFailed.bind(this));
    }

    async useClean() {
        GameManager.getInstance().clickLinkUp++;
        GameManager.getInstance().report.clean++;
        GameManager.getInstance().report.itemCont++;
        SoundManager.Instance.PlaySound(SoundID.bagClean);
        GameManager.getInstance().openShareTime = 0;
        ShareManager.instance.useBag = true;
        this.emitUI(UIEventName.UIGame_refreshBagUI);
        this.emitUI(UIEventName.UIGame_resetSelectTitle);
        // 1) 获取当前逻辑板（不含边界）
        const rawBoard = MapManager.getInstance().getBoard();
        // 2) 随机挑 1 对
        const removed = BlockManager.getInstance().selectRandomPairs(rawBoard, 1);
        const firstTile = MapManager.getInstance().mapTitles[removed[0].x][removed[0].y];
        const secondTile = MapManager.getInstance().mapTitles[removed[1].x][removed[1].y];
        const firstPos = firstTile.getComponent(GameBlock).getBaseData();
        const secondPos = secondTile.getComponent(GameBlock).getBaseData();
        this.emitUI(UIEventName.UIGame_linkupAction, [{ x: firstPos.x, y: firstPos.y }, { x: secondPos.x, y: secondPos.y }]);
        GameManager.getInstance().bagAwaitTime = 1.0;
        const FX_tbzhadan = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tbzhadan, cc.Prefab) as cc.Prefab;
        if (GameManager.getInstance().gameType == GameType.Share) {
            ShareManager.getInstance().shareClickPos = [];
            ShareManager.getInstance().shareClickPos.push({ x: firstPos.x, y: firstPos.y });
            ShareManager.getInstance().shareClickPos.push({ x: secondPos.x, y: secondPos.y });
            GameManager.getInstance().state = GameState.Win;
        }
        this.scheduleOnce(() => {
            const rm: Pos[] = [];
            let maxDur = 0;
            rm.push({ x: firstPos.x, y: firstPos.y });
            rm.push({ x: secondPos.x, y: secondPos.y });

            const width = MapManager.getInstance().mapWidth;
            const height = MapManager.getInstance().mapHeight;
            const rkPos1 = cc.v2(0, 0);//util.getBlockPos({ x: rk[0].y, y: rk[0].x, width, height });
            const rkPos2 = cc.v2(0, 0);//util.getBlockPos({ x: rk[1].y, y: rk[1].x, width, height });
            const targetPos1 = util.getBlockPos({ x: firstPos.y, y: firstPos.x, width, height });
            const targetPos2 = util.getBlockPos({ x: secondPos.y, y: secondPos.x, width, height });
            const fx1 = cc.instantiate(FX_tbzhadan);
            fx1.parent = GameManager.getInstance().gameBlock;
            fx1.setPosition(cc.v2(rkPos1.x, rkPos1.y));
            fx1.scale = 1.5;
            const baseDur = 0.7;
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
            const fx2 = cc.instantiate(FX_tbzhadan);
            fx2.parent = GameManager.getInstance().gameBlock;
            fx2.setPosition(cc.v2(rkPos2.x, rkPos2.y));
            fx2.scale = 1.5;
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

            HandlerTiles.instance.handlerMove(maxDur + 0.5, rm);

            cc.tween(this.node)
                .delay(maxDur + 0.5)
                .call(() => {
                    HandlerTiles.instance.handlerGreenGrass([{ x: firstPos.x, y: firstPos.y }, { x: secondPos.x, y: secondPos.y }]);
                    this.emitUI(UIEventName.UIGame_checkGameState);
                    this.emitUI(UIEventName.UIGame_testShare);
                })
                .start();
        }, 0.6);

        if (GameManager.getInstance().gameType == GameType.Share) {
            cc.tween(this.node)
                .delay(2.0)
                .call(() => {
                    GameManager.getInstance().state = GameState.Win;
                    this.emitUI(UIControllerName.UIController_uiShareWin);
                })
                .start();
        }

        GameManager.getInstance().checkTime = 60 * 3;
        //
        GameManager.getInstance().onlyRefresh = false;
        this.emitUI(UIEventName.UIGame_refreshBagVisible, { isActive: true });
        this.emitUI(UIEventName.UIGame_useBagEffect, { type: GameMagic.Clean });
    }
}
