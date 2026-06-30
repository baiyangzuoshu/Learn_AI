import { util } from '../../FrameWork/Utils/util';
import { BlockIDs, dirs } from '../Constant';
import { GameBlock } from '../Game/GameBlock';
import { Block, Pos } from '../types';
import MapManager from './MapManager';

export class BlockManager {
    private static instance: BlockManager;

    public static getInstance() {
        if (!BlockManager.instance) {
            BlockManager.instance = new BlockManager();
        }
        return BlockManager.instance;
    }

    /**
     * 生成随机id
     * @param grid  图块地图 (二维数组)
     * @param pos     位置 {x, y}
     * @param curPools  池子
     */
    generateID(data: { grid: number[][], pos: Pos, pools: number[], width: number, height: number }) {
        const { grid, pos, pools, width, height } = data;
        //获取上下左右方向id
        const ids = [];
        for (const dir of dirs) {
            const dirX = dir.dx + pos.x;
            const dirY = dir.dy + pos.y;
            if (dirX < 0 || dirX >= width || dirY < 0 || dirY >= height) continue;

            const id = grid[dirY][dirX];
            if (id == 0) continue;

            ids.push(id);
        }
        // 第一行
        if (pos.y == 0) {
            for (let x = 0; x < width; x++) {
                const pos = { x, y: 0 }
                const id = grid[pos.y][pos.x];
                if (id == 0) continue;
                ids.push(id);
            }
        }
        if (pos.x == width - 1) {// 右侧
            for (let y = 1; y < height; y++) {
                const pos = { x: width - 1, y }
                const id = grid[pos.y][pos.x];
                if (id == 0) continue;
                ids.push(id);
            }
        }
        if (pos.y == height - 1) { // 底行（倒序）
            for (let x = width - 2; x >= 0; x--) {
                const pos = { x, y: height - 1 }
                const id = grid[pos.y][pos.x];
                if (id == 0) continue;
                ids.push(id);
            }
        }
        if (0 == pos.x) {// 左侧（倒序，但不重复四角）
            for (let y = height - 2; y > 0; y--) {
                const pos = { x: 0, y }
                const id = grid[pos.y][pos.x];
                if (id == 0) continue;
                ids.push(id);
            }
        }
        //
        const randomIDS = [];
        for (const v of pools) {
            const index = ids.indexOf(v)
            if (index < 0) {
                randomIDS.push(v);
            }
        }
        // 没有四邻id，就全部加入
        if (randomIDS.length == 0) {
            randomIDS.push(...pools);
            util.Log("没有四邻id，就全部加入", pools);
        }
        const index = Math.floor(Math.random() * randomIDS.length);
        const id = randomIDS[index];
        grid[pos.y][pos.x] = id;

        pools.splice(pools.indexOf(id), 1);
    }
    /**
     * 第二版随机生成算法
     * @param width   棋盘宽
     * @param height  棋盘高
     * @param scheme  如 [10,2,2]  = 14 种
     * @param link    需要制造的直接相邻对数
     * @param tileTypes 图块总种类数（如27）
     * @param presets   已固定的图块列表（x:列,y:行）
     * @returns         width×height 的完整 grid，每格都是 1…tileTypes 对应的 type
     */
    public generateGridV2(data: { width: number, height: number, tileTypes: number, presets: Block[], linkCount: number, scheme: number[] }): number[][] {
        const { width, height, tileTypes, presets, scheme, linkCount } = data;
        util.Log("generateGridV2:", width, height, tileTypes, presets, scheme, linkCount);
        // 1. 初始化空网格（0 表示待填充）
        const grid: number[][] = Array.from({ length: height }, () =>
            new Array(width).fill(0)
        );
        util.Log("图块总数量:" + width * height);
        util.Log("预设图块数量", presets.length);
        // 2. 把预设图块写入
        for (const p of presets) {
            grid[p.y][p.x] = p.id;
        }
        // 用来记录哪些类型是由 presets 固定的
        const usedCount = [];
        for (let i = 0; i < tileTypes + 1; i++) {
            usedCount[i] = 0;
        }
        //const usedCount = new Array(tileTypes + 1).fill(0); // type 从 1 开始
        for (const p of presets) {
            usedCount[p.id] += 1;
        }
        // 3. 确定哪些类型可以用于随机分配：排除所有在 presets 中出现的类型
        const eligible = [];
        for (let t = 1; t <= tileTypes; t++) {
            if (usedCount[t] === 0) eligible.push(t);
        }
        // 如果所有类型都被 presets 占用了，则退回到全部类型随机
        const poolTypes = eligible.length > 0 ? eligible : Array.from({ length: tileTypes }, (_, i) => i + 1);
        //4.统计图块种类
        const types = [];
        const midTypes = [];
        for (const id of poolTypes) {
            types.push(id);
            midTypes.push(id);
        }
        //5.生成池子
        const pools: number[] = [];
        //[6,10,10]
        for (let i = 0; i < scheme.length; i++) {
            const count = scheme[i];
            if (count <= 0) continue;

            for (let z = 0; z < count; z++) {
                const remaining = i + 1;//成对的对数
                const index = Math.floor(Math.random() * types.length);
                const t = types[index];
                types.splice(index, 1);
                for (let j = 0; j < remaining * 2; j++) {
                    pools.push(t);
                }
            }
        }
        util.Log("池子总数", pools.length);

        //从 pools 中随机抽一个剩余 >=2 张的 id，并移除 2 张
        function drawPairID(): number | null {
            // 统计每个 id 剩余张数
            const cntMap = new Map<number, number>();
            for (const id of pools) cntMap.set(id, (cntMap.get(id) || 0) + 1);
            // 过滤出剩余 >=2 的 id
            const candidates = Array.from(cntMap.entries())
                .filter(([, c]) => c >= 2)
                .map(([id]) => id);
            if (candidates.length === 0) return null;
            // 随机选一个
            const id = candidates[Math.floor(Math.random() * candidates.length)];

            return id;
        }
        // 6 阶段 1：生成 linkCount 对
        let count = 0;
        const total = data.linkCount;
        while (data.linkCount > 0 && count < total * 10) {
            count++;
            //统计空位
            const empties: Pos[] = [];
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const t = grid[y][x];
                    if (t > 0) continue;
                    empties.push({ x, y });
                }
            }
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
                if (grid[dirY][dirX] > 0) continue;

                //获取成对id
                const id = drawPairID();
                if (id == null) continue;
                //有可能处在周围是封闭区域
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
                grid[pos.y][pos.x] = id;
                grid[dirY][dirX] = id;

                // 从 pools 中删两次
                for (let k = 0; k < 2; k++) {
                    const idx = pools.indexOf(id);
                    pools.splice(idx, 1);
                }
                data.linkCount--;
                count = 0;
                break;
            }
        }

        //7 阶段 2：给 剩余grid 四边填充，保证四边没有可消除对
        let isSkip = false;
        do {
            // 第一行
            for (let x = 0; x < width; x++) {
                const pos = { x, y: 0 }
                const t = grid[pos.y][pos.x];
                if (t > 0) continue;
                this.generateID({ grid: grid, pos: pos, pools: pools, width: width, height: height });
            }
            // 右侧
            for (let y = 1; y < height; y++) {
                const pos = { x: width - 1, y }
                const t = grid[pos.y][pos.x];
                if (t > 0) continue;
                this.generateID({ grid: grid, pos: pos, pools: pools, width: width, height: height });

            }
            // 底行（倒序）
            for (let x = width - 2; x >= 0; x--) {
                const pos = { x, y: height - 1 }
                const t = grid[pos.y][pos.x];
                if (t > 0) continue;
                this.generateID({ grid: grid, pos: pos, pools: pools, width: width, height: height });
            }
            // 左侧（倒序，但不重复四角）
            for (let y = height - 2; y > 0; y--) {
                const pos = { x: 0, y }
                const t = grid[pos.y][pos.x];
                if (t > 0) continue;
                this.generateID({ grid: grid, pos: pos, pools: pools, width: width, height: height });
            }
            isSkip = true;
        } while (!isSkip)
        //8 阶段 3：余下格子填充，排除四邻 id
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const t = grid[y][x];
                if (t > 0) continue;
                this.generateID({ grid: grid, pos: { x, y }, pools: pools, width: width, height: height });
            }
        }
        return grid;
    }
    /**
     * 判断当前棋盘是否死局（无可消除对）
     * @param rawBoard 原始 board[y][x]，0 表示空
     */
    isDeadlock(rawBoard: number[][]): boolean {
        // 1) 加边界，支持绕边连接
        const board = util.addBorder(rawBoard);
        const h = board.length;
        const w = board[0].length;
        const posMap = new Map<number, { x: number, y: number }[]>();

        // 2) 收集所有图块坐标（跳过边界和空格）
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const t = board[y][x];
                const tile = MapManager.getInstance().mapTitles[x - 1][y - 1];
                const type = tile.getComponent(GameBlock).getBaseData().type;
                if (type == BlockIDs.Green || type == BlockIDs.Grass) {
                    continue;
                }

                if (t > 0 && t < BlockIDs.None) {
                    if (!posMap.has(t)) posMap.set(t, []);
                    const positions = posMap.get(t);
                    if (positions) {
                        positions.push({ x, y });
                    }
                }
            }
        }

        // 3) 对每种类型暴搜配对
        const values = Array.from(posMap.values());
        for (const arr of values) {
            const n = arr.length;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    // 如果能连通，则不是死局
                    if (util.canConnectPath(board, arr[i], arr[j]).length > 0) {
                        return false;
                    }
                }
            }
        }

        // 4) 所有组合都不可连通，则死局
        return true;
    }
    // 从 board[y][x] 中随机挑选 n 对可消除的图块（同类型两两）
    // 返回一个长度为 n*2 的 Pos 数组，表示要删除的所有格子坐标
    public selectRandomPairs(rawBoard: number[][], pairCount: number): Pos[] {
        // 1) 收集每种类型的所有坐标
        const h = rawBoard.length, w = rawBoard[0].length;
        const map = new Map<number, Pos[]>();
        const mapTitles = MapManager.getInstance().mapTitles;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = rawBoard[y][x];
                const tile = mapTitles[x][y];
                const type = tile.getComponent(GameBlock).getBaseData().type;
                if (type == BlockIDs.Green || type == BlockIDs.Grass || type == BlockIDs.Placeholder) {
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

        const chosen: Pos[] = [];
        const types = Array.from(map.keys());
        // 1) 先从类型中移除 RK
        const rkIndex = types.indexOf(BlockIDs.RK);
        if (rkIndex >= 0) {
            types.splice(rkIndex, 1);
        }

        // 2) 随机选择 pairCount 种类型（可重复选同一种，或根据需求去重）
        while (chosen.length < pairCount * 2 && types.length) {
            // 随机选一个类型
            const ti = Math.floor(Math.random() * types.length);
            const t = types[ti];
            const arr = map.get(t);
            if (!arr) {
                types.splice(ti, 1);
                continue;
            }

            // 如果这一类型剩余少于 2，则剔除
            if (arr.length < 2) {
                types.splice(ti, 1);
                continue;
            }

            // 随机选两个不同位置
            const idx1 = Math.floor(Math.random() * arr.length);
            let idx2 = Math.floor(Math.random() * (arr.length - 1));
            if (idx2 >= idx1) idx2++;

            const p1 = arr.splice(idx1, 1)[0];
            const p2 = arr.splice(idx2 > idx1 ? idx2 - 1 : idx2, 1)[0];

            chosen.push(p1, p2);

            // 如果这一类型再不足 2，就从 pool 中移除
            if (arr.length < 2) types.splice(ti, 1);
        }

        return chosen;
    }
    /**
     * 找出当前 board 上所有可消除的图块对
     * @param rawBoard 逻辑棋盘，不带边界，0=空格
     * @returns  [[Pos,Pos], [Pos,Pos], ...]
     */
    public findAllMatches(rawBoard: number[][]): [Pos, Pos][] {
        const h = rawBoard.length;
        const w = rawBoard[0].length;

        const matches: [Pos, Pos][] = [];

        // 1) 包一圈边界，方便路径搜索
        const board = util.addBorder(rawBoard);
        const mapTitles = MapManager.getInstance().mapTitles;
        // 2) 遍历所有位置
        for (let y1 = 0; y1 < h; y1++) {
            for (let x1 = 0; x1 < w; x1++) {
                const id1 = rawBoard[y1][x1];
                if (id1 <= 0 || id1 > BlockIDs.None) continue; // 空格
                const tile1 = mapTitles[x1][y1];
                const type1 = tile1.getComponent(GameBlock).getBaseData().type;
                if (type1 == BlockIDs.Green || type1 == BlockIDs.Grass) {
                    continue;
                }

                for (let y2 = 0; y2 < h; y2++) {
                    for (let x2 = 0; x2 < w; x2++) {
                        const id2 = rawBoard[y2][x2];
                        if (id2 <= 0 || id2 > BlockIDs.None) continue;
                        if (id1 !== id2) continue; // 必须同类型
                        if (x1 === x2 && y1 === y2) continue;
                        const tile2 = mapTitles[x2][y2];
                        const type2 = tile2.getComponent(GameBlock).getBaseData().type;
                        if (type2 == BlockIDs.Green || type2 == BlockIDs.Grass) {
                            continue;
                        }
                        // 3) 检查连通
                        const path = util.canConnectPath(
                            board,
                            { x: x1 + 1, y: y1 + 1 }, // 加边界
                            { x: x2 + 1, y: y2 + 1 }
                        );
                        if (path.length > 0) {
                            matches.push([
                                { x: x1, y: y1 },
                                { x: x2, y: y2 }
                            ]);
                        }
                    }
                }
            }
        }

        return matches;
    }
}


