
import HttpManager from "../../FrameWork/manager/HttpManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { ArtPath, BlockIDs, BundleName, DirectionTip, FirstTip, GameDirection, GameType, MapHeight, NetRequestCode, SeverIPs, TitleSize, UIControllerName, UIEventName } from "../Constant";
import { BlockManager } from "../Manager/BlockManager";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import SpriteAtlasManager from "../Manager/SpriteAtlasManager";
import { Block, type ErrorResponse, MapData, type MapPlayRewardRequest, type MapPlayRewardResponse, ShareMapData, TMap, TPlan } from "../types";
import DirectionAction from "./DirectionAction";
import { GameBlock } from "./GameBlock";

export default class GameCreate extends UIComponent {
    private directionAction!: DirectionAction;
    onLoad(): void {
        this.directionAction = this.addComponent(DirectionAction);
    }

    private getRandomIDs(len: number) {
        const ids = [];
        do {
            const id = Math.floor(Math.random() * len) + 1;
            if (ids.indexOf(id) == -1) {
                ids.push(id);
            }
        } while (ids.length < 4)

        return ids;
    }

    public async onLoadPlan(id: number): Promise<TPlan> {
        const tableMap = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Tables/json/tbmap", cc.JsonAsset) as cc.JsonAsset;
        const mapJsons: Record<string, TMap> = tableMap.json;
        let planID = 0;
        for (const key in mapJsons) {
            if (mapJsons[key].id == id) {
                const ids = mapJsons[key]["randomID"].split(',');
                planID = Number(ids[Math.floor(Math.random() * ids.length)]);
                break;
            }
        }
        if (0 == planID) {
            return new TPlan();

        }
        const tablePlan = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Tables/json/tbplan", cc.JsonAsset) as cc.JsonAsset;
        const planJsons: Record<string, TPlan> = tablePlan.json;
        let plan = {
            id: 0,
            tileTypes: 0,
            block1: 0,
            block2: 0,
            block3: 0,
            block4: 0,
            block5: 0,
            block6: 0,
            block7: 0,
            block8: 0,
            fleshRate1: 0,
            fleshRate2: 0,
            tile_types: 0,
            flesh_rate1: 0,
            flesh_rate2: 0,
            linkCount: 0,
        };
        for (const key in planJsons) {
            if (planJsons[key]["id"] == planID) {
                plan = planJsons[key];
                break;
            }
        }
        if (null == plan) {
            return new TPlan();
        }

        return plan;
    }

    public async onLoadMap(map: MapData) {
        util.Log("onLoadMap", GameManager.getInstance().planMap);
        this.logSocketSnapshot(map);

        let plan: TPlan = GameManager.getInstance().planMap
        if (SeverIPs.Local == HttpManager.address) {
            util.Log("服务器方案", plan);
            plan = await this.onLoadPlan(map["id"]);
            plan["tile_types"] = plan["tileTypes"];
            plan["flesh_rate1"] = plan["fleshRate1"];
            plan["flesh_rate2"] = plan["fleshRate2"];
            GameManager.getInstance().linkCount = plan["linkCount"];
            util.Log("读取本地方案", plan);
        }
        const mapItems: Block[] = [];
        const greenGrass: Block[] = [];//藤曼和暗牌
        const randomIDs = this.getRandomIDs(plan["tile_types"]);
        const idRandMap: Record<number, number> = {};
        for (const v of map["items"]) {
            const item: Block = v;
            if (item["type"] == BlockIDs.Green || item["type"] == BlockIDs.Grass) {
                greenGrass.push(item);
            }
            else {
                if (item["type"] == BlockIDs.Random1) {
                    item["id"] = randomIDs[0];
                    idRandMap[item["id"]] = 1;
                }
                else if (item["type"] == BlockIDs.Random2) {
                    item["id"] = randomIDs[1];
                    idRandMap[item["id"]] = 1;
                }
                else if (item["type"] == BlockIDs.Random3) {
                    item["id"] = randomIDs[2];
                    idRandMap[item["id"]] = 1;
                }
                else if (item["type"] == BlockIDs.Random4) {
                    item["id"] = randomIDs[3];
                    idRandMap[item["id"]] = 1;
                }
                else if (item["type"] == BlockIDs.Rocket) {
                    item["id"] = BlockIDs.RK;
                    if (map.rocketState == 1) {
                        //
                        let count = 100;
                        do {
                            const x = Math.floor(Math.random() * map.width);
                            const y = Math.floor(Math.random() * map.height);
                            count--;
                            let isSame = false;
                            for (const v of map["items"]) {

                                if (x == v["x"] && y == v["y"]) {
                                    isSame = true;
                                    break;
                                }
                            }

                            if (!isSame) {
                                item["x"] = x;
                                item["y"] = y;
                                break;
                            }
                        } while (count > 0);
                    }
                }
                else if (item["type"] == BlockIDs.Wooden && map["woodenState"] == 1) {

                    let count = 100;
                    do {
                        const x = Math.floor(Math.random() * map["width"]);

                        const y = Math.floor(Math.random() * map["height"]);

                        count--;
                        let isSame = false;
                        for (const v of map["items"]) {
                            if (x == v["x"] && y == v["y"]) {
                                isSame = true;
                                break;
                            }
                        }

                        if (!isSame) {
                            item["x"] = x;
                            item["y"] = y;
                            break;
                        }
                    } while (count > 0);
                }

                mapItems.push(item);
            }
        }
        //
        const grid = BlockManager.getInstance().generateGridV2({
            width: map["width"],
            height: map["height"],
            tileTypes: plan["tile_types"],     // 基础图块池子种类数
            presets: mapItems,
            linkCount: GameManager.getInstance().linkCount,
            scheme: [plan["block1"], plan["block2"], plan["block3"], plan["block4"], plan["block5"], plan["block6"], plan["block7"], plan["block8"]]
        });

        GameManager.getInstance().refreshRate1 = plan["flesh_rate1"] || 10;
        GameManager.getInstance().refreshRate2 = plan["flesh_rate2"] || 10;
        ShareManager.getInstance().setMapData(map);
        ShareManager.getInstance().setMapPlan(plan);

        let emptyCount = 0;
        let emptyType = 0;
        for (let i = 1; i <= 8; i++) {
            const key = `block${i}` as keyof TPlan;
            const blockPlan = plan[key];
            emptyCount += blockPlan * 2 * i;
            emptyType += blockPlan;
        }

        let randCount = 0;
        for (const v in idRandMap) {
            randCount++;
            util.Log("randCount=", randCount, v);
        }
        if (map["width"] * map["height"] != (mapItems.length + emptyCount)) {
            console.error("关卡" + map["id"] + ",方案错误:图块数量不对", map["width"] * map["height"], mapItems.length, emptyCount);
        }
        if ((randCount + emptyType) != plan["tile_types"]) {
            console.error("关卡" + map["id"] + ",方案错误:图块池子类型不对", randCount, emptyType, plan["tile_types"]);
        }

        util.Log("linkCount=${},refreshRate1=${},refreshRate2={}", map["linkCount"], GameManager.getInstance().refreshRate1, GameManager.getInstance().refreshRate2);

        const items: Block[] = [];
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                items.push({
                    type: 0,
                    id: grid[i][j],
                    x: i,
                    y: j,
                });
            }
        }

        for (const v of map["items"]) {
            const item = v;
            if (item.type > 0) {
                items[item["y"] * map["width"] + item["x"]].type = item["type"];
            }
        }

        const data: MapData = {
            "id": map["id"],
            "width": map["width"],
            "height": map["height"],
            "dirction": map["dirction"],
            "linkCount": GameManager.getInstance().linkCount,
            "woodenState": map["woodenState"] || 0,
            "rocketState": map["rocketState"] || 0,
            "items": items,
            "serverItems": [],
        }
        await this.preloadMap(data);
        this.loadMapAfter();
    }

    public async onShareMap(shareData: ShareMapData) {
        const data: MapData = {
            "id": shareData["data"]["id"],
            "width": shareData["data"]["width"],
            "height": shareData["data"]["height"],
            "dirction": shareData["data"]["dirction"] || 1,
            "linkCount": shareData["data"]["linkCount"] || 10,
            "woodenState": shareData["data"]["woodenState"] || 0,
            "rocketState": shareData["data"]["rocketState"] || 0,
            "items": shareData["data"]["items"],
            "serverItems": [],
        }
        GameManager.getInstance().linkCount = data["linkCount"];
        GameManager.getInstance().refreshRate1 = shareData["plan"]["fleshRate1"] || 10;
        GameManager.getInstance().refreshRate2 = shareData["plan"]["fleshRate2"] || 10;
        await this.preloadMap(data);
    }

    public async preloadMap(data: MapData): Promise<void> {
        //data.dirction = GameDirection.Rotate4;
        util.Log("preloadMap", data);

        MapManager.getInstance().dirction = data["dirction"];
        this.emitUI(UIEventName.UIGame_resetCollapse);

        const width = Number(data["width"]);

        const height = Number(data["height"]);
        MapManager.getInstance().mapWidth = width;
        MapManager.getInstance().mapHeight = height;

        MapManager.getInstance().mapTitles = [];
        for (let y = 0; y < MapHeight; y++) {
            const gameMap = GameManager.getInstance().gameBlock.getChildByName("map" + (y + 1));
            gameMap.removeAllChildren();
        }

        const titlePrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Direction/Title", cc.Prefab) as cc.Prefab;
        const curDir = MapManager.getInstance().dirction;
        //
        if (GameDirection.Down == curDir || GameDirection.Up == curDir
            || GameDirection.UpDown == curDir || GameDirection.DownUp == curDir) {
            for (let x = 0; x < width; x++) {
                const gameMap = GameManager.getInstance().gameBlock.getChildByName("map" + (width - x));
                for (let y = 0; y < height; y++) {
                    this.loadBlock({ x: x, y: y, gameMap: gameMap, titlePrefab: titlePrefab, width: width, height: height });
                }
            }
        }
        else {
            for (let y = 0; y < height; y++) {
                const gameMap = GameManager.getInstance().gameBlock.getChildByName("map" + (y + 1));
                for (let x = 0; x < width; x++) {
                    const blockNode = this.loadBlock({ x: x, y: y, gameMap: gameMap, titlePrefab: titlePrefab, width: width, height: height });
                    blockNode.setSiblingIndex(0);
                }
            }
        }
        //
        const items: Block[] = data["items"];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const item = MapManager.getInstance().mapTitles[y][x];
                const block = items[y * width + x];
                item.getComponent(GameBlock).setData(block);
                //
                if (block.id > 0 && block.id < BlockIDs.None) {
                    GameManager.getInstance().maxBlockCount++;

                    if (block.id == BlockIDs.RK) {
                        item.getChildByName("special").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(BlockIDs.Rocket + "");
                    }
                    else {
                        item.getChildByName("item").getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(block.id + "");
                    }
                }
                else if (block.id == BlockIDs.Green || block.id == BlockIDs.Grass) {
                    GameManager.getInstance().maxBlockCount++;
                }
            }
        }
        util.Log("maxBlockCount=", GameManager.getInstance().maxBlockCount);


    }

    private logSocketSnapshot(map: MapData) {
        const snapshot = GameManager.getInstance().socketSnapshot;
        if (!snapshot) {
            util.Log("[GameSocketSnapshot] empty, use HTTP map");
            return;
        }

        let outOfBounds = 0;
        for (const block of snapshot.blocks) {
            if (block.x < 0 || block.y < 0 || block.x >= snapshot.width || block.y >= snapshot.height) {
                outOfBounds++;
            }
        }

        const sameSize = snapshot.width == map.width && snapshot.height == map.height;
        util.Log("[GameSocketSnapshot] map init", {
            roomId: snapshot.roomId,
            stageId: snapshot.stageId,
            snapshotSize: `${snapshot.width}x${snapshot.height}`,
            httpMapSize: `${map.width}x${map.height}`,
            sameSize,
            dirction: snapshot.dirction,
            blocks: snapshot.blocks.length,
            outOfBounds,
        });

        if (!sameSize) {
            console.warn("[GameSocketSnapshot] size mismatch, keep using HTTP map", snapshot.width, snapshot.height, map.width, map.height);
        }
        if (outOfBounds > 0) {
            console.warn("[GameSocketSnapshot] blocks out of bounds, keep using HTTP map", outOfBounds);
        }
    }

    public loadMapAfter() {
        if (GameManager.getInstance().gameType == GameType.Share) {
            this.shareWork();
        }
        else if (1 == PlayerManager.getInstance().getMapID()) {
            return;
        }
        else {
            if (2 == PlayerManager.getInstance().getMapID() && GameManager.getInstance().isPlayUp) {
                this.upAction();
                GameManager.getInstance().gameBlock.active = false;
                cc.tween(this.node)
                    .delay(1.0)
                    .call(() => {
                        GameManager.getInstance().gameBlock.active = true;
                        this.normalWork();
                    })
                    .start();
            }
            else {
                this.normalWork();
            }
        }
    }

    private normalWork() {
        this.directionAction.doAction();

        if (GameDirection.None == MapManager.getInstance().dirction) {
            if (!FirstTip[PlayerManager.getInstance().getMapID()]) {
                this.scheduleOnce(() => {
                    this.blinkAction();
                }, 2);
                return;
            }
        }
        const startRoot = this.node.getChildByName("startAction");
        const rotatePath2 = startRoot.getChildByName("rotatePath2");
        rotatePath2.active = MapManager.getInstance().dirction == GameDirection.Rotate;
        const rotatePath1 = startRoot.getChildByName("rotatePath1");
        rotatePath1.active = MapManager.getInstance().dirction == GameDirection.DoubleRotate;
        const rotatePath3 = startRoot.getChildByName("rotatePath3");
        rotatePath3.active = MapManager.getInstance().dirction == GameDirection.Rotate3;
        const rotatePath4 = startRoot.getChildByName("rotatePath4");
        rotatePath4.active = MapManager.getInstance().dirction == GameDirection.Rotate4;
        this.scheduleOnce(() => {
            this.loadDir();
        }, 2);
    }

    async loadDir() {
        const dirPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Direction/dir" + MapManager.getInstance().dirction, cc.Prefab) as cc.Prefab;
        const startRoot = this.node.getChildByName("startAction");
        const dirRoot = this.node.getChildByName("top").getChildByName("dirRoot");
        dirRoot.removeAllChildren();
        dirRoot.active = true;
        const dirStart = startRoot.getChildByName("dirRoot");
        dirStart.removeAllChildren();
        const dirNode = cc.instantiate(dirPrefab);
        dirNode.setParent(dirRoot);
        dirNode.setScale(1);

        const dirNode2 = cc.instantiate(dirPrefab);
        dirNode2.setParent(dirStart);
        dirNode2.setScale(1);

        if (FirstTip[PlayerManager.getInstance().getMapID()]) {
            const dirRoot2 = this.node.getChildByName("top").getChildByName("dirRoot2");
            dirRoot2.removeAllChildren();
            dirRoot2.active = true;
            const firstPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "First/first" + PlayerManager.getInstance().getMapID(), cc.Prefab) as cc.Prefab;
            const firstNode = cc.instantiate(firstPrefab);
            firstNode.setParent(dirRoot2);
            firstNode.setScale(1);

            const firstNode2 = cc.instantiate(firstPrefab);
            firstNode2.setParent(dirStart);
            firstNode2.setScale(1);
            this.startAction({ dirNode: dirNode, dirNode2: dirNode2, firstNode: firstNode, firstNode2: firstNode2 });
        }
        else {
            this.startAction({ dirNode: dirNode, dirNode2: dirNode2, firstNode: undefined, firstNode2: undefined });
        }

        if (ShareManager.getInstance().shareID == PlayerManager.getInstance().role_id) {
            HttpManager.Instance.request<MapPlayRewardResponse, MapPlayRewardRequest>({ msgId: NetRequestCode.MapPlayReward, param: { "id": PlayerManager.getInstance().role_id } },
                this._onMapPlayRewardSuccess.bind(this),
                this._onMapPlayRewardFailed.bind(this));
        }
    }

    private async shareWork() {
        const dirPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Direction/dir" + MapManager.getInstance().dirction, cc.Prefab) as cc.Prefab;
        const topRoot = this.node.getChildByName("top");
        const dirRoot = topRoot.getChildByName("dirRoot");
        const dirRoot2 = topRoot.getChildByName("dirRoot2");
        dirRoot.active = false;
        dirRoot2.active = false;
        dirRoot.removeAllChildren();

        const dirNode = cc.instantiate(dirPrefab);
        dirNode.setParent(dirRoot);
        dirNode.setScale(0.5);

        this.scheduleOnce(() => {
            this.blinkAction();
        }, 2);

        cc.tween(this.node)
            .delay(2.3)
            .call(() => {
                this.shareAction();
            })
            .start();

        this.directionAction.doAction();
    }

    private blinkAction() {
        const mapTitles = MapManager.getInstance().mapTitles;
        for (const row of mapTitles) {
            for (const item of row) {
                cc.tween(item.getChildByName("item"))
                    .to(0.15, { scale: 1.3 })
                    .to(0.15, { scale: 1 })
                    .start();
            }
        }
    }

    private loadBlock(data: { x: number, y: number, gameMap: cc.Node, titlePrefab: cc.Prefab, width: number, height: number }) {
        const x = data.x;
        const y = data.y;
        const gameMap = data.gameMap;
        const titlePrefab = data.titlePrefab;
        const width = data.width;
        const height = data.height;

        const blockNode = cc.instantiate(titlePrefab);
        blockNode.setParent(gameMap);
        blockNode.setPosition(x * TitleSize + 30 - width / 2 * TitleSize, -y * TitleSize - 30 + height / 2 * TitleSize);
        blockNode.addComponent(GameBlock);
        if (!MapManager.getInstance().mapTitles[y]) {
            MapManager.getInstance().mapTitles[y] = [];
        }
        MapManager.getInstance().mapTitles[y][x] = blockNode;

        return blockNode;
    }

    public async upAction() {
        const upNode = this.node.getChildByName("upAction");
        upNode.active = true;
        const ani = upNode.getChildByName("ani");
        const FX_nanduupPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_nanduup, cc.Prefab) as cc.Prefab;
        const FX_nanduupNode = cc.instantiate(FX_nanduupPrefab);
        FX_nanduupNode.setParent(ani);
        FX_nanduupNode.setPosition(0, 0);
        FX_nanduupNode.getComponent(cc.Animation).play("nanduup");
        FX_nanduupNode.getComponent(cc.Animation).on("finished", () => {
            upNode.active = false;
        }, this);

        cc.tween(upNode)
            .delay(1.2)
            .call(() => {
                upNode.active = false;
            })
            .start();
    }

    private startAction(data: { dirNode: cc.Node, dirNode2: cc.Node, firstNode?: cc.Node, firstNode2?: cc.Node }) {
        const startRoot = this.node.getChildByName("startAction");
        let diffX = -100;
        if (!data.firstNode) {
            diffX = 0;
        }
        const startTip = startRoot.getChildByName("tip");
        const startTip2 = startRoot.getChildByName("tip2");
        const addTip = startTip2.getChildByName("add");
        startRoot.active = true;
        startTip.active = true;
        startTip2.active = false;
        startTip.getComponent(cc.Label).string = DirectionTip[MapManager.getInstance().dirction];

        const worldPos = startTip.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const pos = data.dirNode.parent.convertToNodeSpaceAR(worldPos);
        data.dirNode.setPosition(pos.x + diffX, pos.y + 100);

        cc.tween(data.dirNode)
            .to(0.12, { angle: 15 })
            .to(0.12, { angle: -15 })
            .to(0.12, { angle: 10 })
            .to(0.12, { angle: 0 })
            .call(() => {
                addTip.active = false;
            })
            .to(0.3, { position: cc.v3(0, 0, 0), scale: 0.5 })
            .start()

        cc.tween(this.node)
            .delay(3)
            .call(() => {
                this.node.getChildByName("startAction").active = false;
                this.emitUI(UIEventName.UIGame_touchStart);
            })
            .start()
        //
        const pos2 = data.dirNode2.parent.convertToNodeSpaceAR(worldPos);
        data.dirNode2.setPosition(pos2.x + diffX, pos2.y + 100);

        const topRoot = this.node.getChildByName("top");
        const dirRoot = topRoot.getChildByName("dirRoot");

        const dirRootWrold = dirRoot.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const dirRootPos = data.dirNode2.parent.convertToNodeSpaceAR(dirRootWrold);
        cc.tween(data.dirNode2)
            .to(0.12, { angle: 15 })
            .to(0.12, { angle: -15 })
            .to(0.12, { angle: 10 })
            .to(0.12, { angle: 0 })
            .to(0.3, { position: cc.v3(dirRootPos.x, dirRootPos.y, 0), scale: 0.5 })
            .start()
        //
        if (!data.firstNode || !data.firstNode2) {
            return;
        }

        startTip2.active = true;
        startTip2.getComponent(cc.Label).string = FirstTip[PlayerManager.getInstance().getMapID()];

        const pos3 = data.firstNode.parent.convertToNodeSpaceAR(worldPos);
        data.firstNode.setPosition(pos3.x + 100, pos3.y + 100);

        cc.tween(data.firstNode)
            .to(0.12, { angle: 15 })
            .to(0.12, { angle: -15 })
            .to(0.12, { angle: 10 })
            .to(0.12, { angle: 0 })
            .to(0.3, { position: cc.v3(0, 0, 0), scale: 0.5 })
            .start()
        //
        const pos4 = data.firstNode2.parent.convertToNodeSpaceAR(worldPos);
        data.firstNode2.setPosition(pos4.x + 100, pos4.y + 100);

        const dirRoot2 = this.node.getChildByName("top").getChildByName("dirRoot2");
        if (GameDirection.None == MapManager.getInstance().dirction) {
            startTip2.getChildByName("add").active = false;
            dirRoot2.setPosition(cc.v2(124, 620))

            data.firstNode.setPosition(pos3.x - 225, pos3.y + 100);
            data.firstNode2.setPosition(pos4.x - 0, pos4.y + 100);

            startTip2.active = false;
            startTip.getComponent(cc.Label).string = FirstTip[PlayerManager.getInstance().getMapID()];
        }

        const dirRoot2Wrold = dirRoot2.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const dirRoot2Pos = data.firstNode2.parent.convertToNodeSpaceAR(dirRoot2Wrold);
        cc.tween(data.firstNode2)
            .to(0.12, { angle: 15 })
            .to(0.12, { angle: -15 })
            .to(0.12, { angle: 10 })
            .to(0.12, { angle: 0 })
            .to(0.3, { position: cc.v3(dirRoot2Pos.x, dirRoot2Pos.y, 0), scale: 0.5 })
            .start();
    }

    private shareAction() {
        this.emitUI(UIEventName.UIGame_touchStart);
        const shareAction = this.node.getChildByName("shareAction");
        shareAction.active = true;

        shareAction.setScale(0.1);
        cc.tween(shareAction)
            .to(0.2, { scale: 1.2 })
            .to(0.1, { scale: 1.0 })
            .delay(4)
            .call(() => {
                shareAction.active = false;
            })
            .start();

        const shouzhi = shareAction.getChildByName("shouzhi");
        const shouzhiPosX = shouzhi.position.x;
        const shouzhiPosY = shouzhi.position.y;
        cc.tween(shouzhi)
            .repeat(3,
                cc.tween()
                    .delay(0.5)
                    .to(0.1, { opacity: 255 })
                    .by(1, { position: cc.v3(500, 0, 0) })
                    .delay(0.2)
                    .to(0.1, { opacity: 0 })
                    .call(() => {
                        shouzhi.setPosition(cc.v3(shouzhiPosX, shouzhiPosY, 0));
                    })
            )
            .start();
    }

    _onMapPlayRewardSuccess(res: MapPlayRewardResponse) {
        util.Log("MapPlayRewardSuccess", res);
        const add = res["friend_items"] - PlayerManager.getInstance().friend_items;
        PlayerManager.getInstance().friends = res["friends"];
        PlayerManager.getInstance().friend_items = res["friend_items"];
        ShareManager.getInstance().shareID = 0;
        const names = res["friend_name"];

        this.emitUI(UIControllerName.UIController_uiShareReward, { names: names, add: add });
    }
    _onMapPlayRewardFailed(res: ErrorResponse) {
        util.Log("MapPlayRewardFailed", res);
    }
}
