
import { EventManager } from "../../FrameWork/manager/EventManager";
import HttpManager from "../../FrameWork/manager/HttpManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { GameType, MusicID, NetRequestCode, SeverIPs, SoundID, UIControllerName, UIEventName, UIName } from "../Constant";
import GameSocketService from "../GameSocketService";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import ShareManager from "../Manager/ShareManager";
import type { ErrorResponse, LoginRequest, LoginResponse, PlayResponse, PlayTestRequest, ReportRequest, ReportResponse, StageRequest, StageResponse, VipRequest, VipResponse } from "../types";

export class UILoginUICtrl extends UIComponent {

    private btnLogin!: cc.Button;
    private editbox_address!: cc.EditBox;
    private editbox_userName!: cc.EditBox;
    private toggles: cc.Node[] = [];

    onLoad(): void {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        // 初始化按钮和输入框的引用
        this.btnLogin = this.getChildByUrl("loginBtn").getComponent(cc.Button);
        this.editbox_address = this.getChildByUrl("address/New EditBox").getComponent(cc.EditBox);
        this.editbox_userName = this.getChildByUrl("user/New EditBox").getComponent(cc.EditBox);
        //
        this.editbox_address.string = SeverIPs.official;
        this.editbox_address.string = SeverIPs.Test;
        // 添加登录按钮的点击事件监听器
        this.AddButtonListener("loginBtn", this.clickLogin, this);

        //
        for (let i = 1; i <= 3; i++) {
            const toggleNode = this.getChildByUrl("New ToggleContainer/toggle" + i);
            this.toggles.push(toggleNode);

            toggleNode.on('toggle', this.toggleEvent, this);
        }
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    private toggleEvent(v: cc.Toggle) {
        if ("toggle1<Toggle>" == v.name) {
            this.editbox_address.string = SeverIPs.official;
        }
        else if ("toggle2<Toggle>" == v.name) {
            this.editbox_address.string = SeverIPs.Test;
        }
        else if ("toggle3<Toggle>" == v.name) {
            this.editbox_address.string = SeverIPs.Local;
        }
    }

    /**
     * 处理登录按钮点击事件
     */
    public clickLogin(): void {
        SoundManager.Instance.PlaySound(SoundID.point);
        if (this.btnLogin && !this.btnLogin.interactable) return;

        this._enableBtnLogin(false);
        this._startLogin();
    }

    /**
     * 启用或禁用登录按钮
     * @param enable - 是否启用
     */
    private _enableBtnLogin(enable: boolean): void {
        if (this.btnLogin) {
            this.btnLogin.interactable = enable;
        }

    }

    /**
     * 开始登录流程
     */
    private _startLogin(): void {
        if (!this.editbox_address || !this.editbox_userName) {
            return;
        }

        const address = this.editbox_address.string.trim();
        const name = this.editbox_userName.string.trim();
        if (!address) {
            util.Log('Address is empty');
            this._enableBtnLogin(true);
            return;
        }

        if (!name) {
            util.Log('Name is empty');
            this._enableBtnLogin(true);
            return;
        }

        this.netLogin(address, name);
    }

    netLogin(address: string, name: string) {
        // 生成签名并请求登录
        //const token = "token"//CryptoES.MD5(`匿名${splitList[1]}${splitList[0]}${splitList[2]}yueli2024`).toString();
        HttpManager.setAddress(address);
        const music = SoundManager.Instance.GetMusicMute() ? 1 : 2;
        const sound = SoundManager.Instance.GetSoundMute() ? 1 : 2;
        const shake = SoundManager.Instance.GetShakeMute() ? 1 : 2;
        const report = "1-" + music + ";2-" + sound + ";3-" + shake;
        PlayerManager.getInstance().HLDDZ_user.nickName = name;
        const socketLoginData = {
            session: PlayerManager.getInstance().HLDDZ_user.sessionKey || "dev-session",
            openid: name,
            name,
            avatar: "",
        };
        GameSocketService.getInstance().login(socketLoginData).then((res) => {
            util.Log("[GameSocketService] login success", res);
        }).catch((err: Error) => {
            util.Log("[GameSocketService] login failed, continue HTTP login", err.message);
        });

        const params: LoginRequest = {
            "session": "PlayerManager.getInstance().HLDDZ_user.sessionKey",
            "name": name,
            "openid": name,//"27WSA6Y5FHH2QXY6DEY6THCQQE",
            "avatar": "",
            "report": report
        }

        HttpManager.Instance.request<LoginResponse, LoginRequest>({
            msgId: NetRequestCode.Login,
            param: params
        }, this._onLoginSuccess.bind(this), this._onLoginFailed.bind(this));
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
        let level=0;
        if(PlayerManager.getInstance().channelId){
            level=1;
        }
        else{
            if(PlayerManager.getInstance().expStrategies.includes(7257879)){
                level=2;
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
        SoundManager.Instance.PlayMusic(MusicID.main);
        PlayerManager.getInstance().extraStr = ""//"YGamByAARBwIcIgA4AAEBBYAAAAAAAR554HgpmvmC-aPACAIUECBiQgQKfDIGj72BwIgEJCiggsWMEjT4ZB0feoeEICCIkkEJhSg8qILCC4owOMiTQc2GOAToE8HPjUA5CKRDUYNIDSi0whOMUDFIdUBVgVgVaGXCF49gBYjmQlmHaD2oxsFbiXA1yGdB3Y14KenwyPo-8z8LADQRUILDGRBcUPGFxw0gHJGSgUsXMETRs4fPBUAdEVSD0wNQbVGVhlcXYH2RdoXbC3Bt0TeE3w-ANhCYg2MVkH5QWYFnEaBWkDqHax-w-GTbH3k3Dd4";

        EventManager.getInstance().emit(UIEventName.UIRoot_Log, "extraStr:" + PlayerManager.getInstance().extraStr);
        if (PlayerManager.getInstance().extraStr && PlayerManager.getInstance().extraStr.length > 0) {
            ShareManager.getInstance().parseExtraStr();
        }
        else if (1 == PlayerManager.getInstance().getMapID()) {
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

        UIManager.Instance.DestroyUIView(UIName.UILogin);

        //
        const params: ReportRequest = {
            "data": "7",
            "type": 5,
        }

        HttpManager.Instance.request<ReportResponse, ReportRequest>({
            msgId: NetRequestCode.Report,
            param: params
        }, (responseData: ReportResponse) => {
            util.Log("s", responseData);
        }, () => {
            util.Log("s");
        });
        //

    }

    _onStageFailed(res: ErrorResponse) {
        util.Log("StageFailed", res);

        //
        HttpManager.Instance.request<StageResponse, StageRequest>({
            msgId: NetRequestCode.Stage,
            param: { "pl": 1 }
        }, this._onStageSuccess.bind(this), this._onStageFailed.bind(this));
    }

    _onPlaySuccess(response: PlayResponse) {
        GameManager.getInstance().setDataMap(response);

        UIManager.Instance.DestroyUIView(UIName.UIMain);
        this.emitUI(UIControllerName.UIController_uiGame, { gameType: GameType.Normal });
    }

    _onPlayFailed(err: unknown) {
        util.Log(err);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    /**
     * 登录失败后的处理逻辑
     */
    private _onLoginFailed(): void {
        util.Log('Login failed');
        this._enableBtnLogin(true);
    }
}
