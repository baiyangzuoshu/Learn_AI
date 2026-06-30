import { GameMagic } from "../Constant";
import type { HLDDZ_USER, LoginResponse } from "../types";
export default class PlayerManager {
    private static Instance: PlayerManager;
    public static getInstance(): PlayerManager {
        if (PlayerManager.Instance == null) {
            PlayerManager.Instance = new PlayerManager();
        }
        return PlayerManager.Instance;
    }

    private curMapID = 1;
    public curGold = 0;
    public netType = 1;//0外网，1内网
    /**
     * 能否充值，1表示能，0表示不能。
     */
    canBuyDiamond = 1;
    /**
     * 音乐开关，1表示开，0表示关。
     */
    musicOn = 0;
    /**
     * 音效开关，1表示开，0表示关。
     */
    soundEffectOn = 0;
    /*
    ①1组-真分享。全部使用真分享。
    ②2组-假分享，全部使用假分享。
    ③3组-全广告。全部使用广告
    ④4组-广告/真分享自主选择。点击后弹出解锁面板，有2个按钮：【看广告】【分享】。其中，分享使用真分享。
    上述看广告，均可使用月卡。
    注意：3和4组，【解锁停车位1】，即使是看广告，也不计入当大40次看广告限量那里，否则不同组之间会不公平
    */
    expStrategy = 2;
    /*
    extraStr 扩展参数
    */
    extraStr = "";
    /**
     * 渠道ID
     */
    channelId = 0;
    /**
    * 多个实验策略。
    */
    expStrategies: number[] = [];
    /** 玩法唯一标识 */
    scoreKey = "";
    /** 可选子 key */
    subScoreKey = 0;

    public pass_stage = 0;//通关id
    public cutWidth = 0;
    public share_game = 0;//是否分享过
    public item = 0;//分享的道具
    public magic = [0, 0, 0, 0];//,刷新，提示，清理
    public role_id = 0;
    public friends = 0;//好友奖励
    public friend_items = 0;//好友奖励提示道具数量
    public guideState = "";//引导
    public vipLevel = 0;//vip等级
    public rank_app = 0;//群排行显示
    public arena_app = 0;//擂台赛开启等级
    public rank_reward = 0;//0没有擂台赛奖励，1则有
    public reward_items = [0, 0, 0, 0];//,刷新，提示，清理

    public HLDDZ_user: HLDDZ_USER = {
        clientType: 136,
        accountType: 1,
        avatarUrl: "",
        diamondCount: 25,
        nickName: "",

        sessionKey: "",
        userid: ""
    }

    // LIFE-CYCLE CALLBACKS:
    onLoad() {
        PlayerManager.Instance = this;
    }

    setRoleData(res: LoginResponse) {
        //console.warn("setRoleData", res);
        const role = res["role"];
        this.curMapID = role["stage"];
        this.pass_stage = role["max_stage"];//通关ID
        this.share_game = role["share_game"];
        this.item = role["item"];
        this.role_id = role["role_id"];
        this.friends = role["friends"];
        this.friend_items = role["friend_items"];
        this.guideState = role["guide"];
        this.rank_app = role["rank_app"] || 0;
        this.arena_app = role["arena_app"] || 0;
        this.rank_reward = role["rank_reward"] || 0;
        //
        const items = res["items"];
        for (const item of items) {
            this.magic[item["id"]] = item["num"];
        }
        //
        const rewards = res["reward_items"] || [];
        for (const item of rewards) {
            this.reward_items[item["id"]] = item["num"];
        }
    }

    getMatchNum() {
        let num = this.magic[GameMagic.Match] + PlayerManager.getInstance().friend_items;
        if (this.item == GameMagic.Match) {
            num++;
        }

        return num;
    }

    getCleanNum() {
        let num = this.magic[GameMagic.Clean];
        if (this.item == GameMagic.Clean) {
            num++;
        }
        return num;
    }

    getRefreshNum() {
        let num = this.magic[GameMagic.Refresh];
        if (this.item == GameMagic.Refresh) {
            num++;
        }
        return num;
    }

    setMapID(id: number) {
        this.curMapID = id;
    }

    getMapID(): number {
        return this.curMapID;
    }
}
