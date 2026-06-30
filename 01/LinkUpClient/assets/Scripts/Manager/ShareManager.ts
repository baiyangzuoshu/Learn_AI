import { EventManager } from "../../FrameWork/manager/EventManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { util } from "../../FrameWork/Utils/util";
import { GameType, UIControllerName } from "../Constant";
import { unpackToOriginal } from "../Game/Pack";
import { Block, MapData, Pos, ShareMapData, TPlan } from "../types";
import PlayerManager from "./PlayerManager";

export default class ShareManager {
    public static instance: ShareManager;
    public static getInstance(): ShareManager {
        if (ShareManager.instance == null) {
            ShareManager.instance = new ShareManager();
        }
        return ShareManager.instance;
    }
    private mapData: ShareMapData = new ShareMapData();
    public shareID = 0;
    public shareClickPos: Pos[] = [];
    public useBag = false;

    public reset() {
        this.shareID = 0;
        this.shareClickPos = [];
        this.useBag = false;
    }

    public getRoleID() {
        return this.mapData["role_id"];
    }
    public getMapID() {
        return this.mapData["data"]["id"];
    }

    public getName() {
        return this.mapData["name"];
    }

    public getMapData() {
        return this.mapData;
    }

    parseExtraStr() {
        try {
            console.warn("extraStr", PlayerManager.getInstance().extraStr);
            const orig = unpackToOriginal(PlayerManager.getInstance().extraStr);
            console.warn("解压数据:", JSON.stringify(orig));
            if (Number(orig["role_id"]) == PlayerManager.getInstance().role_id) {
                console.warn("自己分享自己", orig["role_id"], PlayerManager.getInstance().role_id);
                EventManager.getInstance().emit(UIControllerName.UIController_uiMain);
                return;
            }
            const data: ShareMapData = {
                "role_id": Number(orig["role_id"]),
                "name": orig["name"],
                "data": {
                    "id": orig["data"]["id"],
                    "width": orig["data"]["width"],
                    "height": orig["data"]["height"],
                    "dirction": orig["data"]["dirction"],
                    "linkCount": orig["data"]["linkCount"],
                    "woodenState": orig["data"]["woodenState"],
                    "rocketState": orig["data"]["rocketState"],
                    "items": [],
                    "serverItems": [],
                },
                "plan": {
                    "block1": orig["plan"]["block1"],
                    "block2": orig["plan"]["block2"],
                    "block3": orig["plan"]["block3"],
                    "block4": orig["plan"]["block4"],
                    "block5": orig["plan"]["block5"],
                    "block6": orig["plan"]["block6"],
                    "block7": orig["plan"]["block7"],
                    "block8": orig["plan"]["block8"],
                    "id": orig["plan"]["id"],
                    "tileTypes": orig["plan"]["tileTypes"],
                    "fleshRate1": orig["plan"]["fleshRate1"],
                    "fleshRate2": orig["plan"]["fleshRate2"],
                    "tile_types": orig["plan"]["tile_types"],
                    "flesh_rate1": orig["plan"]["flesh_rate1"],
                    "flesh_rate2": orig["plan"]["flesh_rate2"],
                    "linkCount": orig["plan"]["linkCount"],
                }
            }

            for (const d of orig["data"]["serverItems"]) {
                data["data"]["serverItems"].push([d[0], d[1], d[2], d[3]]);
            }
            ShareManager.getInstance().resetMapData(data);

            UIManager.Instance.removeAllUI();
            EventManager.getInstance().emit(UIControllerName.UIController_uiGame, { gameType: GameType.Share });
        } catch (error) {
            util.Log("extraStr unpackToOriginal error", error);
            EventManager.getInstance().emit(UIControllerName.UIController_uiMain);
            return;
        }
    }

    public resetMapData(data: ShareMapData) {
        util.Log("resetMapData", data);
        util.Log("resetMapData", data["data"]);
        util.Log("resetMapData", data["plan"]);

        this.mapData = new ShareMapData();
        this.mapData["role_id"] = data["role_id"];
        this.mapData["name"] = data["name"];
        this.mapData["data"] = {} as MapData;
        this.mapData["plan"] = {} as TPlan;
        this.setMapData(data["data"]);
        this.setMapPlan(data["plan"]);

        this.mapData["data"]["items"] = [];
        for (const d of data["data"]["serverItems"]) {
            const item = new Block();
            item.id = d[0];
            item.x = d[1];
            item.y = d[2];
            item.type = d[3];
            this.mapData["data"]["items"].push(item);
        }
    }

    public setMapData(map: MapData) {
        util.Log("setMapData", map);
        this.mapData["data"]["id"] = map["id"];
        this.mapData["data"]["width"] = map["width"];
        this.mapData["data"]["height"] = map["height"];
        this.mapData["data"]["dirction"] = map["dirction"];
        this.mapData["data"]["linkCount"] = map["linkCount"];
        this.mapData["data"]["woodenState"] = map["woodenState"];
        this.mapData["data"]["rocketState"] = map["rocketState"];
    }

    public setMapPlan(plan: TPlan) {
        util.Log("setMapPlan", plan);
        console.log("this.mapData['plan']", this.mapData["plan"], plan);
        this.mapData["plan"] = {} as TPlan;
        this.mapData["plan"]["id"] = plan["id"];
        this.mapData["plan"]["tileTypes"] = plan["tileTypes"];
        this.mapData["plan"]["fleshRate1"] = plan["fleshRate1"];
        this.mapData["plan"]["fleshRate2"] = plan["fleshRate2"];
        this.mapData["plan"]["tile_types"] = plan["tile_types"];
        this.mapData["plan"]["flesh_rate1"] = plan["flesh_rate1"];
        this.mapData["plan"]["flesh_rate2"] = plan["flesh_rate2"];
        this.mapData["plan"]["block1"] = plan["block1"];
        this.mapData["plan"]["block2"] = plan["block2"];
        this.mapData["plan"]["block3"] = plan["block3"];
        this.mapData["plan"]["block4"] = plan["block4"];
        this.mapData["plan"]["block5"] = plan["block5"];
        this.mapData["plan"]["block6"] = plan["block6"];
        this.mapData["plan"]["block7"] = plan["block7"];
        this.mapData["plan"]["block8"] = plan["block8"];
    }

    public generateMap(role_id: number, name: string, items: Block[]) {
        this.mapData["role_id"] = role_id;
        this.mapData["name"] = name;
        this.mapData["data"]["items"] = [];
        this.mapData["data"]["serverItems"] = [];

        for (const item of items) {
            this.mapData["data"]["items"].push(item);
            this.mapData["data"]["serverItems"].push([item.id, item.x, item.y, item.type]);
        }

        return this.mapData;
    }
}
