import { cpConfig } from '../cp.config';

export const BundleName = {
    BundleMain: `Bundle${cpConfig.cpName}`,
}

export const UIName = {
    UIMain: "UIMain",
    UIGame: "UIGame",
    UIRestart: "UIRestart",
    UIWin: "UIWin",
    UILogin: "UILogin",
    UITip: "UITip",
    UIRank: "UIRank",
    UISet: "UISet",
    UIBagTip: "UIBagTip",
    UIADShareTip: "UIADShareTip",
    UIEnd: "UIEnd",
    UIDiamondTip: "UIDiamondTip",
    UIDiamondBuy: "UIDiamondBuy",
    UIBack: "UIBack",
    UICommon: "UICommon",
    UICommonTip: "UICommonTip",
    UICommonTip2: "UICommonTip2",
    UIPayTip: "UIPayTip",
    UIPaySuccess: "UIPaySuccess",
    UIRewardInfo: "UIRewardInfo",
    UIShareReward: "UIShareReward",
    UIShareWin: "UIShareWin",
    UIShareTip: "UIShareTip",
    UIFirst: "UIFirst",
    UIScore: "UIScore",
}

export const GameState = {
    None: 0,
    Start: 1,
    Pause: 2,
    Fail: 3,
    Win: 4,
    Over: 5,
    Restart: 6,
    Auto: 7,
}

export const SDKState = {
    None: 0,
    Share: 1,
    Ad: 2,
    Pay: 3,
    Diamond: 4
}

export const UIEventName = {
    UIGame_nextMap: "UIGame_nextMap",
    UIRoot_getPlayerInfo: "UIRoot_getPlayerInfo",
    UIRoot_doLogin: "UIRoot_doLogin",
    UIRoot_Log: "UIRoot_Log",
    UIGame_checkGameState: "UIGame_checkGameState",
    UIGame_refreshBagUI: "UIGame_refreshBagUI",
    UIGame_resetSelectTitle: "UIGame_resetSelectTitle",
    UIGame_refreshBagTip: "UIGame_refreshBagTip",
    UIGame_linkupAction: "UIGame_linkupAction",
    UIBagTip_refreshUI: "UIBagTip_refreshUI",
    UIRestart_refreshUI: "UIRestart_refreshUI",
    UIGame_refreshBagVisible: "UIGame_refreshBagVisible",
    UIGame_useBagEffect: "UIGame_useBagEffect",
    UIGame_onTileClick: "UIGame_onTileClick",
    UIGame_onRefreshClick: "UIGame_onRefreshClick",
    UIGame_netRefresh: "UIGame_netRefresh",
    UIGame_resetCollapse: "UIGame_resetCollapse",
    WorkFlow_useRefresh: "WorkFlow_useRefresh",
    UIGame_testShare: "UIGame_testShare",
    UIGame_onBagClick: "UIGame_onBagClick",
    UIMain_refreshShareBtn: "UIMain_refreshShareBtn",
    UIGame_hideRefreshBagTip: "UIGame_hideRefreshBagTip",
    UIGame_touchStart: "UIGame_touchStart",
    UIGame_refreshPercentUI: "UIGame_refreshPercentUI",
    UIGame_tip: "UIGame_tip",
    UIGame_guide: "UIGame_guide",
    UIGame_showGuideCut: "UIGame_backBtnClick",
    GameGuide_touchCancel: "GameGuide_touchCancel",

    ScoreWin: "ScoreWin",
    ScoreFail: "ScoreFail",
    ScoreExit: "ScoreExit"
}

export const UIControllerName = {
    UIController_uiMain: "UIController_uiMain",
    UIController_uiGame: "UIController_uiGame",
    UIController_uiSet: "UIController_uiSet",
    UIController_uiWin: "UIController_uiWin",
    UIController_uiShareWin: "UIController_uiShareWin",
    UIController_uiBag: "UIController_uiBag",
    UIController_uiRestart: "UIController_uiRestart",
    UIController_uiCommonTip: "UIController_uiCommonTip",
    UIController_uiCommon: "UIController_uiCommon",
    UIController_uiRank: "UIController_uiRank",
    UIController_UIDiamondTip: "UIController_UIDiamondTip",
    UIController_UIDiamondBuy: "UIController_UIDiamondBuy",
    UIController_UIPayTip: "UIController_UIPayTip",
    UIController_UIPaySuccess: "UIController_UIPaySuccess",
    UIController_UIRewardInfo: "UIController_UIRewardInfo",
    UIController_UIRewardCommon: "UIController_UIRewardCommon",
    UIController_uiShareReward: "UIController_uiShareReward",
    UIController_uiShareTip: "UIController_uiShareTip",
    UIController_uiFirst: "UIController_uiFirst",
    UIController_rankonChallengeStart: "UIController_rankonChallengeStart",
    UIController_UIKeyExit: "UIController_UIKeyExit",
}

export const WSRoute = {
    Login: "login",
    EnterStage: "game.enter_stage",
}

export const NetRequestCode = {
    Login: "koigame/linkup/login",
    Play: "koigame/linkup/stage/play",
    PlayTest: "koigame/linkup/stage/playtest",
    Win: "koigame/linkup/stage/result",
    MapPlay: "koigame/linkup/stage/friendplay",
    MapPlayReward: "koigame/linkup/stage/friendreward",
    MapPlayResult: "koigame/linkup/stage/friendresult",
    Report: "koigame/linkup/role/report",
    Rank: "koigame/linkup/role/rank",
    RankStage: "koigame/linkup/stage/rank",
    Share: "koigame/linkup/role/share",
    ItemBuy: "koigame/linkup/stage/buy",
    ItemUse: "koigame/linkup/stage/use",

    Stage: "koigame/linkup/stage",
    Guild: "koigame/linkup/role/guild",

    Vip: "koigame/linkup/role/vip",
    Resultvip: "koigame/linkup/stage/resultvip",
    ResultC: "koigame/linkup/stage/resultc",
    Playvip: "koigame/linkup/stage/playvip",
    PlayC: "koigame/linkup/stage/playc",

    PlayScore: "koigame/linkup/stage/playarena",
    ResultScore: "koigame/linkup/stage/resultarena",
    RewardScore: "koigame/linkup/role/rankreward",
}

export const UIStateID = {
    Main: "Main",
}

export const GameMagic = {
    Refresh: 1,
    Match: 2,
    Clean: 3,
}

export const ShareType = {
    None: 0,
    First: 1,//主页分享
    Rank: 2,//排名分享
    Win: 3,//过关分享
    Fail: 4,//过关失败分享
    Share: 5,//残局分享
    Union: 6,//群排行
}

export const MusicID = {
    main: "Music/main"
}

export const SoundID = {
    point: "1",//点击音效
    bagClean: "bag",//清除音效
    bagMatch: "bag",//匹配音效
    bagRefresh: "bag",//刷新音效
    linkup: "linkup",//连接音效
    pointBlock: "pointBlock",//点块音效
    startGame: "startGame",//开始游戏音效
    link3_4: "link3-4",//连击音效link3-4
    link5_6: "link5-6",//连击音效
    link7_n: "link7-n",//连击音效
    win: "win",//8、胜利音效
    fail: "fail",//8、失败音效
    ice: "ice",//冰块碎裂
    hudie: "hudie",//蝴蝶牌翻开
    clean: "clean",//刷新三次障碍物消失
    tenman: "tenman",//藤蔓解开
    move: "move",//图块移动音效
    main2: "main2",//主界面音效
    zhadan: "zhadan",//炸弹爆炸
}

export const TipText = {
    ad: "今日广告次数已用完。第二天0点可恢复次数，正常看广告",
    buySuccess: "购买成功！",
    bag: "次数已用完",
    stage1: "用户不存在！",
    stage2: "非法数据！",
    stage3: "未知错误！",
    cleanCar: "请稍等！",
    buyDiamond: "订单异常，稍后再试!",
    RoleExist: "角色不存在",
    ParamExist: "参数不存在",
    ParamWinExist: "win 不存在",
    ParamWinTypeErr: "win 类型错误",
    notBag: "不可操作",
    appAd1: "地主哥正在准备广告，请稍后再来",
    appAd2: "真抱歉，当前暂无可观看的广告",
    appDiamond1: "钻石不足",
    appDiamond2: "扣钻失败，请重新尝试",
    bag2: "道具冷却中",
}

export const DiamondSkipAD = 10;

export const NetType = {
    Test: 1,
    official: 0
}

export const PayIDs = {
    "Bag": 10004001,//常规复活和道具购买30
    "MatchBag": 10004001,//道具购买30
    "RefreshBag": 10004002,//道具购买30
    "CleanBag": 10004003,//道具购买30
    "Card1": 10001002,//初级月卡300
    "Card2": 10001003,//中级月卡600
    "Card3": 10001004,//高级月卡900
    "Card4": 10001005,//初级月卡升级中级300
    "Card5": 10001006,//中级月卡升级高级300
    "Card6": 10001007,//初级月卡升级高级600
}

export const SeverIPs = {
    Local: "http://192.168.5.139:17886",
    Test: "https://hlddzcptest.huanle.qq.com",
    official: "https://hlddzcp.huanle.qq.com",
}

export const TitleSize = 83;
export const MapWidth = 8;
export const MapHeight = 14;
//
export const dirs = [
    { dx: 0, dy: -1 }, // 上
    { dx: 1, dy: 0 },  // 右
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }  // 左
];

export const dirsMagnet = [
    { dx: 0, dy: -1 }, // 上
    { dx: 1, dy: 0 },  // 右
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 },  // 左
    { dx: 1, dy: 1 },  // 右下
    { dx: -1, dy: 1 },  // 右上
    { dx: -1, dy: -1 },  // 左上
    { dx: 1, dy: -1 },  // 左下
];
//坍塌方向
export const GameDirection = {
    None: 1,//无
    Left: 2,//向左坍塌
    Right: 3,//向右坍塌
    Up: 4,//向上坍塌
    Down: 5,//向下坍塌
    UpDown: 6,//上下坍塌
    LeftRight: 7,//左右坍塌
    RightLeft: 8,//内向左右坍塌
    DownUp: 9,//内向上下坍塌
    Rotate: 10,//旋转坍塌
    DoubleRotate: 11,//双旋转坍塌
    Rotate3: 12,//旋转坍塌3
    Rotate4: 13,//旋转坍塌4
}
//块ID
export const BlockIDs = {
    Empty: 0,
    RK: 100,
    None: 1000,
    Stone: 1001,//石块：不可消除，不可移动
    Ice: 1002,//冰块：有三个阶段，在周围发生消除时，可逐渐被解冻，完全解冻后消除
    Ice2: 1003,//冰块：有三个阶段，在周围发生消除时，可逐渐被解冻，完全解冻后消除
    Ice3: 1004,//冰块：有三个阶段，在周围发生消除时，可逐渐被解冻，完全解冻后消除
    Green: 1005,//暗牌：初始显示背面，周围发生消除后被翻开
    Wooden: 1006,//木块：不可消除，可跟随关卡机制移动
    Rocket: 1007,//火箭:成对消除后，发射四组火箭，随机消除4对
    Grass: 1008,//藤蔓：初始棋子被藤蔓缠绕，无法消除，周围发生消除后藤蔓消失
    Magnet: 1009,//磁铁：磁铁周围一圈的图标无法跟随关卡机制移动
    Placeholder: 1010,//占位
    Random1: 1011,//策划配置位置图标：关卡编辑器中策划可配置N种图标位置，之后关卡生成时将N种图标（图标种类随机）从随机库中剔除
    Random2: 1012,//策划配置位置图标：关卡编辑器中策划可配置N种图标位置，之后关卡生成时将N种图标（图标种类随机）从随机库中剔除
    Random3: 1013,//策划配置位置图标：关卡编辑器中策划可配置N种图标位置，之后关卡生成时将N种图标（图标种类随机）从随机库中剔除
    Random4: 1014,//策划配置位置图标：关卡编辑器中策划可配置N种图标位置，之后关卡生成时将N种图标（图标种类随机）从随机库中剔除
}
//
export const DirectionTip = [
    "",
    "无方向",
    "方块消除后会整体向左移动",
    "方块消除后会整体向右移动",
    "方块消除后会整体向上移动",
    "方块消除后会整体向下移动",
    "消除后从中间开始上下分开",
    "消除后从中间开始左右分开",
    "消除后左右分别向中间靠拢",
    "消除后上下分别向中间靠拢",
    "消除时会沿轨道循环移动",
    "消除时会沿轨道循环移动",
    "消除时会沿轨道循环移动",
    "消除时会沿轨道循环移动",
]
//
export const FirstTip: Record<string, string> = {
    "2": "连线炸弹触发随机轰炸",
    "11": "消除相邻方块可以赶走蝴蝶",
    "14": "石块不可移动，不可消除",
    "21": "消除相邻方块可炸碎冰块",
    "31": "木块会跟随移动，不可消除",
    "41": "漩涡会吸住周围一圈方块",
    "45": "消除相邻方块可清除藤蔓",
}

export const SpecialBlockTip: Record<string, string> = {
    "1007": "连线炸弹触发随机轰炸",
    "1005": "消除相邻方块可以赶走蝴蝶",
    "1001": "石块不可移动，不可消除",
    "1002": "消除相邻方块可炸碎冰块",
    "1003": "消除相邻方块可炸碎冰块",
    "1004": "消除相邻方块可炸碎冰块",
    "1006": "木块会跟随移动，不可消除",
    "1009": "漩涡会吸住周围一圈方块",
    "1008": "消除相邻方块可清除藤蔓",
}
//
export const BlockTip = {
    RK: 100,
    LinkUpError1: "相同图案才能消除哦",
    LinkUpError2: "被包围了无法连线哦",
    LinkUpError3: "连线转折不超过2次才能消除哦",
    Stone: "石块不可移动，不可消除",
    Ice: "消除相邻方块可炸碎冰块",
    Ice2: "消除相邻方块可炸碎冰块",
    Ice3: "消除相邻方块可炸碎冰块",
    Green: "消除相邻方块可以赶走蝴蝶",
    Wooden: "木块会跟随移动，不可消除",
    Rocket: "成对消除后，扔出1组炸弹，随机消除1对",
    Grass: "消除相邻方块可清除藤蔓",
    Magnet: "漩涡会吸住周围一圈方块",
}
//
export const LinkUpTip = [
    "", "", "",
    "棒",
    "赞",
    "太酷了",
    "不可思议",
    "哇撒",
    "厉害",
    "漂亮",
]

export const GameType = {
    None: 0,
    Normal: 1,
    Share: 2,
    Score: 3,
    ScoreChange: 4,
}

export const LinkUpEnum = {
    Link1: [3, 6],
    Link2: [7, 9999],
    Link3: [10, 9999],
    LinkTime: 5
}

export const ArtPath = {
    FX_baozha: "Art/prefab/FX_baozha",
    FX_bingkuai: "Art/prefab/FX_bingkuai",
    FX_daojutongyong: "Art/prefab/FX_daojutongyong",
    FX_dianji: "Art/prefab/FX_dianji",
    FX_duigou: "Art/prefab/FX_duigou",
    FX_guanka: "Art/prefab/FX_guanka",
    FX_guankakaishi: "Art/prefab/FX_guankakaishi",
    FX_hudie: "Art/prefab/FX_hudie",
    FX_hudiedianji: "Art/prefab/FX_hudiedianji",
    FX_hudiefei1: "Art/prefab/FX_hudiefei1",
    FX_jiesuo: "Art/prefab/FX_jiesuo",
    FX_nanduup: "Art/prefab/FX_nanduup",
    FX_tbzhadan: "Art/prefab/FX_tbzhadan",
    FX_tengman: "Art/prefab/FX_tengman",
    FX_tubiaoguang: "Art/prefab/FX_tubiaoguang",
    FX_xuanwo: "Art/prefab/FX_xuanwo",
    FX_zhadan: "Art/prefab/FX_zhadan",
    nongmin: "Art/prefab/nongmin",
    nongmincahan: "Art/prefab/nongmincahan",
    nongminloding: "Art/prefab/nongminloding",
    nongmintiao: "Art/prefab/nongmintiao",
    FX_hudiehudong: "Art/prefab/FX_hudiehudong",
}

export const ModelName = {
    ScoreData: "ScoreData",
}

export const ScoreKey = "LlkArenaPK";

export const LLKVersion = "05.06 3.0.5";
