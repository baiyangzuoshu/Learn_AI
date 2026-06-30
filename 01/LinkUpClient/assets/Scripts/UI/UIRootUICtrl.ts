
import { default as CCMiniConsole } from "../../FrameWork/Lib/CCMiniConsole";
import { EventManager } from "../../FrameWork/manager/EventManager";
import HttpManager from "../../FrameWork/manager/HttpManager";
import LoadRemoteManager from "../../FrameWork/manager/LoadRemoteManager";
import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";

import { BundleName, GameType, MusicID, NetRequestCode, NetType, SeverIPs, UIControllerName, UIEventName } from "../Constant";
import DataManager from "../Manager/DataManager";
import GameControl from "../Manager/GameControl";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import SpriteAtlasManager from "../Manager/SpriteAtlasManager";
import UIController from "../Manager/UIController";
import SDKAdapter from "../SDKAdapter";
import NetManager from "../NetManager";
import GameSocketService from "../GameSocketService";
import type { ErrorResponse, LoginRequest, LoginResponse, PlayResponse, PlayTestRequest, ReportRequest, ReportResponse, StageRequest, StageResponse, VipRequest, VipResponse } from "../types";
import { UILoginUICtrl } from "./UILoginUICtrl";

export default class UIRootUICtrl extends UIComponent {
    sdkState = false;
    resState = false;
    isBack = false;
    preTime = 0;
    percentLabel!: cc.Node; // 百分比显示标签
    progressBar!: cc.Node; // 进度条
    loading!: cc.Node; // 加载提示标签

    vConsole!: CCMiniConsole;

    private totalAsset = 0; // 资源包总数
    private curAsset = 0; // 当前已加载的资源包数
    private totalRes = 0; // 资源总数
    private curRes = 0; // 当前已加载的资源数
    private endCb!: () => void;; // 加载完成后的回调函数
    private processCb!: (cur: number, total: number) => void; // 加载过程中的回调函数
    private bundles: Record<string, cc.AssetManager.Bundle> = {}; // 已加载的资源包
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            //this.adaptUI();
        }
        this.loadComponent();
        // WebSocket 长连接（异步启动，不阻塞初始化）
        NetManager.Instance.connect().then(() => {
            console.log("[NetManager] connected to server");
        }).catch((err: Error) => {
            console.warn("[NetManager] connection failed, will retry:", err.message);
        });
        this.loadSDK();

        this.percentLabel = this.getChildByUrl("node/percent/num");
        this.progressBar = this.getChildByUrl("node/New ProgressBar");
        this.progressBar.getComponent(cc.ProgressBar).progress = 0; // 初始化进度条

        this.AddButtonListener("node/leftTop/exitButton", this.onexitButtonClick, this);
        this.AddButtonListener("node/rightTop/exitButton", this.onexitButtonClick, this);
        this.AddButtonListener("RootCanvas/vconsole", this.onvconsoleClick, this);


        this.addUIEventListener(UIEventName.UIRoot_getPlayerInfo, this.getPlayerInfo, this);
        this.addUIEventListener(UIEventName.UIRoot_doLogin, this.doLogin, this);

        const percentInfo = this.getChildByUrl("node/percent");

        cc.tween(percentInfo)
            .delay(1.5)
            .call(() => {
                this.randInfo();
            })
            .delay(1.5)
            .call(() => {
                this.randInfo();
            })
            .delay(1.5)
            .call(() => {
                this.randInfo();
            })
            .start();
    }

    randInfo() {
        if (this.isBack) return;

        const percentInfo = this.getChildByUrl("node/percent");

        const infos = ["使用刷新道具可以打乱所有方块", "使用消除道具可以消除一组方块", "找不到成对方块时试试提示道具", "滑动连接2个相同方块也可以消除哦", "连线转折不超过2次才能消除哦", "选择相同图案的2个方块才能消除哦", "炸弹方块消除后，还会额外消除一对方块"];
        const rand = Math.floor(Math.random() * infos.length);
        percentInfo.getComponent(cc.Label).string = infos[rand];
        const posX = percentInfo.position.x;
        const posY = percentInfo.position.y;
        percentInfo.getComponent(cc.Label).string = infos[rand];
        percentInfo.setPosition(cc.v3(posX, posY, 0));
        percentInfo.opacity = 255;
    }

    onvconsoleClick() {
        this.vConsole.show();
    }

    protected adaptPC() {
        this.node.scale = 1.0;
    }

    loadComponent() {
        this.node.addComponent(ResManager);
        this.node.addComponent(UIManager).Init(this.getChildByUrl("RootCanvas/MiddlePanel"));
        this.node.addComponent(MapManager);
        this.node.addComponent(GameControl);
        this.node.addComponent(SoundManager);
        this.node.addComponent(UIController);
        this.node.addComponent(MapManager);
        this.node.addComponent(SpriteAtlasManager);
        this.node.addComponent(DataManager);
    }

    loadSDK() {
        this.sdkState = false;
    }

    getPlayerInfo() {
        SDKAdapter.getInstance().HLDDZ_getPlayerProfile(async (data: number) => {
            util.Log("HLDDZ_getPlayerProfile state=", data);
            GameManager.getInstance().diamondCount = PlayerManager.getInstance().HLDDZ_user.diamondCount;

            SDKAdapter.getInstance().HLDDZ_queryViewableAdCount((data: number) => {
                GameManager.getInstance().canAd = data;
                util.Log("HLDDZ_queryViewableAdCount data=", data);
            });

            this.sdkState = true;
            if (this.sdkState && this.resState) {
                this.checkLogin();
            }
        });
    }

    onexitButtonClick() {
        this.isBack = true;
        EventManager.getInstance().clear();

        SoundManager.Instance.StopMainMusic();
        SDKAdapter.getInstance().HLDDZ_backTo();
    }

    async loadingOn() {
        this.loading = this.getChildByUrl("node/loading");
        this.loading.removeAllChildren();
        const nongminloding = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, "Art/prefab/nongminloding", cc.Prefab) as cc.Prefab;
        const node = cc.instantiate(nongminloding);
        node.setScale(0.5);
        node.parent = this.loading;
        node.getComponent(cc.Animation).play("loding");

        const FX_ldshandian = this.getChildByUrl("node/FX_ldshandian");
        const FX_ldshandianPrefab = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, "Art/prefab/FX_ldshandian", cc.Prefab) as cc.Prefab;
        const FX_ldshandianNode = cc.instantiate(FX_ldshandianPrefab);
        FX_ldshandianNode.parent = FX_ldshandian;
        FX_ldshandianNode.setPosition(cc.v2(0, 0));
        FX_ldshandianNode.getComponent(cc.Animation).play("ldsd");
    }

    async start() {
        /*
        this.getChildByUrl("RootCanvas/vconsole").active = true;
        const prefab = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, "GUI/UILog", cc.Prefab) as cc.Prefab;
        const n = cc.instantiate(prefab);
        this.node.addChild(n);
        this.vConsole = CCMiniConsole.attachTo(n);
        */

        this.resState = false;
        await this.loadingOn();

        // 初始化加载的资源包
        const pkg: string[] = [BundleName.BundleMain];
        this.parsePkg(pkg, (cur: number, total: number) => {
            this.updateProgress(cur, total); // 更新进度条
        }, async () => {
            this.resState = true;
            SDKAdapter.getInstance().HLDDZ_requestAuth((data: number) => {
                util.Log("HLDDZ_requestAuth state=", data);
                if (0 == data) {
                    this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "登录失败" });
                    return;
                }

                this.getPlayerInfo();
            });
        });

        cc.game.on(cc.game.EVENT_HIDE, this.onHide, this);
        cc.game.on(cc.game.EVENT_SHOW, this.onShow, this);
    }

    update(dt: number): void {
        GameManager.getInstance().update(dt);
    }

    onHide() {
        this.preTime = Date.now()
    }

    onShow() {
        SoundManager.Instance.ResumeMusic();
        console.warn("onShow");
        SDKAdapter.getInstance().HLDDZ_getExtraStr((data: string) => {
            console.warn("HLDDZ_getExtraStr data=", data);
            PlayerManager.getInstance().extraStr = data;
            if (PlayerManager.getInstance().extraStr && PlayerManager.getInstance().extraStr.length > 0) {
                ShareManager.getInstance().parseExtraStr();
            }
        });
    }

    onDestroy() {
        this.isBack = true;
        cc.game.off(cc.game.EVENT_HIDE, this.onHide, this);
        cc.game.off(cc.game.EVENT_SHOW, this.onShow, this);
    }

    async checkLogin() {
        SDKAdapter.getInstance().HLDDZ_rankonChallengeStart(DataManager.getInstance().rankonChallengeStart);

        await SpriteAtlasManager.getInstance().loadBlockSpriteAtlas();
        if (SDKAdapter.getInstance().isWebDev()) {
            this.getChildByUrl("node/leftTop/exitButton").active = false;
            this.getChildByUrl("node/rightTop/exitButton").active = false;

            const view = await UIManager.Instance.IE_ShowUIView("UILogin");
            if (!view) return;
            view.addComponent(UILoginUICtrl);
        }
        else {
            this.doLogin();
        }
    }

    doLogin() {
        // 生成签名并请求登录
        //const token = "token"//CryptoES.MD5(`匿名${splitList[1]}${splitList[0]}${splitList[2]}yueli2024`).toString();
        if (NetType.official == PlayerManager.getInstance().netType) {
            HttpManager.setAddress(SeverIPs.official);
            util.Log("外网：", SeverIPs.official);
        }
        else {
            HttpManager.setAddress(SeverIPs.Test);
            util.Log("内网", SeverIPs.Test);
        }

        const name = PlayerManager.getInstance().HLDDZ_user.userid;
        const music = SoundManager.Instance.GetMusicMute() ? 1 : 2;
        const sound = SoundManager.Instance.GetSoundMute() ? 1 : 2;
        const shake = SoundManager.Instance.GetShakeMute() ? 1 : 2;
        const report = "1-" + music + ";2-" + sound + ";3-" + shake;
        const params: LoginRequest = {
            "session": PlayerManager.getInstance().HLDDZ_user.sessionKey,
            "name": PlayerManager.getInstance().HLDDZ_user.nickName,
            "openid": name,
            "avatar": PlayerManager.getInstance().HLDDZ_user.avatarUrl,
            "report": report
        }
        GameSocketService.getInstance().login({
            session: params.session || "sdk-session",
            openid: params.openid,
            name: params.name,
            avatar: params.avatar || "",
        }).then((res) => {
            util.Log("[GameSocketService] login success", res);
        }).catch((err: Error) => {
            util.Log("[GameSocketService] login failed, continue HTTP login", err.message);
        });

        LoadRemoteManager.getInstance().loadImage(util.processUrl(PlayerManager.getInstance().HLDDZ_user.avatarUrl));
        HttpManager.Instance.request<LoginResponse, LoginRequest>({
            msgId: NetRequestCode.Login,
            param: params
        }, this._onLoginSuccess.bind(this), this._onLoginFailed.bind(this));
    }
    /**
     * 登录失败后的处理逻辑
     */
    private _onLoginFailed(): void {
        console.error('Login failed');
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "登录失败" });
    }
    /**
         * 登录成功后的处理逻辑
         */
    private async _onLoginSuccess(responseData: LoginResponse): Promise<void> {
        util.Log(responseData);
        HttpManager.token = responseData["token"];
        PlayerManager.getInstance().setRoleData(responseData);
        /*
        如果登录鉴权时，channelld =0或者为空(即:非买量用户)
        目 该用户的连连看当前停留关卡数=1(即连连看新玩家)
        则新增判断，继续看 登录鉴权的另一个字段(exp key_id ?待确认)里的分组ID信息:
        (1))分组1D=7257879(一股是AB分组信息，参考菜王的真分享AB实验)，则给该用户存标记C，使用难度C配置(数值就是使用现在买量
        用户的难度配置，需要扩展到100关)
        (2)如果分组ID=7257880(一般是AB分组信息，参考菜王的真分享AB实验)，则该用户无特殊标记，使用难度A配置。
        (3)如果分组ID=空(一般是AB分组信息，参考菜王的真分享AB实验)，则该用户无特殊标记，使用难度A配置。
        总结: 【无特殊标记】正常难度配置A，【标记B】买量用户难度配置B(可能会继续多次修改)，
        【标记C】斗地主实验组用户难度配置C。标记B
        和标记C的难度相同。
        */
        let level = 0;
        if (PlayerManager.getInstance().channelId) {
            level = 1;
        }
        else {
            if (PlayerManager.getInstance().expStrategies.includes(7257879)) {
                level = 2;
            }
        }
        HttpManager.Instance.request<VipResponse, VipRequest>({
            msgId: NetRequestCode.Vip,
            param: { "level": level }
        }, this._onVipSuccess.bind(this), this._onVipFailed.bind(this));
    }

    _onVipSuccess(res: VipResponse) {
        util.Log("_onVipSuccess", res);
        PlayerManager.getInstance().vipLevel = res["level"];
        //
        HttpManager.Instance.request<StageResponse, StageRequest>({
            msgId: NetRequestCode.Stage,
            param: { "pl": 1 }
        }, this._onStageSuccess.bind(this), this._onStageFailed.bind(this));
    }

    _onVipFailed(res: ErrorResponse) {
        util.Log("_onVipFailed", res);
        HttpManager.Instance.request<StageResponse, StageRequest>({
            msgId: NetRequestCode.Stage,
            param: { "pl": 1 }
        }, this._onStageSuccess.bind(this), this._onStageFailed.bind(this));
    }

    _onStageSuccess(res: StageResponse) {
        util.Log("StageSuccess", res);
        GameManager.getInstance().maxMapID = res["max_stage"];
        //
        SoundManager.Instance.PlayMusic(MusicID.main);
        //
        EventManager.getInstance().emit(UIEventName.UIRoot_Log, "extraStr:" + PlayerManager.getInstance().extraStr);

        if (PlayerManager.getInstance().extraStr && PlayerManager.getInstance().extraStr.length > 0) {
            ShareManager.getInstance().parseExtraStr();
        }
        else {
            if (1 == PlayerManager.getInstance().getMapID()) {
                const params: PlayTestRequest = {
                    "id": PlayerManager.getInstance().getMapID(),
                }
                let msgId = NetRequestCode.Play;
                if (PlayerManager.getInstance().vipLevel == 1) {
                    msgId = NetRequestCode.Playvip;
                }
                else if (PlayerManager.getInstance().vipLevel == 2) {
                    msgId = NetRequestCode.PlayC;
                }
                else if (SeverIPs.official == HttpManager.address) {
                    msgId = NetRequestCode.Play;
                }
                else {
                    msgId = NetRequestCode.PlayTest;
                }

                HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
                    msgId: msgId,
                    param: params
                }, this._onPlaySuccess.bind(this), this._onPlayFailed.bind(this));
            }
            else {

                this.emitUI(UIControllerName.UIController_uiMain);
            }

        }

        //
        const params: ReportRequest = {
            "data": "2",
            "type": 1,
        }

        HttpManager.Instance.request<ReportResponse, ReportRequest>({
            msgId: NetRequestCode.Report,
            param: params
        }, (responseData: ReportResponse) => {
            util.Log("s", responseData);
        }, () => {
            util.Log("s");
        });

    }

    _onStageFailed(res: ErrorResponse) {
        console.error("StageFailed", res);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });

        //
        HttpManager.Instance.request<StageResponse, StageRequest>({
            msgId: NetRequestCode.Stage,
            param: { "pl": 1 }
        }, this._onStageSuccess.bind(this), this._onStageFailed.bind(this));
    }

    async _onPlaySuccess(responseData: PlayResponse) {
        util.Log(responseData);

        GameManager.getInstance().setDataMap(responseData);

        this.emitUI(UIControllerName.UIController_uiGame, { gameType: GameType.Normal });
    }

    _onPlayFailed(err: unknown) {
        console.error("PlayFailed", err);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    parsePkg(pkg: string[], processCb: (cur: number, total: number) => void, endCb: () => void): void {
        this.endCb = endCb;
        this.processCb = processCb;
        this.totalAsset = pkg.length; // 设置资源包总数

        for (const abName of pkg) {
            this.loadAssetBundle(abName, (_, bundle) => {
                if (this.isBack) return;

                this.curAsset++;
                const infos = bundle.getDirWithPath("/", cc.Asset); // 获取资源包中的资源信息
                this.totalRes += infos.length; // 更新资源总数

                if (this.curAsset >= this.totalAsset) {
                    this.preloadAssetRes(pkg); // 预加载资源
                }
            });
        }
    }

    loadAssetBundle(abName: string, callback: (err: Error | null, bundle: cc.AssetManager.Bundle) => void): void {
        cc.assetManager.loadBundle(abName, (err, bundle) => {
            if (err) {
                console.error("loadAssetBundle error", err); // 加载资源包出错
                return;
            }
            this.bundles[abName] = bundle; // 保存加载成功的资源包
            callback(err, bundle);
        });
    }

    preloadAssetRes2(pkg: string[]): void {
        pkg.forEach(abName => {
            const bundle = this.bundles[abName];
            if (bundle) {
                const infos = bundle.getDirWithPath("/", cc.Asset); // 获取资源路径信息
                const urls = infos.map(info => info["path"]); // 提取资源路径
                this.loadAssetRes(abName, urls); // 加载资源
            }
        })
    }

    preloadAssetRes(pkg: string[]): void {
        const preloadDirs = ["Music", "Sound", "Art", "Block", "GUI", "Direction", "First"];
        // 重置资源计数
        this.curRes = 0;
        this.totalRes = 0;

        // 预统计所有要加载的资源数量
        pkg.forEach(abName => {
            const bundle = this.bundles[abName];
            if (bundle) {
                preloadDirs.forEach(dir => {
                    const assets = bundle.getDirWithPath(dir, cc.Asset);
                    this.totalRes += assets.length;
                });
            }
        });

        // 如果没有需要加载的资源，则直接调用回调
        if (this.totalRes === 0) {
            this.endCb();
            return;
        }

        // 遍历每个目录，开始加载
        pkg.forEach(abName => {
            const bundle = this.bundles[abName];
            if (bundle) {
                preloadDirs.forEach(dir => {
                    bundle.loadDir(dir, cc.Asset, (err, assets) => {
                        if (this.isBack) return;

                        if (err) {
                            console.error(`加载 ${dir} 目录资源出错:`, err);
                            return;
                        }
                        // 累加加载的资源数量
                        this.curRes += assets.length;
                        // 更新加载进度
                        this.processCb(this.curRes, this.totalRes);
                        // 如果加载完成，则调用结束回调
                        if (this.curRes === this.totalRes) {
                            this.endCb();
                        }
                    });
                });
            }
        });
    }

    loadAssetRes(abName: string, urls: string[]): void {
        const bundle = this.bundles[abName];
        urls.forEach(url => {
            bundle.load(url, (err) => {
                if (this.isBack) return;

                if (err) {
                    console.error(url, abName, "loadAssetRes error=", err); // 资源加载出错
                    return;
                }
                this.curRes++;

                this.processCb(this.curRes, this.totalRes); // 更新加载进度

                if (this.curRes === this.totalRes) {
                    this.endCb(); // 所有资源加载完成后调用回调函数
                }
            });
        });
    }

    updateProgress(cur: number, total: number): void {
        this.progressBar.getComponent(cc.ProgressBar).progress = cur / total; // 更新进度条进度
        this.percentLabel.getComponent(cc.Label).string = Math.floor((cur / total) * 100) + "%"; // 更新百分比显示

        this.loading.setPosition(cc.v3(-300 + Math.floor((cur / total) * 600), -336, 0));
    }
}
