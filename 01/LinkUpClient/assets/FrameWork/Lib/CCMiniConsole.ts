
const PATH = {
    scroll: 'New ScrollView',
    view: 'New ScrollView/view',
    content: 'New ScrollView/view/content',
    item: 'New ScrollView/view/content/item',
    toggleBtn: 'New Button', // 可选
};

export default class CCMiniConsole extends cc.Component {
    // 可调
    maxLines = 200;
    fontSize = 18;
    lineHeight= 22;
    leftPadding = 8;
    rightPadding = 8;
    autoFollowLatest= false; // 仅在底部或开启时才自动到底
    startHidden= true;

    // 引用
    private scroll!: cc.ScrollView;
    private viewNode!: cc.Node;
    private content!: cc.Node;
    private itemNode!: cc.Node;
    private label!: cc.Label;

    // 状态
    private lines: string[] = [];
    private raw: Partial<Record<keyof Console, (...args: unknown[]) => void>> = {};
    private static _hooked = false;

    // —— 场景里已放 UILog
    static bootFromScene(): CCMiniConsole | null {
        const scene = cc.director.getScene();
        const node = scene && scene.getChildByName('UILog');
        if (!node) { console.warn('[CCMiniConsole] 未找到 "UILog"'); return null; }
        let comp = node.getComponent(CCMiniConsole);
        if (!comp) comp = node.addComponent(CCMiniConsole);
        return comp;
    }
    // —— 代码实例化 UILog 预制
    static attachTo(root: cc.Node): CCMiniConsole {
        let comp = root.getComponent(CCMiniConsole);
        if (!comp) comp = root.addComponent(CCMiniConsole);
        return comp;
    }

    onLoad() {
        this.initRefs();
        this.initStyle();
        this.bindButtons();
        this.hookConsole();

        this.scroll.node.on('size-changed', this.onResize, this);
        this.viewNode.on('size-changed', this.onResize, this);

        if (this.startHidden) this.node.active = false;
    }
    onDestroy() {
        this.unhookConsole();
        this.scroll?.node?.off('size-changed', this.onResize, this);
        this.viewNode?.off('size-changed', this.onResize, this);
    }

    // ===== 引用
    private initRefs() {
        const find = (p: string) => cc.find(p, this.node);

        const scrollNode = find(PATH.scroll); if (!scrollNode) throw new Error(`[CCMiniConsole] 缺少: ${PATH.scroll}`);
        this.scroll = scrollNode.getComponent(cc.ScrollView); if (!this.scroll) throw new Error('ScrollView 组件缺失');
        this.scroll.horizontal = false;
        this.scroll.vertical = true;

        const view = find(PATH.view); if (!view) throw new Error(`[CCMiniConsole] 缺少: ${PATH.view}`);
        this.viewNode = view;

        const content = find(PATH.content); if (!content) throw new Error(`[CCMiniConsole] 缺少: ${PATH.content}`);
        this.content = content;
        this.scroll.content = this.content;

        const item = find(PATH.item); if (!item) throw new Error(`[CCMiniConsole] 缺少: ${PATH.item}`);
        this.itemNode = item;
        this.label = item.getComponent(cc.Label) || item.addComponent(cc.Label);
    }

    // ===== 样式
    private initStyle() {
        this.viewNode.anchorX = 0; this.viewNode.anchorY = 1;
        this.content.anchorX = 0; this.content.anchorY = 1;
        this.content.setPosition(0, 0);

        this.itemNode.anchorX = 0; this.itemNode.anchorY = 1;
        this.itemNode.x = this.leftPadding; this.itemNode.y = 0;

        this.label.string = '';
        this.label.fontSize = this.fontSize;
        this.label.lineHeight = this.lineHeight;
        this.label.enableWrapText = true;
        this.label.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
        this.label.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
        this.label.verticalAlign = cc.Label.VerticalAlign.TOP;
        this.label.node.color = cc.color(0, 0, 0);

        this.applyWrapWidth();
        const viewH = this.scroll.node.height;
        this.content.setContentSize(this.content.width, viewH);
        this.scroll.scrollToTop(0);
    }

    private onResize = () => {
        this.applyWrapWidth();
        this.refresh();
    }
    private applyWrapWidth() {
        const usableW = Math.max(0, this.viewNode.width - this.leftPadding - this.rightPadding);
        this.itemNode.width = usableW;
        this.label.node.width = usableW;
    }

    // ===== Hook console（一次性）
    private hookConsole() {
        if (CCMiniConsole._hooked) return;
        CCMiniConsole._hooked = true;

        ([
            ['log', 'LOG'], ['info', 'INFO'], ['warn', 'WARN'], ['error', 'ERROR'],
        ] as [keyof Console, string][]).forEach(([k, tag]) => {
            const raw = console[k];
            this.raw[k] = raw as (...args: unknown[]) => void;
            (console as unknown as Record<keyof Console, (...args: unknown[]) => void>)[k] = (...args: unknown[]) => {
                try { this.append(tag, args); } catch (error) { console.error('CCMiniConsole append error:', error); }
                if (raw) {
                    try {
                        (raw as (...args: unknown[]) => void).call(console, ...args);
                    } catch (e) {
                        console.error('调用原始 console 方法失败:', e);
                    }
                }
            };
        });
    }
    private unhookConsole() {
        (Object.keys(this.raw) as (keyof Console)[]).forEach(k => {
            if (this.raw[k]) {
                (console as unknown as Record<keyof Console, (...args: unknown[]) => void>)[k] = this.raw[k];
            }
        });
    }

    private toText(x: unknown): string {
        try {
            if (typeof x === 'string') return x;
            if (typeof x === 'number' || typeof x === 'boolean') return String(x);
            if (x === null) return 'null';
            if (x === undefined) return 'undefined';
            if (x instanceof Error) return x.stack || x.message || String(x);
            return JSON.stringify(x);
        } catch { try { return String(x); } catch { return '[?]'; } }
    }

    private append(tag: string, args: unknown[]) {
        const d = new Date(), z2 = (n: number) => ('0' + n).slice(-2);
        const line = `[${z2(d.getHours())}:${z2(d.getMinutes())}:${z2(d.getSeconds())}][${tag}] `
            + args.map(a => this.toText(a)).join(' ');
        if (this.lines.length >= this.maxLines) this.lines.shift();
        this.lines.push(line);
        this.refresh();
    }

    // ===== 刷新（同步测量 Label 高度，确保 content 增长；不抢手势）
    private refresh() {
        const oldMaxY = this.scroll.getMaxScrollOffset().y;
        const oldOffY = this.scroll.getScrollOffset().y;
        const wasAtBottom = this.isAtBottom(oldMaxY, oldOffY);
        const dragging = this.isDragging();

        this.label.string = this.lines.join('\n');

        // ★ 关键：同步强制刷新 Label 渲染数据，立即得到正确高度
        this.forceUpdateLabelRenderData();

        // 现在读取到的就是最新高度
        const viewH = this.scroll.node.height;
        const newContentH = Math.max(this.label.node.height + 8, viewH);
        this.content.setContentSize(this.content.width, newContentH);

        //const newMaxY = this.scroll.getMaxScrollOffset().y;
        //const delta = Math.max(0, newMaxY - oldMaxY);

        if (!dragging && (this.autoFollowLatest || wasAtBottom)) {
            this.scroll.scrollToBottom(0.1);
            return;
        }
        // 不在底部默认不动 offset（确保可自由拖拽）
        // 如需尽量维持视觉位置，可启用下行：
        // if (!dragging && delta > 0) this.scroll.scrollToOffset(cc.v2(0, Math.max(0, oldOffY + delta)), 0);
    }

    // 同步强制刷新 Label 的渲染数据（2.x 私有 API 兼容调用）
    private forceUpdateLabelRenderData() {
        const anyLbl = this.label as cc.Label & {
            _forceUpdateRenderData?: (force?: boolean) => void;
            _updateRenderData?: (force?: boolean) => void;
            updateRenderData?: (force?: boolean) => void;
        };
        try {
            if (anyLbl._forceUpdateRenderData) { anyLbl._forceUpdateRenderData(true); return; }
            if (anyLbl._updateRenderData) { anyLbl._updateRenderData(true); return; }
            if (anyLbl.updateRenderData) { anyLbl.updateRenderData(true); return; }
            // 兜底：触发一次尺寸变动
            this.label.node.setContentSize(this.label.node.getContentSize()); // 通过设置相同尺寸触发重渲染
        } catch { /* 忽略 */ }
    }

    private isAtBottom(maxY?: number, offY?: number): boolean {
        const _max = (maxY !== undefined ? maxY : this.scroll.getMaxScrollOffset().y);
        const _off = (offY !== undefined ? offY : this.scroll.getScrollOffset().y);
        if (_max <= 0) return false;         // 未溢出不算底部
        return _off >= (_max - 10);
    }
    private isDragging(): boolean {
        const sv = this.scroll;
        return !!(sv && (sv.isScrolling() || (sv as cc.ScrollView & { _isBouncing: boolean; _isAutoScrolling: boolean })._isBouncing || (sv as cc.ScrollView & { _isBouncing: boolean; _isAutoScrolling: boolean })._isAutoScrolling));
    }

    // ===== 按钮（可选）
    private bindButtons() {
        const toggle = cc.find(PATH.toggleBtn, this.node);
        if (toggle) toggle.on(cc.Node.EventType.TOUCH_END, () => this.toggle(), this);

        const bindByText = (names: string[], cb: () => void) => {
            const stack: cc.Node[] = [this.node];
            while (stack.length) {
                const n = stack.pop();
                if (!n) break;
                const lbl = n.getComponent(cc.Label);
                if (lbl && names.indexOf(lbl.string.trim()) >= 0) {
                    n.on(cc.Node.EventType.TOUCH_END, cb, this);
                    return;
                }
                stack.push(...n.children);
            }
        };
        bindByText(['清空', 'Clear'], () => this.clear());
        bindByText(['复制', 'Copy'], () => this.copyAll());
        bindByText(['关闭', 'Close'], () => this.hide());
    }

    private copyAll() {
        console.log('复制所有日志');
    }

    // ===== 控制 API
    public show() { this.node.active = true; }
    public hide() { this.node.active = false; }
    public toggle() { this.node.active = !this.node.active; }
    public clear() { this.lines.length = 0; this.refresh(); this.scroll.scrollToTop(0); }
}
