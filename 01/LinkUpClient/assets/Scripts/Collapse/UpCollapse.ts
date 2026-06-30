import { TitleSize } from '../Constant';
import MapManager from '../Manager/MapManager';
import { Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';
import { CollapseUtil } from './CollapseUtil';

export class UpCollapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.UpCollapse(delayTime, rm);
    }

    UpCollapse(delayTime: number, removePos: Pos[]) {
        const board: number[][] = MapManager.getInstance().getBoard();
        const moveX = 0;
        const moveY = TitleSize;
        removePos.sort((a, b) => {
            return b.x - a.x;
        })
        //向上坍塌遇到大于0的图块，停止
        const newArr: Pos[] = [];
        for (const v of removePos) {
            const startX = v.x - 1;
            const startY = v.y;
            for (let x = startX; x >= 0; x--) {
                if (board[startY][x] > 0) {
                    break;
                }
                //判断是否重复在removePos
                const tag1 = removePos.find((item) => {
                    if (item.x == x && item.y == startY) {
                        return true;
                    }
                })
                const tag2 = newArr.find((item) => {
                    if (item.x == x && item.y == startY) {
                        return true;
                    }
                })
                if (!tag1 && !tag2) {
                    newArr.push({ x: x, y: startY });
                }
            }
        }

        for (const v of newArr) {
            removePos.push(v);
        }
        removePos.sort((a, b) => {
            return b.x - a.x;
        })
        const list = CollapseUtil.collapseUp(board, removePos);
        CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
    }
}


