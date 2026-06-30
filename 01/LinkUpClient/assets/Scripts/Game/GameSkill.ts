import { util } from '../../FrameWork/Utils/util';
import { BlockIDs, dirs } from '../Constant';
import { BlockManager } from '../Manager/BlockManager';
import GameManager from '../Manager/GameManager';
import MapManager from '../Manager/MapManager';
import { Pos } from '../types';
import { GameBlock } from './GameBlock';

export class GameSkill extends cc.Component {
    /**
     * 找到任意一对可消除的图块，返回它们的逻辑坐标（已 +1 边界偏移），找不到返回空数组
     */
    public findAnyMatch(rawBoard: number[][]): Pos[] {
        // 1) 加边界支持绕边
        const board = util.addBorder(rawBoard);
        const h = board.length, w = board[0].length;

        // 2) 按类型分组
        const map = new Map<number, Pos[]>();
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const t = board[y][x];
                const tile = MapManager.getInstance().mapTitles[x - 1][y - 1];
                const type = tile.getComponent(GameBlock).getBaseData().type;
                if (type == BlockIDs.Green || type == BlockIDs.Grass) {
                    continue;
                }

                if (t > 0 && t <= BlockIDs.None) {
                    if (!map.has(t)) map.set(t, []);
                    const positions = map.get(t);
                    if (positions) {
                        positions.push({ x, y });
                    }
                }
            }
        }

        // 3) 暴搜：找到第一对可连通就返回
        const values = Array.from(map.values());
        for (const arr of values) {
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    if (util.canConnectPath(board, arr[i], arr[j]).length > 0) {
                        return [arr[i], arr[j]];
                    }
                }
            }
        }

        return [];
    }
    /**
     * 按照指定算法重列剩余图块
     * @param rawBoard   原始 board[y][x]，0 表示已消除或空格
     */
    public reshuffleRemaining(rawBoard: number[][]): number[][] {
        const height = rawBoard.length;
        const width = rawBoard[0].length;
        // 1) 收集所有剩余普通块的位置 & 类型
        const empties: Pos[] = [];
        const pools: number[] = [];

        let isRocket = false;
        const mapTitles = MapManager.getInstance().mapTitles;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const id = rawBoard[y][x];
                const tile = mapTitles[x][y];
                const type = tile.getComponent(GameBlock).getBaseData().type;

                if (type == BlockIDs.Placeholder) {
                    continue;
                }

                if (id > 0 && id <= BlockIDs.None) {
                    empties.push({ x, y });
                    pools.push(id);
                    rawBoard[y][x] = 0;
                    if (id == BlockIDs.RK) {
                        isRocket = true;
                    }

                }
            }
        }
        /*
      关卡刷新逻辑；
      分3种情况
        1） 剩余对数大于等于39对（80%）时，用户使用刷新，刷新成对的对数为（当前关卡初始成对数/本局总对数*当前剩余对数），并向上取整
        2）剩余对数∈（4，38），概率为策划配表，当用户本局内第一次使用刷新时，配表1概率；当用户第二次使用刷新时，
        配表2概率；刷新后初始成对数=配置概率*当前剩余对数  往上取整
        3）剩余对数<=3 或 刷新三次后，障碍物消失，配置概率为66%
       */
        // 2) 计算当前对数 linkCount
        let linkCount = 3;
        if (pools.length < 4 || 3 <= GameManager.getInstance().reshuffleCount) {
            linkCount = Math.ceil(66 / 100 * pools.length / 2);
            util.Log("3linkCount=", linkCount, pools.length / 2);
        }
        else if (pools.length >= (width * height * 0.8)) {
            linkCount = Math.ceil(GameManager.getInstance().linkCount / (width * height / 2) * pools.length / 2);
            util.Log("0linkCount=", linkCount, pools.length / 2);
        }
        else {
            if (pools.length >= 4 && 1 == GameManager.getInstance().reshuffleCount) {
                linkCount = Math.ceil(GameManager.getInstance().refreshRate1 / 100 * pools.length / 2);
                util.Log("1linkCount=", linkCount, pools.length / 2);
            }
            else if (pools.length >= 4 && 2 == GameManager.getInstance().reshuffleCount) {
                linkCount = Math.ceil(GameManager.getInstance().refreshRate2 / 100 * pools.length / 2);
                util.Log("2linkCount=", linkCount, pools.length / 2);
            }
        }

        // 3) 随机放置 minPairs 对“可消除对”：
        const newBoard = rawBoard.map(row => row.slice());

        //从 pools 中随机抽一个剩余 >=2 张的 id
        function drawPairID(curPools: number[]): number | null {
            // 统计每个 id 剩余张数
            const cntMap = new Map<number, number>();
            for (const id of curPools) cntMap.set(id, (cntMap.get(id) || 0) + 1);
            // 过滤出剩余 >=2 的 id
            const candidates = Array.from(cntMap.entries())
                .filter(([, c]) => c >= 2)
                .map(([id]) => id);
            if (candidates.length === 0) return null;
            // 随机选一个
            const id = candidates[Math.floor(Math.random() * candidates.length)];

            return id;
        }
        // 4 阶段 1：生成 linkCount 对
        let count = 0;
        const total = linkCount;
        while (linkCount > 0 && count < total * 10) {
            count++;
            if (empties.length == 0) break;
            //随机空位
            const index = Math.floor(Math.random() * empties.length);
            const pos = empties[index];
            //空位四周方向
            const DIRS = [...dirs];
            while (DIRS.length > 0) {
                const i = Math.floor(Math.random() * DIRS.length);
                const dir = DIRS[i];
                DIRS.splice(i, 1);

                const dirX = dir.dx + pos.x;
                const dirY = dir.dy + pos.y;
                if (dirX < 0 || dirX >= width || dirY < 0 || dirY >= height) continue;
                if (newBoard[dirY][dirX] > 0) continue;

                //获取成对id
                let id = drawPairID(pools);
                if (isRocket) {
                    id = BlockIDs.RK;
                    isRocket = false;
                }

                if (id == null) continue;
                //刷新当前图块，有可能处在周围是封闭区域
                let hasPos = false;
                for (let i = 0; i < empties.length; i++) {
                    if (empties[i].x == dirX && empties[i].y == dirY) {
                        empties.splice(i, 1);
                        hasPos = true;
                        break;
                    }
                }

                if (!hasPos) continue;

                for (let i = 0; i < empties.length; i++) {
                    if (empties[i].x == pos.x && empties[i].y == pos.y) {
                        empties.splice(i, 1);
                        break;
                    }
                }
                //设置成对id
                newBoard[pos.y][pos.x] = id;
                newBoard[dirY][dirX] = id;

                // 从 pools 中删两次
                for (let k = 0; k < 2; k++) {
                    const idx = pools.indexOf(id);
                    pools.splice(idx, 1);
                }
                linkCount--;
                count = 0;
                break;
            }
        }
        //5 阶段 2：给 剩余grid 四边填充，保证四边没有可消除对
        function generateID(board: number[][], curPools: number[], pos: Pos) {
            const h = board.length;
            const w = board[0].length;
            const t = board[pos.y][pos.x];
            if (t > 0) return;
            let hasPos = false;
            for (let i = 0; i < empties.length; i++) {
                if (empties[i].x == pos.x && empties[i].y == pos.y) {
                    empties.splice(i, 1);
                    hasPos = true;
                    break;
                }
            }
            if (!hasPos) return;

            BlockManager.getInstance().generateID({ grid: newBoard, pos: pos, pools: curPools, width: w, height: h });
        }

        let isSkip = false;
        do {
            // 第一行
            for (let x = 0; x < width; x++) {
                const pos = { x, y: 0 }
                generateID(newBoard, pools, pos);
            }
            // 右侧
            for (let y = 1; y < height; y++) {
                const pos = { x: width - 1, y }
                generateID(newBoard, pools, pos);
            }
            // 底行（倒序）
            for (let x = width - 2; x >= 0; x--) {
                const pos = { x, y: height - 1 }
                generateID(newBoard, pools, pos);
            }
            // 左侧（倒序，但不重复四角）
            for (let y = height - 2; y > 0; y--) {
                const pos = { x: 0, y }
                generateID(newBoard, pools, pos);
            }
            isSkip = true;
        } while (!isSkip)
        //6 阶段 3：余下格子填充，排除四邻 id
        while (empties.length > 0) {
            const index = Math.floor(Math.random() * empties.length);
            const pos = empties[index];
            empties.splice(index, 1);

            BlockManager.getInstance().generateID({ grid: newBoard, pos: pos, pools: pools, width: width, height: height });
        }

        return newBoard;
    }
}

