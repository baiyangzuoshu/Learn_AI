import { util } from '../../FrameWork/Utils/util';
import { TitleSize } from '../Constant';
import MapManager from '../Manager/MapManager';
import { Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';

import { CollapseUtil } from './CollapseUtil';

export class RightCollapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.RightCollapse(delayTime, rm);
    }

    RightCollapse(delayTime: number, removePos: Pos[]) {
        util.Log("RightCollapse", delayTime, removePos);
        const board: number[][] = MapManager.getInstance().getBoard();
        const moveX = TitleSize;
        const moveY = 0;
        removePos.sort((a, b) => {
            return a.y - b.y;
        })
        //向右坍塌遇到大于0的图块，停止
        const newArr: Pos[] = [];

        const h = board.length;
        for (const v of removePos) {
            const startX = v.x;
            const startY = v.y + 1;
            for (let y = startY; y < h; y++) {
                if (board[y][startX] > 0) {
                    break;
                }
                //判断是否重复在removePos
                const tag1 = removePos.find((item) => {
                    if (item.x == startX && item.y == y) {
                        return true;
                    }
                })
                const tag2 = newArr.find((item) => {
                    if (item.x == startX && item.y == y) {
                        return true;
                    }
                })
                if (!tag1 && !tag2) {
                    newArr.push({ x: startX, y: y });
                }
            }
        }

        for (const v of newArr) {
            removePos.push(v);
        }

        removePos.sort((a, b) => {
            return a.y - b.y;
        })

        const list = CollapseUtil.collapseRight(board, removePos);
        CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
    }
}


