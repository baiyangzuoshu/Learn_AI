import MapManager from '../Manager/MapManager';
import type { MoveInfo, Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';
import { CollapseUtil } from './CollapseUtil';

export class RotateType4Collapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.RotateType4Collapse(delayTime, rm);
    }

    RotateType4Collapse(delayTime: number, removePos: Pos[]) {
        const board: number[][] = MapManager.getInstance().getBoard();
        const w = MapManager.getInstance().mapWidth;
        const h = MapManager.getInstance().mapHeight;
        removePos.sort((a, b) => {
            return a.x - b.x;
        })
        if (removePos.some(p => CollapseUtil.isOnBorder4(p, w, h))) {
            const borderMoves = this.rotateBorder(board);
            // 将 borderMoves 也加入 UI 动画队列
            CollapseUtil.doActionRotate(delayTime, borderMoves);
        }
    }
    /**
     * 对最外围再往里一层图块做一次顺时针环绕
     * @param board  原始 board[y][x]
     * @returns      MoveInfo[] 列表，用于 UI 动画
     */
    private rotateBorder(board: number[][]): MoveInfo[] {
        const h = board.length;
        const w = board[0].length;
        const borderCoords: Pos[] = [];
        // 第一行
        for (let x = 1; x < w - 1; x++) borderCoords.push({ x, y: 1 });
        // 右侧
        for (let y = 1; y < h - 1; y++) borderCoords.push({ x: w - 2, y });
        // 底行（倒序）
        for (let x = w - 2; x >= 1; x--) borderCoords.push({ x, y: h - 2 });
        // 左侧（倒序，但不重复四角）
        for (let y = h - 2; y > 1; y--) borderCoords.push({ x: 1, y });

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
}


