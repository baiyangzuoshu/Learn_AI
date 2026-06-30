import { TitleSize } from '../Constant';
import MapManager from '../Manager/MapManager';
import { Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';
import { CollapseUtil } from './CollapseUtil';

export class LeftRightCollapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.LeftRightCollapse(delayTime, rm);
    }

    LeftRightCollapse(delayTime: number, removePos: Pos[]) {
        const board: number[][] = MapManager.getInstance().getBoard();
        let moveX = 0;
        const moveY = 0;
        //判断两个图块是在w/2左还是右
        const width = MapManager.getInstance().mapWidth / 2;

        const left: Pos[] = [];
        const right: Pos[] = [];
        for (const v of removePos) {
            if (v.y < width) {
                left.push(v);
            }
            else if (v.y >= width) {
                right.push(v);
            }
        }
        //
        if (left.length > 0) {
            left.sort((a, b) => {
                return b.y - a.y;
            })//向左坍塌遇到大于0的图块，停止
            const newArr: Pos[] = [];

            for (const v of left) {
                const startX = v.x;
                const startY = v.y - 1;
                for (let y = startY; y >= 0; y--) {
                    if (board[y][startX] > 0) {
                        break;
                    }
                    //判断是否重复在left
                    const tag1 = left.find((item) => {
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
                left.push(v);
            }

            left.sort((a, b) => {
                return b.y - a.y;
            })
            moveX = -TitleSize;
            const list = CollapseUtil.collapseLeft(board, left, width);
            CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
        }
        //
        if (right.length > 0) {
            right.sort((a, b) => {
                return a.y - b.y;
            })
            //向右坍塌遇到大于0的图块，停止
            const newArr: Pos[] = [];

            const h = board.length;
            for (const v of right) {
                const startX = v.x;
                const startY = v.y + 1;
                for (let y = startY; y < h; y++) {
                    if (board[y][startX] > 0) {
                        break;
                    }
                    //判断是否重复在right
                    const tag1 = right.find((item) => {
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
                right.push(v);
            }

            right.sort((a, b) => {
                return a.y - b.y;
            })
            moveX = TitleSize;
            const list = CollapseUtil.collapseRight(board, right, width);

            CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
        }
    }
}


