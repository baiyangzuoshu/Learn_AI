import HttpManager from "../../FrameWork/manager/HttpManager";
import LoadRemoteManager from "../../FrameWork/manager/LoadRemoteManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import TableView from "../../FrameWork/ui/TableView";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { NetRequestCode, SDKState, ShareType, SoundID, UIName } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";
import type { PlayResponse, PlayTestRequest, Titem } from "../types";

export default class UIRankUICtrl extends UIComponent {
    private cloneItem!: cc.Node;
    private myScrollView!: cc.ScrollView;
    private ownNode!: cc.Node;
    private itemArr: Titem[] = [];

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        // 获取相关节点
        this.ownNode = this.getChildByUrl("own");

        const itemTemplate = this.getChildByUrl("rankScrollView/view/content/item");
        this.cloneItem = cc.instantiate(itemTemplate);
        this.cloneItem.active = true; // 隐藏模板
        this.ownNode.active = false;

        this.myScrollView = this.getChildByUrl("rankScrollView").getComponent(cc.ScrollView);
        this.myScrollView.content.removeAllChildren();

        // 绑定按钮事件
        this.AddButtonListener("shareBtn", this.onshareBtnClick, this);
        this.AddButtonListener("closeBtn", this.oncloseBtnClick, this);
        this.getChildByUrl("shareBtn").active=!SDKAdapter.getInstance().isAppHarmonyGame();
        // 发起排行榜请求
        HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
            msgId: NetRequestCode.Rank,
            param: { "id": 1 }
        }, this._onRankSuccess.bind(this), this._onRankFailed.bind(this));

        // 监听 TableView 转发的事件（如果需要）
        this.node.on("tableview-item-click", this.onTableViewItemClick, this);
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    /**
     * 排行榜请求成功回调
     * @param res 返回数据
     */
    async _onRankSuccess(res: unknown) {
        const responseData: { own: Titem; all: Titem[]; } = res as { own: Titem; all: Titem[]; };

        this.myScrollView.content.removeAllChildren();
        this.ownNode.active = true;

        this.itemArr = responseData["all"];

        this.loadOwnItem(this.ownNode, responseData["own"], responseData["own"]["value"]);

        // 初始化 TableView
        const tableView = this.myScrollView.node.addComponent(TableView);
        // 定义数据绑定回调
        const bindCallback = this.bindRankItem.bind(this);
        // 定义点击事件回调
        const clickCallback = this.onTableViewItemClick.bind(this);

        // 注入依赖
        tableView.initialize({
            scrollView: this.myScrollView,
            itemPrefab: this.cloneItem,
            itemHeight: 125,
            spacingY: 10,
            diffY: 0,
        }, this.itemArr, {
            bindCallback: bindCallback,
            clickCallback: clickCallback
        }
        );
    }

    /**
     * 排行榜请求失败回调
     * @param err 错误信息
     */
    _onRankFailed(err: unknown) {
        console.error("RankFailed", err);
    }

    /**
     * 业务逻辑：绑定排行榜项的数据
     * @param node 列表项节点
     * @param data 数据对象
     */
    private bindRankItem(node: cc.Node, res: unknown) {
        const data = res as Titem;
        // 1. 设置排名
        const rank = data["rank"];
        const rankNode = node.getChildByName("rank");
        // 重置
        for (let i = 0; i < 4; i++) {
            rankNode.getChildByName(i.toString()).active = false;
        }
        rankNode.getChildByName("level").active = false;

        if (rank > 3) {
            const level = rankNode.getChildByName("level");
            level.active = true;
            level.getComponent(cc.Label).string = rank.toString();
        } else if (rank >= 0) {
            rankNode.getChildByName("" + rank).active = true;
        }

        const nameLabel = node.getChildByName("10").getChildByName("name").getComponent(cc.Label);
        nameLabel.string = util.abbreviateByDisplayWidth(data["name"]);
        const gkLabel = node.getChildByName("gk").getComponent(cc.Label);
        gkLabel.string = "第" + data["value"] + "关";
        const gkLabel2 = node.getChildByName("gk2").getComponent(cc.Label);
        gkLabel2.string = "第" + data["value"] + "关";

        gkLabel.node.active = true;
        gkLabel2.node.active = false;
        node.getChildByName("bg").active = true;
        node.getChildByName("bg2").active = false;
        // 5. 加载头像图片（如果不是 Web 游戏）
        if (!SDKAdapter.getInstance().isWebDev()) {
            const tex = LoadRemoteManager.getInstance().loadImage(util.processUrl(data["avatar"]));
            if (tex) {
                const img = node.getChildByName("frame").getChildByName("6").getComponent(cc.Sprite);
                const spriteFrame = new cc.SpriteFrame(tex);
                img.spriteFrame = spriteFrame;
                img.node.width = 59;
                img.node.height = 59;
            }
        }
    }

    /**
     * 业务逻辑：绑定自己的排名信息
     * @param node 自己的信息节点
     * @param data 数据对象
     * @param gold 金币数
     */
    private loadOwnItem(node: cc.Node, data: Titem, gold: number) {
        const rank = data["rank"];
        const rankNode = node.getChildByName("rank");
        // 重置
        for (let i = 0; i < 4; i++) {
            rankNode.getChildByName(i.toString()).active = false;
        }
        rankNode.getChildByName("level").active = false;

        if (rank > 3) {
            const level = rankNode.getChildByName("level");
            level.active = true;
            level.getComponent(cc.Label).string = rank.toString();
        } else if (rank >= 0) {
            rankNode.getChildByName(rank.toString()).active = true;
        }

        // 设置名称
        const nameLabel = node.getChildByName("10").getChildByName("name").getComponent(cc.Label);
        nameLabel.string = util.abbreviateByDisplayWidth(PlayerManager.getInstance().HLDDZ_user.nickName);

        // 设置金币
        const gk2Label = node.getChildByName("gk2").getComponent(cc.Label);
        gk2Label.string = "第" + gold + "关";

        // 加载头像图片（如果不是 Web 游戏）
        if (!SDKAdapter.getInstance().isWebDev()) {
            const tex = LoadRemoteManager.getInstance().loadImage(util.processUrl(PlayerManager.getInstance().HLDDZ_user.avatarUrl));
            if (tex) {
                const img = node.getChildByName("frame").getChildByName("6").getComponent(cc.Sprite);
                const spriteFrame = new cc.SpriteFrame(tex);
                img.spriteFrame = spriteFrame;
                img.node.width = 59;
                img.node.height = 59;
            }
        }
    }
    /**
     * 处理 TableView 的列表项点击事件
     * @param itemId 数据索引
     * @param node 列表项节点
     */
    private onTableViewItemClick(itemId: number, node: cc.Node) {
        util.Log(itemId, node);
    }

    /**
     * 分享按钮点击事件
     */
    async onshareBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);

        GameManager.getInstance().sdkState = SDKState.Share;
        GameManager.getInstance().report.shareOpen++;
        SDKAdapter.getInstance().HLDDZ_shareMessage(ShareType.Rank, { realShare: false, rankName: "" }, (data: number) => {
            GameManager.getInstance().sdkState = SDKState.None;
            SoundManager.Instance.ResumeMusic();
            util.Log(data);
            if (data === 0) {
                util.Log(data);
            } else {
                util.Log(data);
            }
        });
    }

    /**
     * 关闭按钮点击事件
     */
    oncloseBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIRank);
    }
}
