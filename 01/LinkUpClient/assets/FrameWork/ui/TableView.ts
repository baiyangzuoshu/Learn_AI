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

// scripts/TableView/TableView.ts
/**
 * 通用的 TableView 组件
 * 负责管理 ScrollView 中的列表项复用
 */
export default class TableView extends cc.Component {
    private scrollView!: cc.ScrollView;
    private itemPrefab!: cc.Node;
    private itemHeight = 70;
    private spacingY = 10;
    private datas: unknown[] = [];
    private items: cc.Node[] = [];
    private visibleCount = 0;
    private bufferZone = 0;
    private totalCount = 0;
    private lastContentPosY = 0;

    // 数据绑定回调，由外部传入
    private bindDataCallback!: (node: cc.Node, data: unknown) => void;
    // 点击事件回调，由外部传入
    private clickCallback!: (itemId: number, node: cc.Node) => void;

    /**
     * 初始化 TableView
     * @param scrollView 目标 ScrollView 组件
     * @param itemPrefab 列表项预制体
     * @param itemHeight 单个 Item 的高度
     * @param spacingY Item 之间的垂直间距
     * @param datas 数据数组
     * @param bindCallback 数据绑定回调
     * @param clickCallback 点击事件回调
     */
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
        this.totalCount = this.datas.length;
        this.bindDataCallback = cb.bindCallback;
        this.clickCallback = cb.clickCallback;

        // 计算可见数量（根据 ScrollView 显示区域高度）
        const viewHeight = this.scrollView.node.height * 4 / 2;
        this.visibleCount = Math.ceil(viewHeight / (this.itemHeight + this.spacingY)) + 2;
        this.bufferZone = viewHeight / 2;

        // 设置 Content 的总高度
        this.scrollView.content.height = this.totalCount * (this.itemHeight + this.spacingY);

        // 初始化可见的节点池
        for (let i = 0; i < this.visibleCount && i < datas.length; i++) {
            const itemNode = cc.instantiate(this.itemPrefab);
            itemNode.parent = this.scrollView.content;
            itemNode.setPosition(0, -((i + 0.5) * (this.itemHeight + this.spacingY)));
            const itemCell = itemNode.addComponent(ItemCell);
            itemCell.bindData(i, this.datas[i], this.bindDataCallback);
            itemCell.registerClick(this.clickCallback);
            this.items.push(itemNode);
        }

        this.lastContentPosY = this.scrollView.content.y;
        this.scrollView.scrollToTop();
        // 注册滚动事件
        this.scrollView.node.on('scrolling', this.onScrolling, this);
    }
    //
    public scrollToPercentVertical(percent: number, timeInSecond?: number) {
        // 先让 ScrollView 滚动到指定位置
        this.scrollView.scrollToPercentVertical(1 - percent, timeInSecond);
        // 计算可见数据区域的起始索引
        let startIndex = Math.floor(this.totalCount * percent);
        if (startIndex >= 3) {
            startIndex = startIndex - 2;//居中展示
        }
        // 保证起始索引不会越界，特别是当滚动到末尾时
        startIndex = Math.min(startIndex, this.totalCount - this.visibleCount);

        // 遍历所有复用的 item 节点，更新它们的位置和数据绑定
        for (let i = 0; i < this.items.length; i++) {
            const dataIndex = startIndex + i;
            // 如果数据索引超出范围，则将该节点隐藏
            if (dataIndex >= this.totalCount) {
                //this.items[i].active = false;
            } else {
                this.items[i].active = true;
                // 获取组件，并更新绑定的数据
                const itemCell = this.items[i].getComponent(ItemCell);
                itemCell.bindData(dataIndex, this.datas[dataIndex], this.bindDataCallback);
                // 如果点击事件不需要重复注册，可在初始化后只注册一次（如果必要，这里可保留）
                itemCell.registerClick(this.clickCallback);
                // 根据数据索引计算新位置，公式示例：向下排列，每个 item 之间有间隔 spacingY
                const newY = -((dataIndex + 0.5) * (this.itemHeight + this.spacingY));
                this.items[i].setPosition(0, newY);
            }
        }

        // 更新最后一次记录的 content 坐标
        this.lastContentPosY = this.scrollView.content.y;
    }

    //
    public destroyEvent() {
        // 移除滚动事件监听
        if (this.scrollView) {
            this.scrollView.node.off('scrolling', this.onScrolling, this);
        }

        // 移除所有 Item 的点击事件监听
        for (const item of this.items) {
            const itemCell = item.getComponent(ItemCell);
            itemCell.unregisterClick();
        }
    }

    /**
     * 滚动事件处理
     */
    private onScrolling() {
        const currY = this.scrollView.content.y;
        const isScrollingDown = currY > this.lastContentPosY;

        for (const item of this.items) {
            const itemCell = item.getComponent(ItemCell);
            const itemId = itemCell.getItemId();
            const viewPos = this.getPositionInView(item);
            if (isScrollingDown) {
                // 往下滚动，检查是否需要复用到底部
                if (viewPos.y > this.bufferZone + this.itemHeight / 2) {
                    const newId = itemId + this.items.length;
                    if (newId < this.totalCount) {
                        const newY = item.y - this.items.length * (this.itemHeight + this.spacingY);
                        item.setPosition(0, newY);
                        itemCell.bindData(newId, this.datas[newId], this.bindDataCallback);
                        itemCell.registerClick(this.clickCallback);
                    }
                }
            } else {
                // 往上滚动，检查是否需要复用到顶部
                if (viewPos.y < -this.bufferZone - this.itemHeight / 2) {
                    const newId = itemId - this.items.length;
                    if (newId >= 0) {
                        const newY = item.y + this.items.length * (this.itemHeight + this.spacingY);
                        item.setPosition(0, newY);
                        itemCell.bindData(newId, this.datas[newId], this.bindDataCallback);
                        itemCell.registerClick(this.clickCallback);
                    }
                }
            }
        }

        this.lastContentPosY = currY;
    }

    /**
     * 获取节点在 ScrollView.view 上的坐标
     * @param item 节点
     */
    private getPositionInView(item: cc.Node): cc.Vec3 {
        const worldPos = item.parent.convertToWorldSpaceAR(item.position);
        const viewPos = this.scrollView.node.convertToNodeSpaceAR(worldPos);
        return viewPos;
    }
}

