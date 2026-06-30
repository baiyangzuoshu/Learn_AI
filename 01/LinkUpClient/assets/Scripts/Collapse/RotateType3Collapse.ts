import { util } from '../../FrameWork/Utils/util';
import MapManager from '../Manager/MapManager';
import type { MoveInfo, Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';
import { CollapseUtil } from './CollapseUtil';

export class RotateType3Collapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.RotateType3Collapse(delayTime, rm);
    }
    /**
     * 双中间环坍塌：
     * - 内环逆时针
     * - 外环顺时针
     * 只有当 removePos 中有落在某环的坐标，才对该环调用 rotateLoop。
     */
    private RotateType3Collapse(delayTime: number, removePos: Pos[]) {
        const gm = MapManager.getInstance();

        const board = gm.getBoard(); // y×x 原始数据，不含边界
        const w = gm.mapWidth, h = gm.mapHeight;
        // 拿到中间的内外两条环路
        const [innerLoop, outerLoop] = this.getMiddleLoops(w, h);

        // 看 removePos 里有没有落在环路上的点
        const hitInner = false;//removePos.some(p => innerLoop.some(q => q.x === p.x && q.y === p.y));
        const hitOuter = removePos.some(p => outerLoop.some(q => q.x === p.x && q.y === p.y));
        // 钻石轨道（innerLoop） → 逆时针
        if (hitInner) {
            const moves: MoveInfo[] = [];
            moves.push(... this.rotateLoop(board, innerLoop, /*cw=*/false));
            CollapseUtil.doActionRotate(delayTime, moves);

        }
        // 火箭轨道（outerLoop） → 顺时针
        if (hitOuter) {
            const moves: MoveInfo[] = [];
            moves.push(... this.rotateLoop(board, outerLoop, /*cw=*/true));
            CollapseUtil.doActionRotate(delayTime, moves);

        }
    }
    /**
     * 将指定的一条环路绕中心旋转一格
     * @param board 原始 board[y][x]
     * @param coords 要旋转的环路坐标数组，按环路顺序（顺时针或逆时针）排列
     * @param cw     true=顺时针移动一格，false=逆时针移动一格
     * @returns      一组 MoveInfo，用于 UI 动画
     */
    private rotateLoop(board: number[][], coords: Pos[], cw: boolean
    ): MoveInfo[] {
        const borderCoords: Pos[] = [];
        if (cw) {
            for (let i = coords.length - 1; i >= 0; i--) {
                borderCoords.push(coords[i]);
            }
        }
        else {
            for (const v of coords) {
                borderCoords.push(v);
            }
        }
        // 读取原始类型
        const types = borderCoords.map(({ x, y }) => board[y][x]);
        // 顺时针右移一格
        const rotated = [types[types.length - 1], ...types.slice(0, -1)];
        // 写回并记录移动
        const moves: MoveInfo[] = [];
        borderCoords.forEach((coord, i) => {
            const from = {
                h: borderCoords[(i + 1) % borderCoords.length].x,
                w: borderCoords[(i + 1) % borderCoords.length].y
            };
            const to = { h: coord.x, w: coord.y };

            board[to.w][to.h] = rotated[i];
            moves.push({ from, to });
        });
        return moves;
    }
    /**
    * 取出“中间两条环路”的坐标列表
    * @param w 地图宽度
    * @param h 地图高度
    * @returns [内环Coords, 外环Coords]
    */
    private getMiddleLoops(w: number, h: number): [Pos[], Pos[]] {
        const midX = Math.floor(w / 2);
        const midY = Math.floor(h / 2);
        util.Log(w, h);
        util.Log(midX, midY);
        // 定义偏移：内环半宽半高
        const dx1 = Math.floor((w - 4) / 2) - 1;
        const dy1 = Math.floor((h - 4) / 2);
        util.Log("定义偏移：内环半宽半高", dx1, dy1);
        // 外环比内环再扩1
        const dx2 = dx1 - 1;
        const dy2 = dy1 - 1;
        util.Log("定义偏移：外环半宽半高", dx2, dy2);

        const makeLoop = (dx: number, dy: number): Pos[] => {
            const loop: Pos[] = [];
            // 上边
            for (let x = dx; x < w - dx; x++) {
                loop.push({ x: dy, y: x });
            }
            // 右边
            for (let y = dy + 1; y < h - dy; y++) {
                loop.push({ x: y, y: w - dx - 1 });
            }
            // 下边
            for (let x = w - dx - 2; x >= dx + 1; x--) {
                loop.push({ x: h - dy - 1, y: x });
            }
            // 左边
            for (let y = h - dy - 1; y >= dy + 1; y--) {
                loop.push({ x: y, y: dx });
            }
            return loop;
        };

        return [makeLoop(dx1, dy1), makeLoop(dx2, dy2)];
    }
}


