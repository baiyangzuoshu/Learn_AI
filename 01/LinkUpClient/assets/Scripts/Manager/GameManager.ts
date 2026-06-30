import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { util } from "../../FrameWork/Utils/util";
import { GameState, GameType, NetRequestCode, SDKState } from "../Constant";
import GameAction from "../Game/GameAction";
import type { GameSocketSnapshot } from "../GameSocketService";
import { LinePath } from "../Game/LinePath";
import SDKAdapter from "../SDKAdapter";
import type { PlayResponse, ReportRequest, ReportResponse } from "../types";
import { MapData, ReportLog, ReportLogNew, TPlan } from "../types";

export default class GameManager {
    public state: number = GameState.None;
    public sdkState: number = SDKState.None;
    public time = 0;
    public canAd = 0;

    public report: ReportLog = new ReportLog();
    public reportNew: ReportLogNew = new ReportLogNew();
    public maxMapID = 200;
    public gameMD5Time = 0;
    public gameADCount = 0;
    public reportADCount = 0;
    public gameADMax = 60;
    public bagAwaitTime = 0;
    public bagTipTime = -99999;
    public bagTipCount = 0;
    public dayMax = 0;

    public diamondCount = 0;//纪录充值前的钻石


    public linePath = new LinePath();
    public reshuffleCount = 0;
    public gameBlock = new cc.Node;
    public gameMap = new MapData();
    public planMap = new TPlan();
    public linkCount = 0;
    public refreshRate1 = 0;
    public refreshRate2 = 0;
    public clickLinkUp = 0;
    public clickLinkUpTime = 0;
    public curBlockCount = 0;
    public maxBlockCount = 0;
    public newGuideStep = 0;
    public openShareTime = 0;
    public gameAction = new GameAction();
    public gameType = GameType.Normal;
    public isPlayUp = false;
    public isWin = false;
    public checkTime = 0;
    public onlyRefresh = false;
    public stopSound = false;
    public isFirstCreate = true;
    public linkUpErrorCount = [0, 0, 0];
    public linkUpErrorDouble = [0, 0, 0];
    public isPoint = false;
    public isMove = false;
    public stage_time = 0;
    public socketSnapshot: GameSocketSnapshot | null = null;

    private static instance: GameManager;

    public static getInstance() {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    reset() {
        this.time = 0;
        this.clickLinkUp = 0;
        this.reshuffleCount = 0;
        this.curBlockCount = 0;
        this.maxBlockCount = 0;
        this.bagTipTime = -99999;
        this.newGuideStep = 0;
        this.openShareTime = 0;
        this.bagTipCount = 0;
        this.checkTime = -99999;
        this.linkUpErrorCount = [0, 0, 0];
        this.linkUpErrorDouble = [0, 0, 0];
        this.isFirstCreate = true;
        this.state = GameState.None;
        this.sdkState = SDKState.None;
        this.isPoint = false;
        this.isMove = false;
        this.report = new ReportLog();
        this.reportNew = new ReportLogNew();
    }

    HLDDZ_vibrateShort() {
        if (SoundManager.Instance.GetShakeMute()) {
            SDKAdapter.getInstance().HLDDZ_vibrateShort();
        }
    }

    playSoundBlock(soundName: string) {
        console.log("playSoundBlock", soundName, this.stopSound);
        if (this.stopSound) return;
        cc.tween(this.gameBlock).delay(0.1).call(() => {
            SoundManager.Instance.PlaySound(soundName);
        }).start();
    }

    setDataMap(response: PlayResponse) {
        const plan: TPlan = response["plan"];
        util.Log("plan=", plan);
        GameManager.getInstance().planMap = {} as TPlan;
        GameManager.getInstance().planMap["block1"] = plan["block1"];
        GameManager.getInstance().planMap["block2"] = plan["block2"];
        GameManager.getInstance().planMap["block3"] = plan["block3"];
        GameManager.getInstance().planMap["block4"] = plan["block4"];
        GameManager.getInstance().planMap["block5"] = plan["block5"];
        GameManager.getInstance().planMap["block6"] = plan["block6"] || 0;
        GameManager.getInstance().planMap["block7"] = plan["block7"] || 0;
        GameManager.getInstance().planMap["block8"] = plan["block8"] || 0;
        GameManager.getInstance().planMap["id"] = plan["id"];
        GameManager.getInstance().planMap["tile_types"] = plan["tile_types"];
        GameManager.getInstance().planMap["tileTypes"] = plan["tile_types"];
        GameManager.getInstance().planMap["flesh_rate1"] = plan["flesh_rate1"];
        GameManager.getInstance().planMap["fleshRate1"] = plan["flesh_rate1"];
        GameManager.getInstance().planMap["flesh_rate2"] = plan["flesh_rate2"];
        GameManager.getInstance().planMap["fleshRate2"] = plan["flesh_rate2"];
        util.Log("GameManager.getInstance().planMap=", GameManager.getInstance().planMap);

        GameManager.getInstance().gameMD5Time = response["end_time"];
        GameManager.getInstance().linkCount = response["link_count"];
        GameManager.getInstance().gameADCount = response["ad_count"];
        GameManager.getInstance().gameADMax = response["ad_max"];
        GameManager.getInstance().dayMax = response["day_max"];
        if (response["map"] != "") {
            const map = JSON.parse(response["map"]);
            util.Log("map=", map);
            GameManager.getInstance().gameMap = map;
        }
    }

    public isCardAD(): number {
        if (this.gameADCount >= this.gameADMax) {
            return 0;
        }

        return 0;
    }

    public isCanAD(): number {
        if (this.gameADCount >= this.gameADMax) {
            return 0;
        }

        return this.canAd;
    }
    //
    //
    gameResultReport() {
        const log = GameManager.getInstance().report;
        //
        const logNew = GameManager.getInstance().reportNew;

        logNew.mapID = log.mapID;//关卡号
        logNew.shareReward = log.shareCount;//本关分享成功获得奖励数
        logNew.trueShareCount = 0;//本关真分享数（通过真分享返回获得奖励）
        logNew.adReward = log.adCount;//本关看广告成功获得奖励数
        logNew.adOpen = log.adOpen;//本关打开广告弹窗数（无论是否获得广告奖励）
        logNew.shareOpen = log.shareOpen;//本关打开 分享弹窗数（无论是否分享成功）
        logNew.diamond = log.diamond;//本关消耗钻石数
        logNew.time = log.time;//本关玩家耗时数
        logNew.refresh = log.refresh;//刷新
        logNew.clean = log.clean;//消除
        logNew.match = log.match;//匹配
        // 本局只用了 点击消除 =1，本局只用了 滑动消除 =2，本局既用了点击消除，也用了滑动消除=3
        util.Log("this.isPoint,this.isMove", this.isPoint, this.isMove);
        if (this.isPoint && this.isMove) {
            logNew.Resulte1 = 3;
        }
        else if (this.isPoint) {
            logNew.Resulte1 = 1;
        }
        else if (this.isMove) {
            logNew.Resulte1 = 2;
        }

        const dataNew = "" + logNew.mapID + "," + logNew.pass + "," + logNew.shareReward + "," + logNew.trueShareCount
            + "," + logNew.adReward + "," + logNew.trueAdCount + "," + logNew.adOpen + "," + logNew.shareOpen
            + "," + logNew.diamond + "," + logNew.time + "," + logNew.match + "," + logNew.refresh + "," + logNew.clean
            + "," + logNew.Resulte1;

        util.Log("dataNew=", dataNew);
        const params2: ReportRequest = {
            "data": dataNew,
            "type": 7,
        }

        HttpManager.Instance.request<ReportResponse, ReportRequest>({
            msgId: NetRequestCode.Report,
            param: params2
        }, (responseData: ReportResponse) => {
            util.Log("s", responseData);
        }, () => {
            util.Log("s");
        });
    }
    //
    viewableAdCb() {
        GameManager.getInstance().state = GameState.Start;
        GameManager.getInstance().sdkState = SDKState.None;
    }
    //
    update(dt: number) {
        if (GameState.Start == this.state) {
            if (SDKState.None == GameManager.getInstance().sdkState) {
                this.bagAwaitTime -= dt;
                this.bagTipTime += dt;

                this.clickLinkUpTime -= dt;
                this.time += dt;
                if (this.clickLinkUpTime <= 0) {
                    this.clickLinkUp = 0;
                }
            }
        }
    }
}
