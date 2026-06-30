import { ResManager } from "../../FrameWork/manager/ResManager";
import { util } from "../../FrameWork/Utils/util";
import { BundleName, TitleSize } from "../Constant";

export class LinePath extends cc.Component {
    private activeLines: cc.Node[] = [];
    private clearTime = 0;
    // 清除所有线段
    clear() {
        for (const line of this.activeLines) {
            line.removeFromParent();
            line.destroy();
        }
        this.activeLines.length = 0;
    }

    /**
     * 根据路径点数组绘制线段
     * @param path 坐标点数组（逻辑坐标，带边界的 playableBoard 中的坐标）
     * @param mapWidth 地图宽度（不含边界）
     * @param mapHeight 地图高度（不含边界）
     */
    drawPath(data: { path: { x: number; y: number }[], mapWidth: number, mapHeight: number, _parent: cc.Node, time: number }) {
        this.clear();
        this.clearTime = data.time || 999;
        const { path, mapWidth, mapHeight, _parent } = data;
        const offset = TitleSize / 2;

        const getTilePosition = (j: number, i: number): cc.Vec3 => {
            const x = i * TitleSize + offset - (mapWidth / 2) * TitleSize;
            const y = -j * TitleSize - offset + (mapHeight / 2) * TitleSize;
            return new cc.Vec3(x, y, 0);
        };

        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];

            const posA = getTilePosition(a.x - 1, a.y - 1); // 因为有边界，逻辑坐标需 -1
            const posB = getTilePosition(b.x - 1, b.y - 1);
            if (a.y == 9 || b.y == 9) {
                this.drawSegment({ a: posA, b: posB, _parent, diff: 30 });
            }
            else {
                this.drawSegment({ a: posA, b: posB, _parent, diff: 0 });
            }
        }
    }

    // 绘制一段线段，从 a → b
    private async drawSegment(data: { a: cc.Vec3, b: cc.Vec3, _parent: cc.Node, diff: number }) {
        const { a, b, _parent, diff } = data;
        const dir = b.subtract(a);
        const length = dir.mag();
        const angle = Math.atan2(dir.y, dir.x) * 180 / Math.PI;
        const unit = 70;  // prefab 原始宽度
        const count = Math.floor(length / unit);   // 完整段数
        const remainder = length % unit;           // 剩余长度
        const step = dir.clone().normalize().multiplyScalar(unit);  // 每段的向量

        // 加载资源
        const rand = util.clamp(Math.ceil(Math.random() * 3), 1, 3);
        const Line = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Direction/Line", cc.Prefab) as cc.Prefab;
        const FX_liantiao = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Art/prefab/FX_liantiao" + rand, cc.Prefab) as cc.Prefab;

        for (let i = 0; i < count; i++) {
            const pos = a.clone().add(step.clone().multiplyScalar(i + 0.5)); // 段的中心点
            await this.createLinePiece({ Line, FX_liantiao, pos, angle, width: unit, _parent, diff, rand });
        }

        // 处理剩余部分（不足一整段）
        if (remainder > 0) {
            const pos = a.clone().add(dir.clone().normalize().multiplyScalar(count * unit + remainder / 2));
            await this.createLinePiece({ Line, FX_liantiao, pos, angle, width: remainder, _parent, diff, rand });
        }
    }

    private async createLinePiece(data: { Line: cc.Prefab, FX_liantiao: cc.Prefab, pos: cc.Vec3, angle: number, width: number, _parent: cc.Node, diff: number, rand: number }) {
        const { Line, FX_liantiao, pos, angle, width, _parent, diff, rand } = data;
        const line = cc.instantiate(Line);
        const liantiao = cc.instantiate(FX_liantiao);
        liantiao.setParent(line);
        if (rand == 1) {
            liantiao.getComponent(cc.Animation).play("liantiao");
        }
        else if (rand == 2) {
            liantiao.getComponent(cc.Animation).play("liantiao2");
        }
        else {
            liantiao.getComponent(cc.Animation).play("liantiao3");
        }

        line.setParent(_parent);
        line.setPosition(pos.x - diff, pos.y + 10, 0);
        line.angle = angle;

        // 按宽度缩放单段（如果是完整段则 width≈70，剩余段则 <70）
        line.setScale(cc.v2(width / 70, 3));

        this.activeLines.push(line);
    }

    protected update(dt: number): void {
        this.clearTime -= dt;
        if (this.clearTime <= 0) {
            this.clear();
        }
    }
}
