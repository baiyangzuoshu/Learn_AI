import HttpManager from "./FrameWork/manager/HttpManager";
import { SoundManager } from "./FrameWork/manager/SoundManager";
import { UIComponent } from "./FrameWork/ui/UIComponent";
import { util } from "./FrameWork/Utils/util";
import { BlockIDs, GameDirection, GameState, GameType, NetRequestCode, SeverIPs, SoundID, UIControllerName, UIEventName } from "./Scripts/Constant";
import { GameBlock } from "./Scripts/Game/GameBlock";
import { BlockManager } from "./Scripts/Manager/BlockManager";
import GameManager from "./Scripts/Manager/GameManager";
import MapManager from "./Scripts/Manager/MapManager";
import PlayerManager from "./Scripts/Manager/PlayerManager";
import { PlayResponse, PlayTestRequest, Pos } from "./Scripts/types";

export default class GameTest extends UIComponent {
    private autoGKCount: number = 2;//关卡自动测试次数
    private autoGKTotal: number = 2;//本次自动测试总关卡数量
    //
    private isAutoClean: boolean = false;//是否自动测试
    private time: number = 0;//当前关卡自动测试时间
    private percents: number[] = [];//当前关卡自动测试进度
    private autoCount: number = 0;//当前关卡自动测试次数

    private autoMapData: Record<number, number[]> = {};//自动测试数据
    private autoTotalMapData: Record<number, Record<number, number[]>> = {};//自动测试总数据
    private curGKID: number = 0;//当前关卡ID

    private isStop = false;
    private restartTime: number = 10 * 60;
    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    onStopBtnClick() {
        this.isStop = true;
        this.print();
    }

    onResumeBtnClick() {
        this.isStop = false;
    }

    onRestartBtnClick() {
        this.restartTime = 10 * 60;
        this.isAutoClean = false;
        cc.tween(this.node)
            .delay(3)
            .call(() => {
                this.netPlay();
            })
            .start();
    }

    onTestBtnClick() {
        if (SeverIPs.official == HttpManager.address) {
            return;
        }
        this.isAutoClean = true;
        this.percents = [];
        this.autoCount = 0;
        this.autoMapData = {};
        this.curGKID = PlayerManager.getInstance().getMapID();
    }

    nextGK() {
        this.autoGKTotal--;
        if (this.autoGKTotal <= 0) {
            this.restartTime = 48 * 60 * 60;
            this.print();
            return;
        }

        this.autoCount = 0;
        this.autoMapData = {};
        this.curGKID++;
        PlayerManager.getInstance().setMapID(this.curGKID);
        this.netPlay();
    }

    print() {
        console.warn("自动测试完成:");
        for (const gkID in this.autoTotalMapData) {
            const info = this.autoTotalMapData[gkID];
            let str = "";
            for (const key in info) {
                const tt = info[key];
                for (let i = 0; i < tt.length; i++) {
                    if (tt[i] >= 100) break;
                    if (i > 0) {
                        str = str + "," + tt[i];
                    }
                    else {
                        str = str + tt[i];
                    }
                }
                str = str + "#";
            }
            console.warn(gkID + ":", str);
        }
    }

    autoClean() {
        GameManager.getInstance().state = GameState.Auto;
        // 1) 取出当前逻辑板（不含边界）
        const rawBoard = MapManager.getInstance().getBoard();
        // 2) 调用 BlockManager 进行匹配
        const pos = this.findAnyMatch(rawBoard);
        if (pos.length > 0) {
            util.Log("可消除的图块", pos);

            const firstTile = MapManager.getInstance().mapTitles[pos[0].x - 1][pos[0].y - 1];
            const secondTile = MapManager.getInstance().mapTitles[pos[1].x - 1][pos[1].y - 1];
            if (firstTile.getComponent(GameBlock).getBaseData().type == BlockIDs.Rocket) {
                this.time = -3;
            }

            this.emitUI(UIEventName.UIGame_onTileClick, firstTile);
            this.emitUI(UIEventName.UIGame_onTileClick, secondTile);
        } else {
            const board: number[] = [];
            for (const row of rawBoard) {
                for (const id of row) {
                    if (id > BlockIDs.Empty && id < BlockIDs.None) {
                        board.push(id);
                    }
                }
            }
            if (1 == board.length) {
                this.autoWin();
                return;
            }

            this.time = -2;
            let num = GameManager.getInstance().curBlockCount * 100 / GameManager.getInstance().maxBlockCount;
            num = Math.min(100, num);
            num = Math.ceil(num);
            if (num >= 100) {
                this.autoWin();
                return;
            }
            console.warn("第" + this.curGKID + "关 第" + (this.autoCount + 1) + "场" + "无可消除的图块 使用刷新，纪录进度", num);
            this.percents.push(num);
            this.emitUI(UIEventName.WorkFlow_useRefresh, num);
        }

        //检测胜利
        if (MapManager.getInstance().checkWin()) {
            this.autoWin();
        }
    }

    private autoWin() {
        console.error("第" + this.curGKID + "关 第" + (this.autoCount + 1) + "场胜利", this.percents);

        this.isAutoClean = false;
        this.autoCount++;

        this.autoMapData[this.autoCount] = this.percents;
        console.warn(JSON.stringify(this.autoMapData));
        if (this.autoCount >= this.autoGKCount) {
            let str = "";
            const info = this.autoMapData;
            for (const key in info) {
                const tt = info[key];
                for (let i = 0; i < tt.length; i++) {
                    if (tt[i] >= 100) break;
                    if (i > 0) {
                        str = str + "," + tt[i];
                    }
                    else {
                        str = str + tt[i];
                    }
                }
                str = str + "#";
            }
            console.error("第" + this.curGKID + "关 自动完成:", str);

            this.autoTotalMapData[this.curGKID] = this.autoMapData;
            this.nextGK();
        }
        else {
            this.netPlay();
        }
    }

    public findAnyMatch(rawBoard: number[][]): Pos[] {
        const matches: [Pos, Pos][] = BlockManager.getInstance().findAllMatches(rawBoard);
        if (matches.length === 0) return [];

        const dir = MapManager.getInstance().dirction;
        const width = rawBoard[0].length;
        const height = rawBoard.length;

        // 把所有 match 放进一个集合，方便快速判断
        const matchSet = new Set<string>();
        for (const [p1, p2] of matches) {
            matchSet.add(`${p1.x},${p1.y},${p2.x},${p2.y}`);
            matchSet.add(`${p2.x},${p2.y},${p1.x},${p1.y}`); // 双向存
        }

        // 一个工具函数：检查(x1,y1)-(x2,y2)是否在match集合里
        const isMatch = (x1: number, y1: number, x2: number, y2: number): boolean => {
            return matchSet.has(`${x1},${y1},${x2},${y2}`);
        };

        // 按方向不同，遍历顺序不同
        if (dir === GameDirection.Down) {
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    for (const [p1, p2] of matches) {
                        if (p1.x === x && p1.y === y) {
                            return [{ x: p1.x + 1, y: p1.y + 1 }, { x: p2.x + 1, y: p2.y + 1 }];
                        }
                        if (p2.x === x && p2.y === y) {
                            return [{ x: p2.x + 1, y: p2.y + 1 }, { x: p1.x + 1, y: p1.y + 1 }];
                        }
                    }
                }
            }
        }
        else if (dir === GameDirection.Up) {
            for (let x = width - 1; x >= 0; x--) {
                for (let y = 0; y < height; y++) {
                    for (const [p1, p2] of matches) {
                        if (p1.x === x && p1.y === y) {
                            return [{ x: p1.x + 1, y: p1.y + 1 }, { x: p2.x + 1, y: p2.y + 1 }];
                        }
                        if (p2.x === x && p2.y === y) {
                            return [{ x: p2.x + 1, y: p2.y + 1 }, { x: p1.x + 1, y: p1.y + 1 }];
                        }
                    }
                }
            }
        }
        else if (dir === GameDirection.Right) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    for (const [p1, p2] of matches) {
                        if (p1.x === x && p1.y === y) {
                            return [{ x: p1.x + 1, y: p1.y + 1 }, { x: p2.x + 1, y: p2.y + 1 }];
                        }
                        if (p2.x === x && p2.y === y) {
                            return [{ x: p2.x + 1, y: p2.y + 1 }, { x: p1.x + 1, y: p1.y + 1 }];
                        }
                    }
                }
            }
        }
        else if (dir === GameDirection.Left) {
            for (let y = height - 1; y >= 0; y--) {
                for (let x = 0; x < width; x++) {
                    for (const [p1, p2] of matches) {
                        if (p1.x === x && p1.y === y) {
                            return [{ x: p1.x + 1, y: p1.y + 1 }, { x: p2.x + 1, y: p2.y + 1 }];
                        }
                        if (p2.x === x && p2.y === y) {
                            return [{ x: p2.x + 1, y: p2.y + 1 }, { x: p1.x + 1, y: p1.y + 1 }];
                        }
                    }
                }
            }
        } else if (dir === GameDirection.LeftRight) {
            const cx = Math.floor(width / 2);
            const scanOrder: number[] = [cx];
            for (let offset = 1; offset <= cx; offset++) {
                if (cx + offset < width) scanOrder.push(cx + offset); // 右
                if (cx - offset >= 0) scanOrder.push(cx - offset);     // 左
            }

            for (const x of scanOrder) {
                for (let y = 0; y < height; y++) { // 从上到下扫描每列
                    for (const [p1, p2] of matches) {
                        if ((p1.x === x && p1.y === y) || (p2.x === x && p2.y === y)) {
                            return [
                                { x: p1.x + 1, y: p1.y + 1 },
                                { x: p2.x + 1, y: p2.y + 1 }
                            ];
                        }
                    }
                }
            }
        }

        else if (dir === GameDirection.RightLeft) {
            const maxOffset = Math.floor(width / 2);
            for (let offset = 0; offset <= maxOffset; offset++) {
                const left = offset;
                const right = width - 1 - offset;
                if (left < width) {
                    for (let y = 0; y < height; y++) {
                        for (const [p1, p2] of matches) {
                            if ((p1.x === left && p1.y === y) || (p2.x === left && p2.y === y)) {
                                return [
                                    { x: p1.x + 1, y: p1.y + 1 },
                                    { x: p2.x + 1, y: p2.y + 1 }
                                ];
                            }
                        }
                    }
                }
                if (right >= 0 && right !== left) {
                    for (let y = 0; y < height; y++) {
                        for (const [p1, p2] of matches) {
                            if ((p1.x === right && p1.y === y) || (p2.x === right && p2.y === y)) {
                                return [
                                    { x: p1.x + 1, y: p1.y + 1 },
                                    { x: p2.x + 1, y: p2.y + 1 }
                                ];
                            }
                        }
                    }
                }
            }
        }
        else if (dir === GameDirection.UpDown) {
            const cx = Math.floor(width / 2);
            const scanOrder: number[] = [cx];
            for (let offset = 1; offset <= cx; offset++) {
                if (cx + offset < width) scanOrder.push(cx + offset); // 右
                if (cx - offset >= 0) scanOrder.push(cx - offset);     // 左
            }

            for (const x of scanOrder) {
                for (let y = 0; y < height; y++) { // 从上到下扫描每列
                    for (const [p1, p2] of matches) {
                        if ((p1.x === x && p1.y === y) || (p2.x === x && p2.y === y)) {
                            return [
                                { x: p1.x + 1, y: p1.y + 1 },
                                { x: p2.x + 1, y: p2.y + 1 }
                            ];
                        }
                    }
                }
            }
        }
        else if (dir === GameDirection.DownUp) {
            const maxOffset = Math.floor(height / 2);
            for (let offset = 0; offset <= maxOffset; offset++) {
                const up = offset;
                const down = height - 1 - offset;
                if (up < height) {
                    for (let x = 0; x < width; x++) {
                        for (const [p1, p2] of matches) {
                            if ((p1.y === up && p1.x === x) || (p2.y === up && p2.x === x)) {
                                return [
                                    { x: p1.x + 1, y: p1.y + 1 },
                                    { x: p2.x + 1, y: p2.y + 1 }
                                ];
                            }
                        }
                    }
                }
                if (down >= 0 && down !== up) {
                    for (let x = 0; x < width; x++) {
                        for (const [p1, p2] of matches) {
                            if ((p1.y === down && p1.x === x) || (p2.y === down && p2.x === x)) {
                                return [
                                    { x: p1.x + 1, y: p1.y + 1 },
                                    { x: p2.x + 1, y: p2.y + 1 }
                                ];
                            }
                        }
                    }
                }
            }
        }
        // 其它模式 → 先不特殊化，取第一个
        const best = matches[0];
        return [
            { x: best[0].x + 1, y: best[0].y + 1 },
            { x: best[1].x + 1, y: best[1].y + 1 }
        ];
    }

    private netPlay() {
        this.restartTime = 10 * 60;
        SoundManager.Instance.PlaySound(SoundID.point);
        const params: PlayTestRequest = {
            id: this.curGKID,
        }
        if (SeverIPs.official == HttpManager.address) {
            HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
                msgId: NetRequestCode.Play,
                param: params
            }, this._onPlaySuccess.bind(this), this._onPlayFailed.bind(this));
        }
        else {
            HttpManager.Instance.request<PlayResponse, PlayTestRequest>({
                msgId: NetRequestCode.PlayTest,
                param: params
            }, this._onPlaySuccess.bind(this), this._onPlayFailed.bind(this));
        }

    }

    _onPlaySuccess(response: PlayResponse) {
        GameManager.getInstance().gameType = GameType.Normal;
        GameManager.getInstance().setDataMap(response);
        this.emitUI(UIEventName.UIGame_nextMap);

        this.time = -5;
        this.isAutoClean = true;
        this.percents = [];

    }

    _onPlayFailed(err: unknown) {
        util.Log(err);
        this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "进入关卡失败，请重新尝试！" });
    }

    update(dt) {
        if (this.isStop) return;

        if (this.isAutoClean) {
            this.time += dt;
            if (this.time >= 1) {
                this.time = 0;
                this.autoClean();
            }
        }

        this.restartTime -= dt;
        if (this.restartTime <= 0) {
            const raw = MapManager.getInstance().getBoard(); // y×x 原始数据，不含边界
            console.table(raw);
            console.error("游戏超时，自动重新开始");
            this.onRestartBtnClick();
        }
    }
}
