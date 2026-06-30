import { util } from "../../FrameWork/Utils/util";
import { BlockIDs, dirsMagnet, TitleSize } from "../Constant";
import { GameBlock } from "../Game/GameBlock";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import type { MoveInfo, MoveInfoList, Pos } from "../types";

export class CollapseUtil {
    public test() {
        util.Log("test");
    }
    public static doAcion2(data: { delayTime: number, list: Map<number, MoveInfoList>, moveX: number, moveY: number }) {
        const gm = MapManager.getInstance();
        const width = gm.mapWidth;
        const height = gm.mapHeight;

        // 统计每个节点最终移动信息（一次 tween 到位）
        const agg = new Map<cc.Node, { steps: number, finalTo: { h: number, w: number } }>();

        for (let s = 0; s < data.list.size; s++) {
            const moves = data.list.get(s);
            if (!moves) continue;

            for (const v of moves) {
                const from = v.from;
                const to = v.to;
                const moveNode = gm.mapTitles[from.h][from.w];
                const toNode = gm.mapTitles[to.h][to.w];

                // 数据交换（保持你的逻辑）
                gm.mapTitles[to.h][to.w] = moveNode;
                gm.mapTitles[from.h][from.w] = toNode;
                moveNode.getComponent(GameBlock).setBlockPosition(to.h, to.w);
                toNode.getComponent(GameBlock).setBlockPosition(from.h, from.w);

                // 聚合：同一个 moveNode 只记录最终 to + 累计步数
                const rec = agg.get(moveNode) || { steps: 0, finalTo: to };
                rec.steps += 1;
                rec.finalTo = to;
                agg.set(moveNode, rec);
            }
        }

        // ===== 动画参数（可按策划口味调）=====
        const CELL = TitleSize;            // 每格像素
        const SPEED = 2200;                // px/s（等价于“常速”）
        const MIN_DUR = 0.08;              // 最短时长
        const MAX_DUR = 0.35;              // 最长时长（多格也不超过这个）
        const STAGGER_STEP = 0.03;         // 瀑布延迟（每步+）
        const STAGGER_MAX = 0.12;          // 瀑布延迟上限

        // 统一下发 tween（每个 Node 只 1 个）
        agg.forEach((rec, node) => {
            const x = rec.finalTo.w * CELL + 30 - (width / 2) * CELL;
            const y = -rec.finalTo.h * CELL - 30 + (height / 2) * CELL;

            // 垂直坍塌：位移≈steps * CELL；时间=距离/速度，并做上下限
            const dist = rec.steps * CELL;
            let dur = dist / SPEED;
            dur = Math.max(MIN_DUR, Math.min(MAX_DUR, dur)); // 速度保持基本一致，但多格有上限

            // 瀑布式错位，避免所有块同帧起跑
            const delay = data.delayTime + Math.min(rec.steps * STAGGER_STEP, STAGGER_MAX);

            node.getComponent(GameBlock).setSleepTime(delay + dur);
            cc.tween(node)
                .delay(delay)
                .to(dur, { position: cc.v3(x, y, 0) }, { easing: 'cubicOut' })
                .start();
        });
    }

    public static doAcion(data: {
        delayTime: number,
        list: Map<number, MoveInfoList>,
        moveX: number, moveY: number,
        accelX?: number, accelY?: number,
    }) {
        const gm = MapManager.getInstance();
        const width = gm.mapWidth;
        const height = gm.mapHeight;

        // 聚合最终落点
        const agg = new Map<cc.Node, { steps: number, finalTo: { h: number, w: number } }>();
        for (let s = 0; s < data.list.size; s++) {
            const moves = data.list.get(s);
            if (!moves) continue;
            for (const v of moves) {
                const from = v.from, to = v.to;
                const moveNode = gm.mapTitles[from.h][from.w];
                const toNode = gm.mapTitles[to.h][to.w];
                // 交换 & 标记
                gm.mapTitles[to.h][to.w] = moveNode;
                gm.mapTitles[from.h][from.w] = toNode;
                moveNode.getComponent(GameBlock).setBlockPosition(to.h, to.w);
                toNode.getComponent(GameBlock).setBlockPosition(from.h, from.w);

                const rec = agg.get(moveNode) || { steps: 0, finalTo: to };
                rec.steps += 1; rec.finalTo = to;
                agg.set(moveNode, rec);
            }
        }

        // ---- 动画参数（维持你的时长策略不变）----
        const CELL = TitleSize;
        const SPEED = 2200;         // px/s
        const MIN_DUR = 0.08;
        const MAX_DUR = 0.35;
        const STAGGER_STEP = 0.03;
        const STAGGER_MAX = 0.12;

        // 两轴加速度（px/s^2）
        const DEFAULT_ACCEL_X = 6800;
        const DEFAULT_ACCEL_Y = 6800;
        const AX_IN = Math.abs(data.accelX ?? DEFAULT_ACCEL_X);
        const AY_IN = Math.abs(data.accelY ?? DEFAULT_ACCEL_Y);

        // 生成“恒加速度”progress（按轴、按时长T动态计算K）
        const makeAccelProgress = (aAbs: number, dur: number) => {
            // eslint-disable-next-line @typescript-eslint/max-params
            return (start: number, end: number, _current: number, t: number) => {
                const d = end - start;
                if (Math.abs(d) < 1e-6) return start; // 几乎不动
                const a = Math.sign(d) * aAbs;        // 加速度与位移同向
                let K = 0.5 * a * dur * dur / d;      // 无量纲
                // 防止极端参数导致过冲/非单调
                if (K > 0.95) K = 0.95;
                if (K < -0.95) K = -0.95;
                const f = t + K * (t * t - t);
                return start + d * f;
            };
        };

        agg.forEach((rec, node) => {
            const tx = rec.finalTo.w * CELL + 30 - (width / 2) * CELL;
            const ty = -rec.finalTo.h * CELL - 30 + (height / 2) * CELL;

            // 距离→时长（按你的规则：多格更久，但限幅）
            const dist = rec.steps * CELL;
            let dur = dist / SPEED;
            dur = Math.max(MIN_DUR, Math.min(MAX_DUR, dur));

            const delay = data.delayTime + Math.min(rec.steps * STAGGER_STEP, STAGGER_MAX);

            node.getComponent(GameBlock).setSleepTime(delay + dur);

            // 两轴分别 tween，均用“恒加速度”progress
            const progX = makeAccelProgress(AX_IN, dur);
            const progY = makeAccelProgress(AY_IN, dur);

            cc.tween(node).delay(delay).to(dur, { x: tx }, { progress: progX }).start();
            cc.tween(node).delay(delay).to(dur, { y: ty }, { progress: progY })
                .call(() => node.setPosition(tx, ty)) // 兜底对齐
                .start();
        });
    }



    public static resetAllBlockSiblingIndex() {
        const gm = MapManager.getInstance();
        const h = MapManager.getInstance().mapHeight;
        const w = MapManager.getInstance().mapWidth;
        const gameBlock = GameManager.getInstance().gameBlock;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const moveNode = gm.mapTitles[y][x];
                const gameMap = gameBlock.getChildByName("map" + (y + 1));
                moveNode.setParent(gameMap);
                moveNode.setSiblingIndex(0);
            }
        }
    }

    //
    public static canCollapse(board: number[][], row: number, col: number): boolean {
        const id = board[row][col];

        switch (id) {
            case BlockIDs.Stone:
                return false;
            case BlockIDs.Ice:
            case BlockIDs.Ice2:
            case BlockIDs.Ice3:
                return false;
            case BlockIDs.Magnet:
                return false;
            case BlockIDs.Placeholder:
                return true;
            case BlockIDs.Random1:
            case BlockIDs.Random2:
            case BlockIDs.Random3:
            case BlockIDs.Random4:
                return true;
            case BlockIDs.Wooden:
            case BlockIDs.Green:
            case BlockIDs.Rocket:
            case BlockIDs.Grass:
            default://普通图块
                for (const v of dirsMagnet) {
                    const dir = v;
                    const x = col + dir.dx;
                    const y = row + dir.dy;
                    if (x < 0 || x >= board[0].length || y < 0 || y >= board.length) {
                        continue;
                    }

                    if (BlockIDs.Magnet == board[y][x]) {
                        return false;
                    }
                }
                return true;
        }
    }

    public static doActionRotate(delayTime: number, moves: MoveInfo[]) {

        const gm = MapManager.getInstance();
        const width = MapManager.getInstance().mapWidth;
        const height = MapManager.getInstance().mapHeight;
        //
        const end = moves[moves.length - 1].from;
        const endNode = gm.mapTitles[end.h][end.w];
        for (let i = 0; i < moves.length; i++) {
            const from = moves[i].from;
            const to = moves[i].to;
            let moveNode = gm.mapTitles[from.h][from.w];
            if (i == moves.length - 1) {//最后一个图块
                moveNode = endNode;
                gm.mapTitles[to.h][to.w] = moveNode;
                moveNode.getComponent(GameBlock).setBlockPosition(to.h, to.w);
            }
            else {
                const toNode = gm.mapTitles[to.h][to.w];
                gm.mapTitles[to.h][to.w] = moveNode;
                gm.mapTitles[from.h][from.w] = toNode;
                moveNode.getComponent(GameBlock).setBlockPosition(to.h, to.w);
                toNode.getComponent(GameBlock).setBlockPosition(from.h, from.w);
            }
            //
            const x = to.w * TitleSize + 30 - width / 2 * TitleSize;
            const y = -to.h * TitleSize - 30 + height / 2 * TitleSize;
            moveNode.getComponent(GameBlock).setSleepTime(delayTime);
            cc.tween(moveNode)
                .delay(delayTime)
                .to(0.2, { position: new cc.Vec3(x, y, 0) })
                .start();
        }


        setTimeout(() => {
            CollapseUtil.resetAllBlockSiblingIndex();
        }, 500);
    }

    public static isOnBorder(p: Pos, width: number, height: number): boolean {
        return (
            p.y === 0 || p.y === width - 1 ||
            p.x === 0 || p.x === height - 1
        );
    }

    public static isOnBorder4(p: Pos, w: number, h: number): boolean {
        const borderCoords: Pos[] = [];
        // 第一行
        for (let x = 1; x < w - 1; x++) borderCoords.push({ x, y: 1 });
        // 右侧
        for (let y = 1; y < h - 1; y++) borderCoords.push({ x: w - 2, y });
        // 底行（倒序）
        for (let x = w - 2; x >= 1; x--) borderCoords.push({ x, y: h - 2 });
        // 左侧（倒序，但不重复四角）
        for (let y = h - 2; y > 1; y--) borderCoords.push({ x: 1, y });

        return borderCoords.some(coord => coord.x === p.y && coord.y === p.x);
    }
    /**
     * 按 removed 位置做向下坍塌：将空位上方连续非零块依次下移填补空位
     * @param board   带边界的地图 board[y][x]
     * @param removed 刚被置 0 的图块坐标列表（已 +1 偏移，{ x: 列, y: 行 }）
     * @returns       从原点到目标点的移动列表
     */
    public static collapseDown(board: number[][], removed: Pos[], len = 0): Map<number, MoveInfoList> {
        const list: Map<number, MoveInfoList> = new Map<number, MoveInfoList>();

        let index = 0;

        for (const { x: col, y: row } of removed) {
            // 向下收集连续非零行，直到遇到空格或边界
            const rowsToShift: number[] = [];
            for (let d = col - 1; d >= len; d--) {
                if (!CollapseUtil.canCollapse(board, row, d)) break;
                rowsToShift.push(d);
            }

            if (rowsToShift.length == 0) {
                continue;
            }

            const moves: MoveInfoList = [];
            list.set(index, moves);
            index++;
            // 
            rowsToShift.forEach((sourceCol, idx) => {
                const targetCol = col - idx;  // 依次向下
                board[row][targetCol] = board[row][sourceCol];
                board[row][sourceCol] = 0;
                moves.push({
                    from: { w: row, h: sourceCol },
                    to: { w: row, h: targetCol }
                });
            });
        }

        return list;
    }
    /**
     * 按 removed 位置做向上坍塌：将空位上方连续非零块依次下移填补空位
     * @param board   带边界的地图 board[y][x]
     * @param removed 刚被置 0 的图块坐标列表（已 +1 偏移，{ x: 列, y: 行 }）
     * @returns       从原点到目标点的移动列表
     */
    public static collapseUp(board: number[][], removed: Pos[], len = board[0].length): Map<number, MoveInfoList> {
        const list: Map<number, MoveInfoList> = new Map<number, MoveInfoList>();

        let index = 0;

        for (const { x: col, y: row } of removed) {
            // 向下收集连续非零行，直到遇到空格或边界
            const rowsToShift: number[] = [];
            for (let d = col + 1; d < len; d++) {
                if (!CollapseUtil.canCollapse(board, row, d)) break;
                rowsToShift.push(d);
            }

            if (rowsToShift.length == 0) {
                continue;
            }

            const moves: MoveInfoList = [];
            list.set(index, moves);
            index++;
            // 第一个向上侧块填到 col，第二个填到 col+1，以此类推
            rowsToShift.forEach((sourceCol, idx) => {
                const targetCol = col + idx;  // 依次向上
                board[row][targetCol] = board[row][sourceCol];
                board[row][sourceCol] = 0;
                moves.push({
                    from: { w: row, h: sourceCol },
                    to: { w: row, h: targetCol }
                });
            });
        }

        return list;
    }
    /**
     * 按 removed 位置做向左坍塌：将空位右侧连续非零块依次左移填补空位
     * @param board   带边界的地图 board[y][x]
     * @param removed 刚被置 0 的图块坐标列表（已 +1 偏移，{ x: 列, y: 行 }）
     * @returns       从原点到目标点的移动列表
     */
    public static collapseLeft(board: number[][], removed: Pos[], len = board.length): Map<number, MoveInfoList> {
        const list: Map<number, MoveInfoList> = new Map<number, MoveInfoList>();

        let index = 0;
        for (const { x: col, y: row } of removed) {
            // 
            const rowsToShift: number[] = [];
            for (let r = row + 1; r < len; r++) {
                if (!CollapseUtil.canCollapse(board, r, col)) break;
                rowsToShift.push(r);
            }

            if (rowsToShift.length == 0) {
                continue;
            }

            const moves: MoveInfoList = [];
            list.set(index, moves);
            index++;

            //
            rowsToShift.forEach((sourceRow, idx) => {
                const targetRow = row + idx;  // 依次向左
                board[targetRow][col] = board[sourceRow][col];
                board[sourceRow][col] = 0;
                moves.push({
                    from: { w: sourceRow, h: col },
                    to: { w: targetRow, h: col }
                });
            });
        }

        return list;
    }
    /**
     * 按 removed 位置做向右坍塌：将空位右侧的连续非零块依次右移填补空位
     * @param board   带边界的地图 board[y][x]
     * @param removed 刚被置 0 的图块坐标列表（已 +1 偏移，{ x: 列, y: 行 }）
     * @returns       从原点到目标点的移动列表
     */
    public static collapseRight(board: number[][], removed: Pos[], len = 0): Map<number, MoveInfoList> {
        const list: Map<number, MoveInfoList> = new Map<number, MoveInfoList>();

        let index = 0;

        for (const { x: col, y: row } of removed) {
            // 向左收集连续非零列，直到遇到空格或边界
            const rowsToShift: number[] = [];
            for (let r = row - 1; r >= len; r--) {
                if (!CollapseUtil.canCollapse(board, r, col)) break;
                rowsToShift.push(r);
            }

            if (rowsToShift.length == 0) {
                continue;
            }

            const moves: MoveInfoList = [];
            list.set(index, moves);
            index++;
            // 第一个左侧块填到 col，第二个填到 col+1，以此类推
            rowsToShift.forEach((sourceRow, idx) => {
                const targetRow = row - idx;  // 依次向右
                board[targetRow][col] = board[sourceRow][col];
                board[sourceRow][col] = 0;
                moves.push({
                    from: { w: sourceRow, h: col },
                    to: { w: targetRow, h: col }
                });
            });
        }

        return list;
    }
}


