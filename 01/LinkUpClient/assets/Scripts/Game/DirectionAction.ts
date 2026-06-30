import { GameDirection } from "../Constant";
import MapManager from "../Manager/MapManager";
import { GameBlock } from "./GameBlock";

const enum SpawnMode {
    Down,   // 向下：上->下，左->右
    Up,     // 向上：下->上，左->右
    Left,   // 向左：上->下，右->左
    Right,  // 向右：上->下，左->右
    CenterToSidesX, // 中向两侧（横向）：上->下，行内中->侧
    SidesToCenterX, // 两侧向中（横向）：上->下，行内侧->中
    CenterToUpDownY, // 中向上下（纵向）：左->右，列内中->上下
    UpDownToCenterY, // 上下向中（纵向）：左->右，列内上下->中
    CenterSpiral, // 从中心螺旋展开
}

interface SpawnConfig {
    mode: SpawnMode;
    baseDelay?: number;  // 起始延迟
    step?: number;       // 每“序号”间隔
    appearDur?: number;  // 出现时长
    easing?: string;     // 动效缓动
    withFade?: boolean;  // 是否淡入
    withScale?: boolean; // 是否缩放
}
export default class DirectionAction extends cc.Component {

    public doAction() {
        switch (MapManager.getInstance().dirction) {
            case GameDirection.Down:
                //向下：从上到下，行内从左到右
                this.doSpawn({ mode: SpawnMode.Down, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.Up:
                //向上：从下到上，行内从左到右
                this.doSpawn({ mode: SpawnMode.Up, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.Left:
                //向左：从上到下，行内从右到左
                this.doSpawn({ mode: SpawnMode.Left, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.Right:
                //向右：从上到下，行内从左到右
                this.doSpawn({ mode: SpawnMode.Right, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.LeftRight:
                //中向两侧（横向）：从上到下，行内从中间向两侧
                this.doSpawn({ mode: SpawnMode.CenterToSidesX, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.RightLeft:
                //两侧向中（横向）：从上到下，行内从两侧向中间
                this.doSpawn({ mode: SpawnMode.SidesToCenterX, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.UpDown:
                //中向上下（纵向）：从左到右，列内从中间向上下
                this.doSpawn({ mode: SpawnMode.CenterToUpDownY, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.DownUp:
                //上下向中（纵向）：从左到右，列内从上下向中间
                this.doSpawn({ mode: SpawnMode.UpDownToCenterY, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.Rotate:
            case GameDirection.Rotate4:
            case GameDirection.Rotate3:
                //中向两侧（横向）：从上到下，行内从中间向两侧
                this.doSpawn({ mode: SpawnMode.CenterToSidesX, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            case GameDirection.DoubleRotate:
                //中向两侧（横向）：从上到下，行内从中间向两侧
                this.doSpawn({ mode: SpawnMode.CenterToSidesX, baseDelay: 0.25, step: 0.01, appearDur: 0.1, easing: 'backOut', withFade: true, withScale: true, });
                break;
            default:
                this.doSpawn({
                    mode: SpawnMode.CenterSpiral,
                    baseDelay: 0.25,
                    step: 0.01,
                    appearDur: 0.1,
                    easing: 'backOut',
                    withFade: true,
                    withScale: true
                });
                break;
        }

    }

    public doSpawn(config: SpawnConfig) {
        const gm = MapManager.getInstance();
        const height = gm.mapHeight;
        const width = gm.mapWidth;

        const baseDelay = config.baseDelay ?? 0.5;
        const step = config.step ?? 0.04;
        const appearDur = config.appearDur ?? 0.18;
        const easing = config.easing ?? 'backOut';
        const withFade = config.withFade ?? true;
        const withScale = config.withScale ?? true;

        // 预计算中心点（支持偶数宽高时成对对称）
        const cx = (width - 1) / 2;   // 例如宽=10 -> 4.5

        // 计算某个格子的“序号”（决定延迟 = baseDelay + step * order）
        const orderOf = (x: number, y: number): number => {
            switch (config.mode) {
                case SpawnMode.Down: {
                    // 从上到下，从左到右
                    return y * width + x;
                }
                case SpawnMode.Up: {
                    // 从下到上，从左到右
                    return (height - 1 - y) * width + x;
                }
                case SpawnMode.Left: {
                    // 从最右一列开始向左推进，每列内部从上到下
                    // 列主序：col = (width-1-x)，行 = y
                    return (width - 1 - x) * height + y;
                }
                case SpawnMode.Right: {
                    // 最左列开始向右推进，每列内部从上到下
                    return x * height + y;
                }
                case SpawnMode.CenterToSidesX: {
                    // 列优先：先按“到中心的横向带宽 band”推进，再在每列中自上而下
                    const band = Math.round(Math.abs(x - cx) * 2); // 0..(width-1)，偶数宽时中间两列同 band
                    return band * height + y;                      // 每个 band 中，自上而下
                }
                case SpawnMode.SidesToCenterX: {
                    // 列优先：按“到边的距离 band”推进，同 band 的左右两列同时出现
                    const band = Math.min(x, width - 1 - x); // 0..floor(width/2)
                    return band * height + y;                // 每个 band 内，自上而下
                }
                case SpawnMode.CenterToUpDownY: {
                    const cy = (height - 1) / 2;                   // 半格中心，偶数高时中间两行同 band
                    const band = Math.round(Math.abs(y - cy) * 2); // 0,1,2,...
                    return band * width + x;                       // 每个 band 的行里：左→右
                }
                case SpawnMode.UpDownToCenterY: {
                    const band = Math.min(y, height - 1 - y);      // 距离上下边的行数
                    return band * width + x;                       // 每个 band 的行里：左→右
                }
                case SpawnMode.CenterSpiral: {
                    const cx = Math.floor((width - 1) / 2);
                    const cy = Math.floor((height - 1) / 2);

                    // 计算相对中心偏移
                    const relX = x - cx;
                    const relY = y - cy;

                    // 半圈层 = max(|dx|, |dy|)
                    const radius = Math.max(Math.abs(relX), Math.abs(relY));

                    // 当前圈层的边界
                    const minX = cx - radius;
                    const maxX = cx + radius;
                    const minY = cy - radius;
                    const maxY = cy + radius;

                    // 圈内顺序（顺时针从左上角开始）
                    let indexInCircle = 0;

                    if (y === minY) {
                        indexInCircle = x - minX; // 上边
                    } else if (x === maxX) {
                        indexInCircle = (maxX - minX) + (y - minY); // 右边
                    } else if (y === maxY) {
                        indexInCircle = (maxX - minX) + (maxY - minY) + (maxX - x); // 下边
                    } else if (x === minX) {
                        indexInCircle = 2 * (maxX - minX + 1) + (maxY - minY) - (maxY - y); // 左边
                    } else {
                        // 中心格（radius=0）或圈层内部格子
                        indexInCircle = 0;
                    }

                    // 累计前面圈层格子数
                    let prevCircleCount = 0;
                    for (let r = 0; r < radius; r++) {
                        const w = Math.min(width, 2 * r + 1);
                        const h = Math.min(height, 2 * r + 1);
                        const edgeCount = 2 * w + 2 * (h - 2); // 每圈实际格子数
                        prevCircleCount += edgeCount;
                    }

                    return prevCircleCount + indexInCircle;
                }

                default:
                    return y * width + x;
            }
        };

        // 1) 先全部设为不可见/初始态
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const item = gm.mapTitles[y][x];
                if (!item || !item.active) continue;
                item.stopAllActions?.(); // 防止叠 Tween
                item.getComponent(GameBlock).setVisible(false);
                if (withFade) item.opacity = 0;
                if (withScale) item.scale = 0.7;
            }
        }

        // 2) 逐格派发动效（按 order 设置 delay）
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const item = gm.mapTitles[y][x];
                if (!item) continue;

                const order = orderOf(x, y);
                const delay = baseDelay + step * order;

                cc.tween(item)
                    .delay(delay)
                    .call(() => {
                        item.getComponent(GameBlock).setVisible(true);
                    })
                    .parallel(
                        withFade ? cc.tween().to(appearDur, { opacity: 255 }) : cc.tween(),
                        withScale ? cc.tween().to(appearDur, { scale: 1 }, { easing }) : cc.tween()
                    )
                    .start();
            }
        }
    }
    // update (dt) {}
}
