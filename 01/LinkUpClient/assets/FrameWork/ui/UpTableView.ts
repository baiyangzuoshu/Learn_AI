import type { TableViewItem } from "../../Scripts/types";

/**
 * 通用的 ItemCell 组件
 * 负责绑定数据并处理点击事件
 */
class ItemCell extends cc.Component {
    private _itemId = 0;
    private clickCallback!: (itemId: number, node: cc.Node) => void;

    /**
     * 绑定数据的方法，由外部传入具体的绑定逻辑
     * @param index 数据索引
     * @param data 数据对象
     * @param bindCallback 数据绑定回调
     */
    public bindData(index: number, data: unknown, bindCallback: (node: cc.Node, data: unknown) => void) {
        this._itemId = index;
        bindCallback(this.node, data);
    }

    /**
     * 获取当前项的索引
     */
    public getItemId(): number {
        return this._itemId;
    }

    /**
     * 注册点击事件
     * @param callback 点击事件回调
     */
    public registerClick(callback: (itemId: number, node: cc.Node) => void) {
        this.clickCallback = callback;
        const eventNode = this.node.getChildByName("event");
        if (eventNode) {
            eventNode.on("click", this.onClick, this);
        }
    }

    /**
     * 注销点击事件
     */
    public unregisterClick() {
        const eventNode = this.node.getChildByName("event");
        if (eventNode) {
            eventNode.off("click", this.onClick, this);
        }
    }

    /**
     * 点击事件处理
     */
    private onClick() {
        if (this.clickCallback) {
            this.clickCallback(this._itemId, this.node);
        }
    }

    protected onDestroy() {
        this.unregisterClick();
    }
}

/**
 * 通用的 UpTableView 组件
 * 负责管理 ScrollView 中的列表项复用
 */
export default class UpTableView extends cc.Component {
    private scrollView!: cc.ScrollView;
    private itemPrefab!: cc.Node;
    private itemHeight = 70;
    private spacingY = 10;
    private datas: unknown[] = [];
    private items: cc.Node[] = [];
    private visibleCount = 0;
    private bufferZone = 0;
    private totalCount = 0;

    private bindDataCallback!: (node: cc.Node, data: unknown) => void;
    private clickCallback!: (itemId: number, node: cc.Node) => void;

    // ⭐ 新增：是否从底部开始（上滚列表常见需求）
    private startFromBottom = true;

    public initialize(
        v1: TableViewItem,
        datas: unknown[],
        cb: {
            bindCallback: (node: cc.Node, data: unknown) => void,
            clickCallback: (itemId: number, node: cc.Node) => void
        }
    ) {
        this.scrollView = v1.scrollView;
        this.itemPrefab = v1.itemPrefab;
        this.itemHeight = v1.itemHeight;
        this.spacingY = v1.spacingY;
        this.datas = datas;
        const diffY = v1.diffY;
        this.totalCount = this.datas.length;
        this.bindDataCallback = cb.bindCallback;
        this.clickCallback = cb.clickCallback;

        // ⭐ 关键：Content 锚点改为左下
        this.scrollView.content.setAnchorPoint(0, 0);
        this.scrollView.content.y = 0;

        // 可见数量 & 缓冲区
        const viewHeight = this.scrollView.node.height;
        this.visibleCount = Math.ceil(viewHeight / (this.itemHeight + this.spacingY)) + 2;
        this.bufferZone = viewHeight / 2;

        // Content 总高度
        this.scrollView.content.height = this.totalCount * (this.itemHeight + this.spacingY) - diffY;

        // ⭐ 初始从底向上排布可见节点
        this.items.length = 0;
        for (let i = 0; i < this.visibleCount && i < this.totalCount; i++) {
            const itemNode = cc.instantiate(this.itemPrefab);
            itemNode.parent = this.scrollView.content;

            // y 从底部开始往上累加（正数）
            const y = (i + 0.5) * (this.itemHeight + this.spacingY);
            itemNode.setPosition(1000 / 2, y);

            const itemCell = itemNode.addComponent(ItemCell);
            itemCell.bindData(i, this.datas[i], this.bindDataCallback);
            itemCell.registerClick(this.clickCallback);
            this.items.push(itemNode);
        }

        // ⭐ 默认显示底部（聊天式上滚）
        if (this.startFromBottom) {
            this.scrollView.scrollToBottom();
        } else {
            this.scrollView.scrollToTop();
        }

        // 初始化后立即做一次显示/隐藏判定
        this._updateItemActivesByViewport();

        // 注册滚动事件
        this.scrollView.node.on('scrolling', this.onScrolling, this);
    }

    /**
     * 从“底部百分比”滚动（0=底部，1=顶部）
     * 需要“从底到顶”的语义时调用这个；如果想保持原版语义可以保留你的函数
     */
    public scrollToPercentFromBottom(percent: number, timeInSecond?: number) {
        percent = Math.max(0, Math.min(1, percent));
        // ScrollView 的0=顶, 1=底，这里做一次反转
        this.scrollView.scrollToPercentVertical(1 - percent, timeInSecond);

        // 根据 percent 计算起始数据下标（窗口顶部落在哪一行）
        const maxStart = Math.max(0, this.totalCount - this.visibleCount);
        const startIndex = Math.floor(maxStart * (1 - percent)); // 底→顶线性插

        for (let i = 0; i < this.items.length; i++) {
            const dataIndex = startIndex + i;
            const item = this.items[i];
            if (dataIndex >= this.totalCount) {
                item.active = false;
                continue;
            }
            item.active = true;

            const itemCell = item.getComponent(ItemCell);
            itemCell.bindData(dataIndex, this.datas[dataIndex], this.bindDataCallback);
            itemCell.registerClick(this.clickCallback);

            const y = (dataIndex + 0.5) * (this.itemHeight + this.spacingY);
            item.setPosition(1000 / 2, y);
        }

        // 百分比滚动后，刷新一次可见性
        this._updateItemActivesByViewport();
    }

    public destroyEvent() {
        if (this.scrollView) {
            this.scrollView.node.off('scrolling', this.onScrolling, this);
        }
        for (const item of this.items) {
            const itemCell = item.getComponent(ItemCell);
            itemCell.unregisterClick();
        }
    }

    /**
     * ⭐ 与方向无关的复用逻辑：
     * 超出“视图底部” → 往上挪到顶部并 +N 绑定新数据
     * 超出“视图顶部” → 往下挪到底部并 -N 绑定新数据
     */
    private onScrolling() {
        for (const item of this.items) {
            const itemCell = item.getComponent(ItemCell);
            const itemId = itemCell.getItemId();
            const viewPos = this.getPositionInView(item);

            const halfH = this.itemHeight / 2;
            const step = this.items.length * (this.itemHeight + this.spacingY);

            // 1) 从“视图底部”滑出 → 挪到顶部，索引 +N
            if (viewPos.y < -this.bufferZone - halfH) {
                const newId = itemId + this.items.length;
                if (newId < this.totalCount) {
                    item.y += step;
                    itemCell.bindData(newId, this.datas[newId], this.bindDataCallback);
                    itemCell.registerClick(this.clickCallback);
                }
            }
            // 2) 从“视图顶部”滑出 → 挪到底部，索引 -N
            else if (viewPos.y > this.bufferZone + halfH) {
                const newId = itemId - this.items.length;
                if (newId >= 0) {
                    item.y -= step;
                    itemCell.bindData(newId, this.datas[newId], this.bindDataCallback);
                    itemCell.registerClick(this.clickCallback);
                }
            }
        }

        // 每帧滚动后，更新显示/隐藏，确保不在视窗内的节点 inactive
        this._updateItemActivesByViewport();
    }

    private getPositionInView(item: cc.Node): cc.Vec3 {
        const worldPos = item.parent.convertToWorldSpaceAR(item.position);
        const viewPos = this.scrollView.node.convertToNodeSpaceAR(worldPos);
        return viewPos;
    }

    /**
     * ⭐ 仅负责“是否在视窗内”的判定与 active 切换
     * 规则：以 ScrollView 节点为原点，y 上下各 halfViewH；item 以中心位移 ± itemHeight/2 参与裁剪
     * 增加一个 margin（用 spacingY）避免边缘抖动
     */
    private _updateItemActivesByViewport() {
        const halfViewH = this.scrollView.node.height / 2;
        const margin = this.spacingY; // 防抖
        for (const item of this.items) {
            // 即使 item 当前是 inactive，也要继续参与判定与复用
            const viewPos = this.getPositionInView(item);
            const top = viewPos.y + this.itemHeight / 2;
            const bottom = viewPos.y - this.itemHeight / 2;

            const visible = !(bottom > halfViewH + margin || top < -halfViewH - margin);
            if (item.active !== visible) {
                item.active = visible;
            }
        }
    }
}
