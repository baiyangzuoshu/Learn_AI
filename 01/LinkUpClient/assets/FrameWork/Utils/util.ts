
import { TitleSize } from "../../Scripts/Constant";
import { type CaseMode, Pos, ShareMapData } from "../../Scripts/types";
import { __HLDDZ_APP__, __HLDDZ_CP_DEV__ } from "../../sdk/hlddz-sdk";
export class util {
    test() {
        util.Log("");
    }
    //取节点全局旋转角度的方法
    public static getWorldRotation(node: cc.Node): number {
        let rotation = 0;
        while (node != null) {
            rotation += node.angle;
            node = node.parent;
        }
        return rotation % 360; // 确保角度在 0-360 度之间
    }

    // 将世界角度转换为节点的本地角度
    public static getLocalRotation(node: cc.Node, desiredWorldRotation: number): number {
        let parentRotation = 0;
        let parent = node.parent;

        // 累加所有父节点的旋转角度
        while (parent != null) {
            parentRotation += parent.angle;
            parent = parent.parent;
        }

        // 计算需要设置的本地角度
        let localRotation = desiredWorldRotation - parentRotation;

        // 确保角度在 -180 到 180 度之间
        localRotation = ((localRotation + 180) % 360) - 180;

        return localRotation;
    }


    // 判断点是否在旋转矩形内
    public static isPointInRotatedRectangle(point: { x: number, y: number }, rect: { x: number, y: number, size: { width: number, height: number }, angle: number, scale: number }): boolean {
        // 获取旋转矩形的四个顶点
        const vertices = util.getRotatedRectangle(rect.size, { x: rect.x, y: rect.y, angle: rect.angle, scale: rect.scale });

        // 使用射线法或叉乘法来判断点是否在多边形内
        // 这里我们使用叉乘法

        // 将多边形的顶点按顺序排列
        const n = vertices.length;
        for (let i = 0; i < n; i++) {
            const A = vertices[i];
            const B = vertices[(i + 1) % n]; // 下一个顶点，最后一个顶点的下一个是第一个顶点

            // 计算向量
            const BAx = B.x - A.x;
            const BAy = B.y - A.y;
            const PAx = point.x - A.x;
            const PAy = point.y - A.y;

            // 计算叉乘
            const cross = BAx * PAy - BAy * PAx;

            if (cross < 0) {
                // 如果叉乘为负，点在边的右侧，不在多边形内
                return false;
            }
        }

        // 如果对所有边叉乘结果都为正，则点在多边形内
        return true;
    }

    // 分离轴定理（SAT）用于旋转矩形之间的碰撞检测
    public static isRotatedRectanglesOverlapping(rect1: { x: number, y: number }[], rect2: { x: number, y: number }[]): boolean {
        const axes = [
            // 矩形1的边的法向量
            { x: -(rect1[1].y - rect1[0].y), y: rect1[1].x - rect1[0].x },
            { x: -(rect1[2].y - rect1[1].y), y: rect1[2].x - rect1[1].x },
            // 矩形2的边的法向量
            { x: -(rect2[1].y - rect2[0].y), y: rect2[1].x - rect2[0].x },
            { x: -(rect2[2].y - rect2[1].y), y: rect2[2].x - rect2[1].x }
        ];

        for (const axis of axes) {
            const projection1 = util.projectRectangle(rect1, axis);
            const projection2 = util.projectRectangle(rect2, axis);

            if (projection1.max < projection2.min || projection2.max < projection1.min) {
                return false;  // 没有重叠
            }
        }

        return true;  // 发生重叠
    }

    // 获取旋转矩形的顶点
    public static getRotatedRectangle(size: { width: number, height: number }, data: { x: number, y: number, angle: number, scale: number }): { x: number, y: number }[] {
        const x = data.x;
        const y = data.y;
        const angle = data.angle;
        const scale = data.scale;

        const halfWidth = size.width / 2 * scale;
        const halfHeight = size.height / 2 * scale;

        // 计算旋转矩形的四个顶点
        const rad = angle * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        return [
            { x: x + halfWidth * cos - halfHeight * sin, y: y + halfWidth * sin + halfHeight * cos },  // 右上
            { x: x - halfWidth * cos - halfHeight * sin, y: y - halfWidth * sin + halfHeight * cos },  // 左上
            { x: x - halfWidth * cos + halfHeight * sin, y: y - halfWidth * sin - halfHeight * cos },  // 左下
            { x: x + halfWidth * cos + halfHeight * sin, y: y + halfWidth * sin - halfHeight * cos }   // 右下
        ];
    }

    // 将矩形投影到轴上
    public static projectRectangle(rect: { x: number, y: number }[], axis: { x: number, y: number }) {
        // 归一化轴向量
        const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
        const normalizedAxis = { x: axis.x / length, y: axis.y / length };

        let min = (rect[0].x * normalizedAxis.x + rect[0].y * normalizedAxis.y);
        let max = min;

        for (let i = 1; i < rect.length; i++) {
            const projection = (rect[i].x * normalizedAxis.x + rect[i].y * normalizedAxis.y);
            if (projection < min) {
                min = projection;
            }
            if (projection > max) {
                max = projection;
            }
        }

        return { min, max };
    }

    public static clamp(value: number, min: number, max: number): number {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }

        return value;
    }

    public static formatToWan(value: number, fix = 2): string {
        if (value >= 100000000) {
            // 转换为“亿”的格式并保留两位小数
            return (value / 100000000).toFixed(2) + "亿";
        } else if (value >= 10000) {
            // 转换为“万”的格式并保留两位小数
            return (value / 10000).toFixed(fix) + "万";
        }
        return value.toString(); // 如果小于 10000，直接返回原值
    }

    public static formatTime(time: number): string {
        const hour = Math.floor(time / 3600);
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${hour}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    public static isAppPCGame() {
        if (__HLDDZ_APP__) {
            const ua = navigator.userAgent.toLowerCase();
            if (ua.includes("openharmony")) {
                return false;
            }

            const ex = window.external as unknown as { sendGameFakeUrl: (data: string) => void };
            if (ex && typeof ex.sendGameFakeUrl === 'function') {
                return true;
            }
        }

        return false;
    }

    public static getDesignSize(): cc.Size {
        if (util.isAppPCGame()) {
            return new cc.Size(900, 1668);
        }


        return new cc.Size(750, 1334);
    }

    public static getPCTip(): string {
        if (util.isAppPCGame()) {
            return "能量";
        }

        return "广告";
    }

    public static setDesignResolution(isSave = false) {
        const designResolutionWidth = util.getDesignSize().width;
        const designResolutionHeight = util.getDesignSize().height;

        let adaptResolutionWidth = 0;
        let adaptResolutionHeight = 0;
        let designResolutionPolicy = cc.ResolutionPolicy.EXACT_FIT;

        const frameSize = cc.view.getFrameSize();  // 设备分辨率
        const ratioWHDevice = frameSize.width / frameSize.height;   // 设备宽高比
        const ratioWHDesign = designResolutionWidth / designResolutionHeight; // 750/1334 ≈ 0.562

        // 设备屏幕更窄 → 固定宽度
        adaptResolutionWidth = designResolutionWidth;
        adaptResolutionHeight = designResolutionWidth / ratioWHDevice;
        designResolutionPolicy = cc.ResolutionPolicy.FIXED_WIDTH;
        util.Log("竖屏适配: FIXED_WIDTH", adaptResolutionHeight, adaptResolutionWidth);

        // 异形屏幕适配（如刘海屏、超长比例）
        if ((ratioWHDevice < 0.45) || (ratioWHDevice > ratioWHDesign * 2)) {
            adaptResolutionHeight = designResolutionHeight;
            adaptResolutionWidth = designResolutionWidth;
            designResolutionPolicy = cc.ResolutionPolicy.SHOW_ALL;
            util.Log("竖屏适配: 异形屏幕", adaptResolutionHeight, adaptResolutionWidth);
        }

        if (isSave) {
            cc.view.setDesignResolutionSize(
                adaptResolutionWidth,
                adaptResolutionHeight,
                designResolutionPolicy
            );
        }

        return designResolutionPolicy;
    }

    public static processUrl(url: string) {
        // 确保 URL 使用 https
        if (url.startsWith('http://')) {
            url = 'https://' + url.slice(7);
        }
        return url;
    }

    public static ensurePngExtension(url: string) {
        // 正则表达式检测是否包含 .png 或 .jpg 等扩展名
        if (!/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(url)) {
            url += '.png'; // 如果没有扩展名，则追加 .png
        }
        return url;
    }

    public static Log(...data: unknown[]) {
        if (__HLDDZ_CP_DEV__ || __HLDDZ_APP__) {
            console.log(data);
        }
    }

    public static Table(data: unknown[]) {
        if (__HLDDZ_CP_DEV__ || __HLDDZ_APP__) {
            console.table(data);
        }
    }

    //获取当前时间并格式化为 "HH:mm"
    public static getCurrentTimeString(): string {
        const now = new Date();

        // 获取小时和分钟
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // 格式化为两位数，比如 9 要显示为 09
        const hoursStr = hours < 10 ? "0" + hours : hours.toString();
        const minutesStr = minutes < 10 ? "0" + minutes : minutes.toString();

        // 拼接成 "HH:mm"
        const timeStr = `${hoursStr}:${minutesStr}`;

        return timeStr;
    }
    // 节点抖动
    public static startShake(data: {
        spNode: cc.Node,
        cb: () => void,
        shakeCount: number,      // 往返次数
        shakeStrength: number,   // 最大偏移像素（沿 30° 方向的长度）
        shakeDuration: number    // 每次往返时长
    }) {
        // 停掉旧动画，防止叠加
        cc.Tween.stopAllByTarget(data.spNode);

        const original = data.spNode.position.clone();

        // 30° 的方向向量 (cos30, sin30)
        const angleRad = 30 * Math.PI / 180;
        const dir = cc.v2(Math.cos(angleRad), Math.sin(angleRad)); // ≈ (0.866, 0.5)

        const cycle = Math.max(0.03, Math.min(0.12, data.shakeDuration));
        const half = cycle / 2;

        const strengthAt = (i: number) =>
            data.shakeStrength * (0.85 + 0.15 * (data.shakeCount - i) / data.shakeCount);

        let tw = cc.tween(data.spNode);

        for (let i = 0; i < data.shakeCount; i++) {
            const sign = (i % 2 === 0) ? 1 : -1;
            const amp = strengthAt(i) * sign;

            // 偏移向量：在 X、Y 上分量
            const offset = cc.v3(dir.x * amp, dir.y * amp, 0);
            const toPos = original.add(offset);

            tw = tw
                .to(half, { position: toPos }, { easing: 'sineInOut' })
                .to(half, { position: original }, { easing: 'sineInOut' });
        }

        tw.call(() => {
            data.spNode.setPosition(original); // 复位
            if (data.cb) data.cb();
        }).start();
    }
    /**
  * 炸弹飞行动画：直线 + 旋转(圈数) + 缩放
  * @param speed 飞行速度 (像素/秒)，自动计算时长
  * @returns dur 实际飞行时长 (秒)
  */
    public static throwSimple2(data: {
        node: cc.Node,
        pos1: cc.Vec2,
        pos2: cc.Vec2,
        speed: number,          // 必须：飞行速度 px/s
        circleCount?: number,   // 飞行过程中总共要转几圈（默认 4 圈）
        maxScale?: number       // 最大缩放倍数（默认 1.5）
    }): number {
        const node = data.node;
        const pos1 = data.pos1;
        const pos2 = data.pos2;
        const speed = data.speed;

        // 计算直线距离
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 自动计算时长
        const dur = distance / speed;

        const circleCount = data.circleCount ?? 2; // 默认 4 圈
        const maxScale = data.maxScale ?? 1.5;     // 默认 1.5 倍

        node.stopAllActions();
        node.setPosition(pos1.x, pos1.y);
        node.scale = 1;
        node.angle = 0;

        cc.tween(node)
            .to(dur, { position: cc.v3(pos2.x, pos2.y, node.z) }, {
                easing: 'linear',
                // eslint-disable-next-line @typescript-eslint/max-params
                progress: (start: cc.Vec3, end: cc.Vec3, cur: cc.Vec3, r: number) => {
                    end.x += 0;
                    cur.x += 0;
                    // 直线插值
                    const x = cc.misc.lerp(pos1.x, pos2.x, r);
                    const y = cc.misc.lerp(pos1.y, pos2.y, r);

                    // 缩放：前半程放大到 maxScale，后半程缩回 1
                    let scale = 1;
                    if (r <= 0.5) {
                        scale = 1 + (maxScale - 1) * (r / 0.5);   // 1 → maxScale
                    } else {
                        scale = maxScale - (maxScale - 1) * ((r - 0.5) / 0.5); // maxScale → 1
                    }
                    node.scale = scale;

                    // 旋转：按圈数配置
                    node.angle = r * circleCount * 360;

                    return cc.v3(x, y, start.z);
                }
            })
            // 落地时轻微弹跳
            .to(0.1, { scale: 1.1 })
            .to(0.1, { scale: 1.0 })
            .start();

        return dur;
    }
    /**
 * 直线位移 + 旋转(圈数) + 缩放(1→maxScale→1)
 * 固定时长：除“极近”外都用 baseDur；极近(≤dNear)用更短 minDur
 * @returns dur 实际飞行时长（不含可选的落地弹性）
 */
    public static throwSimple(data: {
        node: cc.Node,
        pos1: cc.Vec2,
        pos2: cc.Vec2,

        baseDur?: number,        // 远/中距离统一时长，默认 1.0
        minDur?: number,         // 极近距离的最短时长，默认 0.28
        dNearGrids?: number,     // 极近阈值（格数），默认 2格
        tileSize?: number,       // 每格像素，默认 90（你的棋盘）

        circleCount?: number,    // 整段旋转圈数，默认 2
        maxScale?: number,       // 峰值缩放，默认 1.5
        clockwise?: boolean,     // 旋转方向，默认顺时针

        // 可选：落地弹性（为保证时长一致性，默认关闭）
        landBounce?: boolean,    // 默认 false
        bounceUpDur?: number,    // 默认 0.1
        bounceDownDur?: number,  // 默认 0.1
    }): number {
        const node = data.node;
        const pos1 = data.pos1;
        const pos2 = data.pos2;

        const baseDur = data.baseDur ?? 1.0;
        const minDur = data.minDur ?? 0.28;
        const dNearGrids = data.dNearGrids ?? 2;
        const tileSize = data.tileSize ?? 90;

        const circleCount = data.circleCount ?? 2;
        const maxScale = data.maxScale ?? 1.5;
        const clockwise = data.clockwise ?? true;

        const bounceUpDur = data.bounceUpDur ?? 0.1;
        const bounceDownDur = data.bounceDownDur ?? 0.1;

        // 距离
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 分段时长：极近用minDur，其他一律baseDur
        const dNearPx = dNearGrids * tileSize;
        const dur = (distance <= dNearPx) ? Math.min(minDur, baseDur) : baseDur;

        node.stopAllActions();
        node.setPosition(pos1.x, pos1.y);
        node.scale = 1;
        node.angle = 0;

        const dir = clockwise ? -1 : 1; // Cocos正角为逆时针，这里默认顺时针

        // 主飞行
        let tw = cc.tween(node).to(dur, { position: cc.v3(pos2.x, pos2.y, node.z) }, {
            easing: 'linear',
            // eslint-disable-next-line @typescript-eslint/max-params
            progress: (start: cc.Vec3, end: cc.Vec3, cur: cc.Vec3, r: number) => {
                end.x += 0; cur.x += 0; // 消警
                const x = cc.misc.lerp(pos1.x, pos2.x, r);
                const y = cc.misc.lerp(pos1.y, pos2.y, r);

                // 缩放：前半涨到 maxScale，后半回 1
                const scale = (r <= 0.5)
                    ? 1 + (maxScale - 1) * (r / 0.5)
                    : maxScale - (maxScale - 1) * ((r - 0.5) / 0.5);
                node.scale = scale;

                // 旋转：按圈数
                node.angle = dir * r * circleCount * 360;

                return cc.v3(x, y, start.z);
            }
        });

        tw = tw.to(bounceUpDur, { scale: 1.1 })
            .to(bounceDownDur, { scale: 1.0 });

        tw.start();
        return dur;
    }

    // 加边界
    public static addBorder(raw: number[][]): number[][] {
        const height = raw.length;
        const width = raw[0].length;
        const grid = Array.from({ length: height + 2 }, () => new Array(width + 2).fill(0));
        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                grid[h + 1][w + 1] = raw[h][w];
            }
        }
        return grid;
    }
    /**
     * 判断两点是否可连接
     * @param board  图块地图 (二维数组)
     * @param a      第一个点 {x, y}
     * @param b      第二个点 {x, y}
     * @returns 连接路径（可消除）
     */
    public static canConnectPath2(board: number[][], a: Pos, b: Pos): Pos[] {
        const h = board.length;
        const w = board[0].length;

        // 1. 同一个点
        if (a.x === b.x && a.y === b.y) return [];
        // 2. 类型必须相同
        if (board[a.y][a.x] !== board[b.y][b.x]) return [];

        // 四个方向向量：上、右、下、左
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
        ];

        // visited[y][x][dir] = 最少转折次数已到达
        const visited: number[][][] = Array.from(
            { length: h },
            () => Array.from(
                { length: w },
                () => new Array(4).fill(Infinity)
            )
        );

        // BFS 队列元素
        interface Node { x: number; y: number; dir: number; turns: number; path: Pos[] }
        const queue: Node[] = [];

        // 4. 初始入队
        for (let d = 0; d < 4; d++) {
            visited[a.y][a.x][d] = 0;
            queue.push({ x: a.x, y: a.y, dir: d, turns: 0, path: [a] });
        }

        while (queue.length) {
            const shifted = queue.shift();
            if (!shifted) break;
            const { x, y, dir, turns, path } = shifted;
            // 沿当前方向不断前进
            let nx = x + dirs[dir].dx;
            let ny = y + dirs[dir].dy;

            while (nx >= 0 && ny >= 0 && nx < w && ny < h && (board[ny][nx] === 0 || (nx === b.x && ny === b.y))) {
                const newPath = [...path, { x: nx, y: ny }];
                // 找到终点
                if (nx === b.x && ny === b.y) {
                    return newPath;
                }
                // 在 (nx,ny) 处尝试转向或继续
                for (let nd = 0; nd < 4; nd++) {
                    const nTurns = nd === dir ? turns : turns + 1;

                    if (nTurns > 2) continue;

                    if (visited[ny][nx][nd] > nTurns) {
                        visited[ny][nx][nd] = nTurns;
                        queue.push({ x: nx, y: ny, dir: nd, turns: nTurns, path: newPath });
                    }
                }
                nx += dirs[dir].dx;
                ny += dirs[dir].dy;
            }
        }

        return [];
    }

    public static canConnectPath(board: number[][], a: Pos, b: Pos): Pos[] {
        const h = board.length;
        const w = board[0].length;

        // 1) 同点 / 类型不同
        if (a.x === b.x && a.y === b.y) return [];
        const va = board[a.y][a.x];
        const vb = board[b.y][b.x];
        if (va === 0 || vb === 0 || va !== vb) return [];

        // 2) 构建行/列前缀和（障碍 = 非0）
        const rowOcc: number[][] = Array.from({ length: h }, () => new Array(w + 1).fill(0));
        const colOcc: number[][] = Array.from({ length: w }, () => new Array(h + 1).fill(0));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                rowOcc[y][x + 1] = rowOcc[y][x] + (board[y][x] !== 0 ? 1 : 0);
            }
        }
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                colOcc[x][y + 1] = colOcc[x][y] + (board[y][x] !== 0 ? 1 : 0);
            }
        }

        // 3) 工具函数
        const isRowClear = (y: number, x1: number, x2: number): boolean => {
            if (x1 > x2) [x1, x2] = [x2, x1];
            if (x2 - x1 <= 1) return true; // 相邻
            // 只检查内部 [x1+1, x2-1]
            return rowOcc[y][x2] - rowOcc[y][x1 + 1] === 0;
        };
        const isColClear = (x: number, y1: number, y2: number): boolean => {
            if (y1 > y2) [y1, y2] = [y2, y1];
            if (y2 - y1 <= 1) return true;
            return colOcc[x][y2] - colOcc[x][y1 + 1] === 0;
        };
        // 把折点 polyline 展开为逐格路径（含端点）
        const buildGranular = (pts: Pos[]): Pos[] => {
            const out: Pos[] = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const s = pts[i], t = pts[i + 1];
                if (out.length === 0 || out[out.length - 1].x !== s.x || out[out.length - 1].y !== s.y) {
                    out.push({ x: s.x, y: s.y });
                }
                if (s.x === t.x) {
                    const step = s.y < t.y ? 1 : -1;
                    for (let y = s.y + step; y !== t.y; y += step) out.push({ x: s.x, y });
                } else {
                    const step = s.x < t.x ? 1 : -1;
                    for (let x = s.x + step; x !== t.x; x += step) out.push({ x, y: s.y });
                }
            }
            out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
            return out;
        };

        // 0 转折：直连（行/列）
        const straight = (): Pos[] | null => {
            if (a.x === b.x && isColClear(a.x, a.y, b.y)) return buildGranular([a, b]);
            if (a.y === b.y && isRowClear(a.y, a.x, b.x)) return buildGranular([a, b]);
            return null;
        };

        // 一折：L 形，拐点 c 必须为空或即为终点 b
        const oneTurn = (p: Pos, q: Pos): Pos[] | null => {
            // c1 = (px, qy)
            const c1: Pos = { x: p.x, y: q.y };
            if ((c1.x === q.x && c1.y === q.y) || board[c1.y][c1.x] === 0) {
                const ok1 = (p.x === c1.x) ? isColClear(p.x, p.y, c1.y) : isRowClear(p.y, p.x, c1.x);
                const ok2 = (q.x === c1.x) ? isColClear(q.x, q.y, c1.y) : isRowClear(q.y, q.x, c1.x);
                if (ok1 && ok2) return buildGranular([p, c1, q]);
            }
            // c2 = (qy, px) -> 实际为 (qx, py)
            const c2: Pos = { x: q.x, y: p.y };
            if ((c2.x === q.x && c2.y === q.y) || board[c2.y][c2.x] === 0) {
                const ok1 = (p.x === c2.x) ? isColClear(p.x, p.y, c2.y) : isRowClear(p.y, p.x, c2.x);
                const ok2 = (q.x === c2.x) ? isColClear(q.x, q.y, c2.y) : isRowClear(q.y, q.x, c2.x);
                if (ok1 && ok2) return buildGranular([p, c2, q]);
            }
            return null;
        };

        // 二折：从 a 向四向“射线”扩展到每个可见空格 p，尝试 p→b 的一折
        const twoTurns = (): Pos[] | null => {
            // 扫描器
            const tryRay = (dx: number, dy: number): Pos[] | null => {
                let x = a.x + dx, y = a.y + dy;
                while (x >= 0 && x < w && y >= 0 && y < h) {
                    if (board[y][x] !== 0) break; // 射线被阻挡
                    const p = { x, y };
                    const res = oneTurn(p, b);
                    if (res) return buildGranular([a, ...res]);
                    x += dx; y += dy;
                }
                return null;
            };
            // 左、右、上、下
            return (
                tryRay(-1, 0) ||
                tryRay(1, 0) ||
                tryRay(0, -1) ||
                tryRay(0, 1)
            );
        };

        // 判定顺序：直线优先 -> 一折 -> 二折
        const s0 = straight(); if (s0) return s0;
        const s1 = oneTurn(a, b); if (s1) return s1;
        const s2 = twoTurns(); if (s2) return s2;
        return [];
    }

    public static getBlockPos({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
        const posX = x * TitleSize + 30 - width / 2 * TitleSize;
        const posY = -y * TitleSize - 30 + height / 2 * TitleSize
        return cc.v3(posX, posY);
    }
    public static compressBoard(board: ShareMapData) {
        const d = board.data;

        // 压缩 serverItems
        const serverStr = d.serverItems.map(it =>
            it.map(v => v.toString(36)).join(",")
        ).join(";");

        // 压缩 plan 对象
        const planStr = Object.values(board.plan)
            .map(v => (typeof v === "number" ? v.toString(36) : v))
            .join(",");

        return JSON.stringify({
            r: board.role_id,
            w: d.width,
            h: d.height,
            d: d.dirction,
            lc: d.linkCount,
            sItems: serverStr,
            plan: planStr
        });
    }
    public static decompressBoard(str: string) {
        const obj = JSON.parse(str);

        // 解压 serverItems
        const serverItems = obj.sItems.split(";").map((s: string) =>
            s.split(",").map(v => parseInt(v, 36))
        );

        // 解压 plan（返回数组）
        const planArr = obj.plan.split(",").map((v: string) => parseInt(v, 36));

        return {
            role_id: obj.r,
            data: {
                width: obj.w,
                height: obj.h,
                dirction: obj.d,
                linkCount: obj.lc,
                serverItems: serverItems,
                items: [] // 原来为空的话直接空
            },
            plan: planArr
        };
    }
    public static B64_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /** 将 UTF-16 字符串编码为 UTF-8 字节 */
    public static utf8ToBytes(str: string): Uint8Array {
        const enc = encodeURIComponent(str);
        const out: number[] = [];
        for (let i = 0; i < enc.length; i++) {
            const ch = enc.charAt(i);
            if (ch === "%") {
                const h1 = enc.charAt(i + 1);
                const h2 = enc.charAt(i + 2);
                if (!util.isHex(h1) || !util.isHex(h2)) {
                    throw new Error("Invalid percent-encoding in UTF-8 conversion.");
                }
                out.push(parseInt(h1 + h2, 16));
                i += 2;
            } else {
                // 未转义 ASCII，直接写入
                out.push(ch.charCodeAt(0));
            }
        }
        return new Uint8Array(out);
    }

    /** 将 UTF-8 字节解码为 UTF-16 字符串 */
    public static bytesToUtf8(bytes: Uint8Array): string {
        let pct = "";
        for (const byte of bytes) {
            const h = util.toHex2(byte);
            pct += "%" + h;
        }
        try {
            return decodeURIComponent(pct);
        } catch {
            throw new Error("Invalid UTF-8 byte sequence.");
        }
    }

    /** 从字节生成标准 Base64（含 = 填充，使用 + /） */
    public static base64FromBytes(bytes: Uint8Array): string {
        let out = "";
        let i = 0;
        const len = bytes.length;

        for (; i + 2 < len; i += 3) {
            const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
            out += util.B64_TABLE[(n >>> 18) & 63]
                + util.B64_TABLE[(n >>> 12) & 63]
                + util.B64_TABLE[(n >>> 6) & 63]
                + util.B64_TABLE[n & 63];
        }

        if (i + 1 === len) {
            const n1 = bytes[i] << 16;
            out += util.B64_TABLE[(n1 >>> 18) & 63]
                + util.B64_TABLE[(n1 >>> 12) & 63]
                + "==";
        } else if (i + 2 === len) {
            const n2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
            out += util.B64_TABLE[(n2 >>> 18) & 63]
                + util.B64_TABLE[(n2 >>> 12) & 63]
                + util.B64_TABLE[(n2 >>> 6) & 63]
                + "=";
        }

        return out;
    }

    /** 将标准 Base64（允许空白、允许尾部 =）解码为字节 */
    public static base64ToBytes(b64: string): Uint8Array {
        // 去掉空白
        b64 = b64.replace(/\s+/g, "");

        // 只允许 A–Z a–z 0–9 + / 和最多两个 '='（在末尾）
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
            throw new Error("Invalid Base64 characters.");
        }
        if (b64.length % 4 !== 0) {
            throw new Error("Invalid Base64 length (must be multiple of 4).");
        }

        // 反查表（不包含 '='，等号用 64 作为占位标记）
        const map = new Int16Array(128);
        for (let i = 0; i < map.length; i++) map[i] = -1;
        for (let i = 0; i < util.B64_TABLE.length; i++) {
            map[util.B64_TABLE.charCodeAt(i)] = i;
        }

        const out: number[] = [];
        for (let i = 0; i < b64.length; i += 4) {
            const c1 = map[b64.charCodeAt(i)];
            const c2 = map[b64.charCodeAt(i + 1)];
            const ch3 = b64.charCodeAt(i + 2);
            const ch4 = b64.charCodeAt(i + 3);

            if (c1 < 0 || c2 < 0) throw new Error("Invalid Base64 character.");

            // '=' 只允许出现在每组的第 3/4 位；用 64 作为“padding”标记
            const c3 = (ch3 === 61 /* '=' */) ? 64 : map[ch3];
            const c4 = (ch4 === 61 /* '=' */) ? 64 : map[ch4];
            if (c3 < 0 || c4 < 0) throw new Error("Invalid Base64 character.");

            const n = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
            out.push((n >>> 16) & 0xff);
            if (c3 !== 64) out.push((n >>> 8) & 0xff);
            if (c4 !== 64) out.push(n & 0xff);
        }

        return new Uint8Array(out);
    }


    /** 将普通 Base64 转为 Base64URL（去掉 =，替换 +/） */
    public static toBase64Url(b64: string): string {
        return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    /** 将 Base64URL 补齐/替换为普通 Base64 */
    public static fromBase64Url(b64u: string): string {
        if (!/^[A-Za-z0-9\-_]+$/.test(b64u)) {
            throw new Error("Invalid Base64URL characters.");
        }
        let b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
        const padLen = b64.length % 4;
        if (padLen === 1) {
            // 4k+1 长度不可能是合法 Base64
            throw new Error("Invalid Base64URL length.");
        } else if (padLen === 2) {
            b64 += "==";
        } else if (padLen === 3) {
            b64 += "=";
        }
        return b64;
    }

    /** 导出：字符串 -> Base64URL（无 padding） */
    public static b64uEncode(str: string): string {
        const bytes = util.utf8ToBytes(str);
        const b64 = util.base64FromBytes(bytes);
        return util.toBase64Url(b64);
    }

    /** 导出：Base64URL -> 字符串（自动校验与补齐） */
    public static b64uDecode(b64u: string): string {
        const b64 = util.fromBase64Url(b64u);
        const bytes = util.base64ToBytes(b64);
        return util.bytesToUtf8(bytes);
    }

    /** 小工具：2位十六进制 */
    public static toHex2(n: number): string {
        const s = n.toString(16);
        return s.length === 1 ? "0" + s : s;
    }

    public static isHex(c: string): boolean {
        const code = c.charCodeAt(0);
        return (
            (code >= 48 && code <= 57) || // 0-9
            (code >= 65 && code <= 70) || // A-F
            (code >= 97 && code <= 102)    // a-f
        );
    }

    /** 计费规则：
     *  - 中文=6 单位（= 1 个中文宽度）
     *  - 数字=2 单位（3 个数字≈1 个中文）
     *  - 英文=3 单位（2 个英文≈1 个中文）
     *  - "_" 视为英文宽度（3 单位）
     * 预算：widthInHan * 6（默认 5 个中文 => 30 单位）
     * 后缀 "..." 不占用预算：截断时追加显示。
     */
    public static abbreviateByDisplayWidth(
        input: string,
        opts: {
            widthInHan?: number;          // 默认 5（=30 单位）
            foldFullwidth?: boolean;      // 全角英数/下划线 -> 半角，默认 true
            caseMode?: CaseMode;          // "preserve" | "upper" | "lower"
            useDots?: boolean;            // 超出是否追加 "...", 默认 true（不计宽度）
        } = {}
    ): string {
        const {
            widthInHan = 4,
            foldFullwidth = true,
            caseMode = "preserve",
            useDots = true,
        } = opts;

        if (!input) return "";

        // 成本常量（以中文=6 为基准）
        const COST_HAN = 6;
        const COST_DIGIT = 2;
        const COST_LATIN = 3;
        const COST_UNDER = 3;

        const MAX_UNITS = widthInHan * COST_HAN;

        const isHan = (cp: number) =>
            (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x4E00 && cp <= 0x9FFF) ||
            (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0x20000 && cp <= 0x2EBEF);
        const isDigit = (cp: number) =>
            (cp >= 0x30 && cp <= 0x39) || (cp >= 0xFF10 && cp <= 0xFF19);
        const isLatin = (cp: number) =>
            (cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) ||
            (cp >= 0xFF21 && cp <= 0xFF3A) || (cp >= 0xFF41 && cp <= 0xFF5A);
        const isUnderscore = (cp: number) => cp === 0x5F || cp === 0xFF3F;

        const toHalfwidth = (ch: string): string => {
            const cp = ch.codePointAt(0);
            if (!cp) return ch;
            if (cp >= 0xFF10 && cp <= 0xFF19) return String.fromCharCode(cp - 0xFF10 + 0x30);
            if (cp >= 0xFF21 && cp <= 0xFF3A) return String.fromCharCode(cp - 0xFF21 + 0x41);
            if (cp >= 0xFF41 && cp <= 0xFF5A) return String.fromCharCode(cp - 0xFF41 + 0x61);
            if (cp === 0xFF3F) return "_";
            return ch;
        };

        // 计算总可保留单位，用于判断是否截断
        let totalUnits = 0;
        for (const ch of Array.from(input)) {
            const cp = ch.codePointAt(0);
            if (!cp) continue;
            if (isHan(cp)) totalUnits += COST_HAN;
            else if (isDigit(cp)) totalUnits += COST_DIGIT;
            else if (isLatin(cp)) totalUnits += COST_LATIN;
            else if (isUnderscore(cp)) totalUnits += COST_UNDER;
        }

        const out: string[] = [];
        let used = 0;

        for (const ch of Array.from(input)) {
            const cp = ch.codePointAt(0);
            if (!cp) continue;
            let picked: string | null = null;
            let cost = 0;

            if (isHan(cp)) { picked = ch; cost = COST_HAN; }
            else if (isDigit(cp)) { picked = foldFullwidth ? toHalfwidth(ch) : ch; cost = COST_DIGIT; }
            else if (isLatin(cp)) { picked = foldFullwidth ? toHalfwidth(ch) : ch; cost = COST_LATIN; }
            else if (isUnderscore(cp)) { picked = foldFullwidth ? toHalfwidth(ch) : ch; cost = COST_UNDER; }

            if (picked) {
                if (used + cost > MAX_UNITS) break;
                if (caseMode === "upper") picked = picked.toUpperCase();
                else if (caseMode === "lower") picked = picked.toLowerCase();
                out.push(picked);
                used += cost;
            }
        }

        const truncated = used < totalUnits;
        return truncated && useDots ? out.join("") + "..." : out.join("");
    }

}
