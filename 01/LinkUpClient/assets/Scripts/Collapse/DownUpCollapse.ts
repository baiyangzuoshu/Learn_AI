import { util } from '../../FrameWork/Utils/util';
import { TitleSize } from '../Constant';
import MapManager from '../Manager/MapManager';
import { Pos } from '../types';
import type { CollapseStrategy } from './CollapseStrategy';
import { CollapseUtil } from './CollapseUtil';

export class DownUpCollapse implements CollapseStrategy {
    collapse(delayTime: number, rm: Pos[]) {
        this.DownUpCollapse(delayTime, rm);
    }

    DownUpCollapse(delayTime: number, removePos: Pos[]) {
        const board: number[][] = MapManager.getInstance().getBoard();
        const moveX = 0;
        let moveY = 0;
        //判断两个图块是在h/2上面还是下面
        const height = MapManager.getInstance().mapHeight / 2;
        const down: Pos[] = [];
        const up: Pos[] = [];
        for (const v of removePos) {
            if (v.x < height) {
                down.push(v);
            }
            else if (v.x >= height) {
                up.push(v);
            }
        }
        //
        const w = board[0].length;
        if (down.length > 0) {
            down.sort((a, b) => {
                return a.x - b.x;
            })
            //向下坍塌遇到大于0的图块，停止
            const newArr: Pos[] = [];

            //const h = board.length;
            for (const v of down) {
                const startX = v.x + 1;
                const startY = v.y;
                for (let x = startX; x < w / 2; x++) {
                    util.Log(x, startY, board[startY][x]);
                    if (board[startY][x] > 0) {
                        break;
                    }
                    //判断是否重复在down
                    const tag1 = down.find((item) => {
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
                down.push(v);
            }

            down.sort((a, b) => {
                return a.x - b.x;
            })
            util.Log("down", down);
            moveY = -TitleSize;
            const list = CollapseUtil.collapseDown(board, down);
            //
            CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
        }

        if (up.length > 0) {
            up.sort((a, b) => {
                return b.x - a.x;
            })
            //向上坍塌遇到大于0的图块，停止
            const newArr: Pos[] = [];

            for (const v of up) {
                const startX = v.x - 1;
                const startY = v.y;

                for (let x = startX; x >= w / 2; x--) {
                    if (board[startY][x] > 0) {
                        break;
                    }
                    //判断是否重复在up
                    const tag1 = up.find((item) => {
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
                up.push(v);
            }
            up.sort((a, b) => {
                return b.x - a.x;
            })
            moveY = TitleSize;
            const list = CollapseUtil.collapseUp(board, up);
            //
            CollapseUtil.doAcion({ delayTime, list, moveX, moveY });
        }
    }

}


