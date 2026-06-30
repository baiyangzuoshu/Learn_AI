import { ResManager } from "../../FrameWork/manager/ResManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import UpTableView from "../../FrameWork/ui/UpTableView";
import { util } from "../../FrameWork/Utils/util";
import { ArtPath, BundleName, GameState, SoundID } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import GKItem from "./gkItem";

const itemDiff = 2;
const lens = [4, 10, 10, 10];

export default class MainMap extends UIComponent {
    private myScrollView!: cc.ScrollView;
    private cloneItem!: cc.Node;
    private itemArr: number[] = [];
    private cloneGKItem!: cc.Node;

    // 模板：状态子节点（只做模板，不直接复用引用）
    private tmplSelect!: cc.Node;
    private tmplLock!: cc.Node;
    private tmplComplete!: cc.Node;

    private tableView!: UpTableView;
    private idsArr: number[] = [];
    private gkIndex = 0;
    private realHeight = 0;
    private itemHeight = 2001;

    private _gkCache: cc.Node[] = [];        // 闲置 GKItem 缓存
    private _recycleRoot!: cc.Node;           // 隐藏回收根
    private PREWARM_GK = 20;                  // 预热数量
    private GK_CACHE_MAX = 200;                // 缓存上限
    private _gkLayer!: cc.Node;               // GK 独立层
    private _gkMap: Map<number, cc.Node> = new Map<number, cc.Node>(); // id→GK 节点
    private gkItems: Map<number, cc.Node> = new Map<number, cc.Node>();

    // 窗口收缩控制
    private _lastCheckY = 1e9;
    private _lastCheckTs = 0;
    private readonly _CHECK_STEP = 24;
    private readonly _CHECK_MIN_MS = 50;
    private readonly _KEEP_COUNT = 30;

    private FX_guankaPrefab!: cc.Prefab;
    private nongminPrefab!: cc.Prefab;
    private nongmintiaoPrefab!: cc.Prefab;
    private nongmincahanPrefab!: cc.Prefab;
    private FX_duigouPrefab!: cc.Prefab;
    private FX_jiesuoPrefab!: cc.Prefab;
    private curPhase = -1;
    onLoad() {
        super.onLoad();
        this.initData();

        // GKItem 原型（瘦身：去掉三套状态子树）
        this.cloneGKItem = this.node.getChildByName("item");

        // 隐藏回收根
        this._recycleRoot = new cc.Node("gk-recycle-root");
        this._recycleRoot.active = false;
        this.node.addChild(this._recycleRoot);

        // —— 抽取状态模板：从 cloneGKItem 拆出，挂到隐藏根里 —— //
        const sel = this.cloneGKItem.getChildByName("select");
        const lock = this.cloneGKItem.getChildByName("lock");
        const comp = this.cloneGKItem.getChildByName("complete");
        if (sel) { sel.removeFromParent(false); sel.active = false; sel.parent = this._recycleRoot; this.tmplSelect = sel; }
        if (lock) { lock.removeFromParent(false); lock.active = false; lock.parent = this._recycleRoot; this.tmplLock = lock; }
        if (comp) { comp.removeFromParent(false); comp.active = false; comp.parent = this._recycleRoot; this.tmplComplete = comp; }

        // 预热 GK 缓存（不带状态子树）
        for (let i = 0; i < this.PREWARM_GK; i++) {
            const n = cc.instantiate(this.cloneGKItem);
            n.active = false;
            n.parent = this._recycleRoot;
            this._gkCache.push(n);
        }
        GameManager.getInstance().state = GameState.None;
        if (PlayerManager.getInstance().pass_stage >= GameManager.getInstance().maxMapID) {
            GameManager.getInstance().isWin = false;
        }
    }

    async loadTableView(height: number) {
        this.realHeight = height;
        await this.preloadAssets();

        this.loadMap();
    }

    onEnable() {
        this.myScrollView?.node.on('scrolling', this._onSVScrolling, this);
    }
    onDisable() {
        this.myScrollView?.node.off('scrolling', this._onSVScrolling, this);
    }

    startTouch() {
        this.node.getChildByName("touch").active = false;
    }

    async preloadAssets() {
        this.FX_guankaPrefab = await ResManager.Instance.IE_GetAsset(
            BundleName.BundleMain, ArtPath.FX_guankakaishi, cc.Prefab
        ) as cc.Prefab;
        this.FX_jiesuoPrefab = await ResManager.Instance.IE_GetAsset(
            BundleName.BundleMain, ArtPath.FX_jiesuo, cc.Prefab
        ) as cc.Prefab;
        this.FX_duigouPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_duigou, cc.Prefab) as cc.Prefab;
        this.FX_guankaPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_guanka, cc.Prefab) as cc.Prefab;
        this.nongminPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.nongmin, cc.Prefab) as cc.Prefab;
        this.nongmintiaoPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.nongmintiao, cc.Prefab) as cc.Prefab;
        this.nongmincahanPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.nongmincahan, cc.Prefab) as cc.Prefab;
    }

    loadMap() {
        const itemTemplate = this.node.getChildByName("ScrollView").getChildByName("view").getChildByName("content").getChildByName("item");
        this.cloneItem = cc.instantiate(itemTemplate);
        for (let i = 0; i < 3; i++) {
            const ms = this.cloneItem.getChildByName("main space" + i);
            const gk = ms.getChildByName("gk");
            for (let j = 1; j <= 10; j++) {
                const gkItem = gk.getChildByName("gk" + j);
                gkItem.removeAllChildren();
            }
        }
        this.myScrollView = this.node.getChildByName("ScrollView").getComponent(cc.ScrollView);
        this.myScrollView.content.removeAllChildren();

        // gkLayer
        this._gkLayer = new cc.Node("gk-layer");
        this.myScrollView.content.addChild(this._gkLayer);

        this.node.getChildByName("ScrollView").getChildByName("view").setContentSize(cc.size(this.myScrollView.content.width, this.realHeight));
        this.myScrollView.node.setContentSize(cc.size(this.myScrollView.content.width, this.realHeight));

        // UpTableView
        this.tableView = this.myScrollView.node.addComponent(UpTableView);
        const bindCallback = this.bindRankItem.bind(this);
        const clickCallback = this.onTableViewItemClick.bind(this);

        this.gkIndex = PlayerManager.getInstance().getMapID();
        if (PlayerManager.getInstance().getMapID() >= GameManager.getInstance().maxMapID) {
            this.gkIndex = GameManager.getInstance().maxMapID;
        }
        if (GameManager.getInstance().isWin) this.gkIndex = PlayerManager.getInstance().getMapID() - 1;

        const diffY = 0;
        this.tableView.initialize(
            { scrollView: this.myScrollView, itemPrefab: this.cloneItem, itemHeight: this.itemHeight, spacingY: 0, diffY: diffY },
            this.itemArr,
            { bindCallback: bindCallback, clickCallback: clickCallback }
        );

        this._gkLayer.setSiblingIndex(this.myScrollView.content.childrenCount - 1);
        this.node.opacity = 0;
        this.scheduleOnce(() => {
            this.jumpToMap(false);
            this.node.opacity = 255;
            this.jumpToMap(true);
            this._shrinkToWindowByCurrentRow();
        }, 0.05);
    }

    jumpToBottom(index: number, isAction: boolean) {

        const ROW_GK = 10;

        const levelId = Math.max(1, index);
        const rowIdx = Math.floor((levelId - 1) / ROW_GK);
        const colIdx = (levelId - 1) % ROW_GK;

        const itemNode = this.cloneItem;
        const bgId = this.idsArr[rowIdx] || 1;

        const item = itemNode.getChildByName("main space" + bgId);
        const gkNode = item.getChildByName("gk");
        const gk = gkNode.getChildByName("gk" + (colIdx + 1));

        const content = this.myScrollView.content;

        const viewH = this.myScrollView.node.height;
        const contentH = content.height;

        // ---------- 计算目标关卡真实位置 ----------
        const off = this._offsetToAncestor(gk, itemNode);

        const itemCenterY = (rowIdx + 0.5) * this.itemHeight;

        const targetY = itemCenterY + off.y;

        // ---------- 计算滚动位置 ----------
        let scrollY = targetY + viewH * 0.3;

        scrollY = cc.misc.clampf(scrollY, 0, contentH - viewH);

        const percentFromBottom = scrollY / (contentH - viewH);

        const time = Math.min(2, index * 0.1);

        this.tableView.scrollToPercentFromBottom(
            1 - percentFromBottom,
            isAction ? time : 0
        );

        if (isAction && time > 0) {
            this.scheduleOnce(() => {
                this._shrinkToWindowByCurrentRow();
            }, time + 0.02);
        } else {
            this._shrinkToWindowByCurrentRow();
        }
    }

    jumpToMap(isAction: boolean) {
        let index = PlayerManager.getInstance().getMapID();
        SoundManager.Instance.PlaySound(SoundID.point);
        const time = Math.min(2, index * 0.1);
        if (GameManager.getInstance().isWin) {
            this.scheduleOnce(() => {
                this.showWin();
                this.startTouch();
                cc.tween(this.myScrollView.node)
                    .delay(1.0)
                    .call(() => {
                        this.gkIndex = PlayerManager.getInstance().getMapID();
                        GameManager.getInstance().isWin = false;
                    })
                    .start();
            }, time + 0.3);
            index = index - 1;
        }
        else {
            this.startTouch();
        }
        this.jumpToBottom(index, isAction);
    }

    showWin() {
        const index = PlayerManager.getInstance().getMapID();
        this.jumpToBottom(index, true);

        const curItem = this.gkItems.get(index - 1);
        const nextItem = this.gkItems.get(index);
        if (!curItem || !nextItem) return;

        // 通过模板“确保”状态节点存在
        const selectCur = this.ensureStateNode(curItem, "select");
        const completeCur = this.ensureStateNode(curItem, "complete");

        const selectNext = this.ensureStateNode(nextItem, "select");
        const lockNext = this.ensureStateNode(nextItem, "lock");

        const completeNum = completeCur.getChildByName("num");
        if (completeNum) completeNum.getComponent(cc.Label).string = (index - 1).toString();

        const selectCurNum = selectCur.getChildByName("b1").getChildByName("num");
        if (selectCurNum) selectCurNum.getComponent(cc.Label).string = (index - 1).toString();

        const lockNextNum = lockNext.getChildByName("num");
        if (lockNextNum) lockNextNum.getComponent(cc.Label).string = (index).toString();

        const selectNextNum = selectNext.getChildByName("b1").getChildByName("num");;
        if (selectNextNum) selectNextNum.getComponent(cc.Label).string = index.toString();

        let ts = curItem.getComponent(GKItem);
        if (!ts) ts = curItem.addComponent(GKItem);
        ts.setData(index - 1);

        let ts2 = nextItem.getComponent(GKItem);
        if (!ts2) ts2 = nextItem.addComponent(GKItem);
        ts2.setData(index);

        // 切换前的显示状态
        selectNext.active = false;

        // ========== 解锁特效（下一关） ==========
        const FX_jiesuo = lockNext.getChildByName("FX_jiesuo");
        if (FX_jiesuo) {
            let jiesuo = FX_jiesuo.getChildByName("jiesuo");
            if (!jiesuo) {
                jiesuo = cc.instantiate(this.FX_jiesuoPrefab);
                jiesuo.parent = FX_jiesuo;
                jiesuo.setPosition(0, -58, 0);
            }
            const lockIcon = FX_jiesuo.getChildByName("lock");
            if (lockIcon) lockIcon.active = false;
            jiesuo.getComponent(cc.Animation)?.play("jiesuokai");
        }

        // ========== 当前关卡里的农民跳跃 & 切换到下一关 ==========

        const nongmincahanRoot = selectCur.getChildByName("nongmincahan");
        const nongmin = nongmincahanRoot?.getChildByName("nongmin");
        const nongmintiao = nongmin?.getChildByName("nongmintiao")?.getChildByName("nongmintiao");
        const nongmincahan = nongmin?.getChildByName("nongmincahan")?.getChildByName("nongmincahan");

        const nongmincahanRoot2 = selectNext.getChildByName("nongmincahan");
        let nongmin2 = nongmincahanRoot2.getChildByName("nongmin");
        if (!nongmin2) {
            nongmin2 = cc.instantiate(this.nongminPrefab);
            nongmin2.parent = nongmincahanRoot2;
            nongmin2.setPosition(0, 100, 0);

            const nmCahanNode = nongmin2.getChildByName("nongmincahan");
            const nmTiaoNode = nongmin2.getChildByName("nongmintiao");

            const nmCahan = cc.instantiate(this.nongmincahanPrefab);
            nmCahan.parent = nmCahanNode;
            nmCahan.setPosition(0, 0, 0);
            nmCahan.active = true;

            const nmTiao = cc.instantiate(this.nongmintiaoPrefab);
            nmTiao.parent = nmTiaoNode;
            nmTiao.setPosition(0, 0, 0);
            nmTiao.active = false;

            nmCahan.getComponent(cc.Animation)?.play("cahan");
        }

        if (nongmin && nongmintiao && nongmincahan) {
            const worldPos = nongmin2.convertToWorldSpaceAR(cc.v3(0, 0, 0));
            const nodePos = nongmin.convertToNodeSpaceAR(worldPos);

            // 当前关卡：先切到跳跃动画
            nongmincahan.active = false;
            nongmintiao.active = true;
            nongmintiao.setPosition(cc.v2(0, -10));
            nongmintiao.getComponent(cc.Animation)?.play("mntiao");
            nongmintiao.getComponent(cc.Animation)?.once("finished", () => {
                this.loadSelect(selectNext);                // 下一关装饰
                nongmincahan.active = true;
                nongmintiao.active = false;
                nongmincahan.getComponent(cc.Animation)?.play("cahan");
            }, this);

            const playJumpTime = 0.55;
            cc.tween(nongmin)
                .parallel(
                    cc.tween().to(playJumpTime, { position: cc.v3(nodePos.x, nodePos.y + 100, 0) }),
                    cc.tween().to(playJumpTime / 2, { scale: 1.2 }).to(playJumpTime / 2, { scale: 1 })
                )
                .delay(playJumpTime - 0.3)
                .call(() => { SoundManager.Instance.PlaySound(SoundID.main2); })
                .delay(0.3)
                .delay(1.5)
                .call(() => {
                    selectCur.active = false;
                    nongmintiao.active = false;
                })
                .start();
        }

        // ========== 绿勾动画（当前关卡完成） ==========
        const node8 = completeCur.getChildByName("8");
        if (node8) {
            node8.removeAllChildren();
            node8.getComponent(cc.Sprite).enabled = false;

            const duigou = cc.instantiate(this.FX_duigouPrefab);
            duigou.parent = node8;
            duigou.setPosition(0, 0, 0);
            duigou.getComponent(cc.Animation)?.play("duigou");
            duigou.getComponent(cc.Animation)?.once("finished", () => {
                node8.getComponent(cc.Sprite).enabled = true;
                duigou.destroy();
            }, this);
        }

        // ========== 下一个关卡的“关卡开始”FX ==========
        const playGK = selectNext.getChildByName("playGK");
        if (playGK) {
            playGK.removeAllChildren();
            const guanka = cc.instantiate(this.FX_guankaPrefab);
            guanka.parent = playGK;
            guanka.setPosition(0, 0, 0);
            guanka.active = false;
        }

        // 橙→蓝按钮过渡（当前关卡变完成）
        const b = selectCur.getChildByName("b1")?.active ? selectCur.getChildByName("b1") : selectCur.getChildByName("b2");
        if (b) {
            cc.tween(b)
                .to(0.20, { scale: 0.8 })
                .call(() => {
                    b.active = false;
                    completeCur.active = true;
                })
                .start();
        }

        // 最后把“下一关”从锁状态切到选中状态
        cc.tween(this.node)
            .delay(0.7)
            .call(() => {
                // 这里如果有“开场FX”节点名叫 guanka（在 playGK 里），你也可以在上面已经创建了
                // 这里只做状态切换，避免对 null 赋值
            })
            .delay(0.5)
            .call(() => {
                lockNext.active = false;
                selectNext.active = true;
            })
            .start();
    }

    // 滚动限频触发
    private _onSVScrolling() {
        const y = this.myScrollView.content.y;
        const now = Date.now();
        if (Math.abs(y - this._lastCheckY) < this._CHECK_STEP && (now - this._lastCheckTs) < this._CHECK_MIN_MS) return;
        this._lastCheckY = y;
        this._lastCheckTs = now;
        this._shrinkToWindowByCurrentRow();
    }

    // 工具：计算行起始 id 与长度
    private _rowRange(idx: number): { startId: number, length: number } {
        let start = 0;
        for (let i = 0; i < idx; i++) {
            const bg = (i === 0) ? 0 : (this.idsArr[i] || 1);
            start += lens[bg];
        }
        const bgId = (idx === 0) ? 0 : (this.idsArr[idx] || 1);
        const len = lens[bgId];
        return { startId: start + 1, length: len };
    }

    private _getViewCenterYInContent(): number {
        const view = this.myScrollView.node;
        const content = this.myScrollView.content;
        const centerWorld = view.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const centerInContent = content.convertToNodeSpaceAR(centerWorld);
        return centerInContent.y;
    }

    private _currentRowByScroll(): number {
        const rows = this.itemArr.length;
        const y = this._getViewCenterYInContent();
        return cc.misc.clampf(Math.floor(y / this.itemHeight), 0, rows - 1);
    }

    private _rowIndexById(id: number): number {
        let acc = 0;
        for (let row = 0; row < this.itemArr.length; row++) {
            const bg = (row === 0) ? 0 : (this.idsArr[row] || 1);
            const len = lens[bg];
            const startId = acc + 1, endId = acc + len;
            if (id >= startId && id <= endId) return row;
            acc += len;
        }
        return 0;
    }

    // 核心：仅保留 _KEEP_COUNT 个 GK，其他回收
    private _shrinkToWindowByCurrentRow() {
        const rows = this.itemArr.length;
        const centerRow = this._currentRowByScroll();

        const keep = new Set<number>();
        let lo = centerRow, hi = centerRow;
        while (keep.size < this._KEEP_COUNT && (lo >= 0 || hi < rows)) {
            if (lo >= 0) {
                const { startId, length } = this._rowRange(lo);
                for (let i = 0; i < length && keep.size < this._KEEP_COUNT; i++) keep.add(startId + i);
                lo--;
            }
            if (hi < rows && keep.size < this._KEEP_COUNT) {
                const { startId, length } = this._rowRange(hi);
                for (let i = 0; i < length && keep.size < this._KEEP_COUNT; i++) keep.add(startId + i);
                hi++;
            }
        }

        for (const [id, node] of Array.from(this._gkMap.entries())) {
            if (!keep.has(id)) {
                if (node && cc.isValid(node)) this.recycleGKItem(node);
                this._gkMap.delete(id);
                this.gkItems.delete(id);
            }
        }

        if (this._gkMap.size > this._KEEP_COUNT) {
            const toSort: [number, cc.Node, number][] = [];
            for (const entry of Array.from(this._gkMap.entries())) {
                const [id, node] = entry;
                const row = this._rowIndexById(id);
                const dist = Math.abs(row - centerRow);
                toSort.push([id, node, dist]);
            }
            toSort.sort((a, b) => b[2] - a[2]);
            for (let i = 0; i < toSort.length - this._KEEP_COUNT; i++) {
                const [id, node] = toSort[i];
                if (cc.isValid(node)) this.recycleGKItem(node);
                this._gkMap.delete(id);
                this.gkItems.delete(id);
            }
        }
    }

    // —— 状态模板懒挂载工具 —— //
    private ensureStateNode(parent: cc.Node, name: "select" | "complete" | "lock"): cc.Node {
        let n = parent.getChildByName(name);
        if (n && cc.isValid(n)) { n.active = true; return n; }
        let tmpl: cc.Node | undefined;
        if (name === "select") tmpl = this.tmplSelect;
        else if (name === "complete") tmpl = this.tmplComplete;
        else tmpl = this.tmplLock;
        if (!tmpl) {
            // 容错：模板丢失就直接创建空节点，避免崩溃
            n = new cc.Node(name);
            n.parent = parent;
            n.setPosition(0, 0, 0);
            return n;
        }
        n = cc.instantiate(tmpl);
        n.name = name;
        n.parent = parent;
        n.setPosition(0, 0, 0);
        n.active = true;
        return n;
    }

    private clearOtherStates(parent: cc.Node, keep: ("select" | "complete" | "lock")[]) {
        const names: ("select" | "complete" | "lock")[] = ["select", "complete", "lock"];
        for (const nm of names) {
            const c = parent.getChildByName(nm);
            if (c && keep.indexOf(nm) === -1) c.active = false;
        }
    }
    /** 四轮固定：每10个一轮；仅显示当前相位；桥：1-2、2-3、3-4、4-1；tspace规则同原版 */
    private _setupFourPhaseBlock(item: cc.Node, idx: number) {
        // 1) 相位/位置
        const SECTION_NAMES = ["1", "2", "3", "4"];
        const sectionCount = SECTION_NAMES.length; // 4
        const GROUP = 10;

        const phase = Math.floor(idx / GROUP) % sectionCount; // 0..3
        const pos = idx % GROUP;                               // 0..9
        const isBoundary = (pos === 0);
        if (phase != this.curPhase) {
            this.curPhase = phase;
            //this.getChildByUrl("bottom/shadow1").active = (phase === 0);
            //this.getChildByUrl("bottom/shadow2").active = (phase === 1);
            //this.getChildByUrl("bottom/shadow3").active = (phase === 2);
            //this.getChildByUrl("bottom/shadow4").active = (phase === 3);
        }

        // 2) 缓存
        const cacheKey = "__fourPhaseCache__";
        interface Cache {
            sections: (cc.Node | null)[],
            bridge12: cc.Node | null,
            bridge23: cc.Node | null,
            bridge34: cc.Node | null,
            bridge41: cc.Node | null,   // ★ 新增：4→1
            tspace2: cc.Node | null,
            tspace3: cc.Node | null,
            tspace4: cc.Node | null,
        }
        let cache = (item as unknown as Record<string, unknown>)[cacheKey] as Cache | undefined;
        if (!cache) {
            const sections = SECTION_NAMES.map(n => item.getChildByName(n));

            const bridge12 = item.getChildByName("1-2");
            const bridge23 = item.getChildByName("2-3");
            const bridge34 = item.getChildByName("3-4");
            const bridge41 = item.getChildByName("4-1");

            const tspace2 = item.getChildByName("2")?.getChildByName("main space2")?.getChildByName("main space2") || null;
            const tspace3 = item.getChildByName("3")?.getChildByName("main space3")?.getChildByName("main space3") || null;
            const tspace4 = item.getChildByName("4")?.getChildByName("main space4")?.getChildByName("main space4") || null;

            cache = { sections, bridge12, bridge23, bridge34, bridge41, tspace2, tspace3, tspace4 };
            (item as unknown as Record<string, unknown>)[cacheKey] = cache;
        }

        const setActive = (n: cc.Node | null, v: boolean) => { if (n && n.active !== v) n.active = v; };

        // 3) 仅显示当前相位
        cache.sections.forEach((node, i) => setActive(node, i === phase));

        // 4) 分界桥：进入相位1/2/3/0时显示 1-2 / 2-3 / 3-4 / 4-1（首帧 idx=0 不触发）
        setActive(cache.bridge12, isBoundary && phase === 1);
        setActive(cache.bridge23, isBoundary && phase === 2);
        setActive(cache.bridge34, isBoundary && phase === 3);
        setActive(cache.bridge41, isBoundary && phase === 0 && idx !== 0);  // ★ 4→1

        // 与你对 3-4 的处理对称：进入 phase=3 时隐藏 "4"，进入 phase=0 时隐藏 "1"（但 idx=0 例外）
        if (isBoundary && phase === 3) {
            setActive(item.getChildByName("4"), false);
        }
        if (isBoundary && phase === 0 && idx !== 0) { // ★
            setActive(item.getChildByName("1"), false);
        }

        // 5) tspace 规则：相位2/3/4时，pos==1 关，其它开
        setActive(cache.tspace2, phase === 1 ? (pos !== 1) : false);
        setActive(cache.tspace3, phase === 2 ? (pos !== 1) : false);
        setActive(cache.tspace4, phase === 3 ? (pos !== 1) : false);
    }

    private bindRankItem(node: cc.Node, index: unknown) {
        const idx = index as number;
        const bgSeq: number[] = [2, 1];
        const mod = function (n: number, m: number) { return ((n % m) + m) % m; }
        let bgId = bgSeq[mod(idx, bgSeq.length)];

        for (let i = 0; i < 3; i++) {
            const item = node.getChildByName("main space" + i);
            item.setSiblingIndex(i + 1);
            item.active = false;
        }

        let item = node.getChildByName("main space" + bgId);
        if (0 == idx) {
            bgId = 0;
            item = node.getChildByName("main space0");
        }

        item.active = true;
        this._setupFourPhaseBlock(item, idx as number);

        item.setSiblingIndex(4);

        let startIndex = 0;
        for (let i = 0; i < idx; i++) startIndex += lens[this.idsArr[i]];

        const gkNode = item.getChildByName("gk");
        for (let i = 1; i <= lens[bgId]; i++) {
            const id = startIndex + i;
            const gk = gkNode.getChildByName("gk" + i);

            // 回收同 id 旧节点
            const old = this._gkMap.get(id);
            if (old && cc.isValid(old)) {
                this.recycleGKItem(old);
                this._gkMap.delete(id);
            }

            const gkItem = this.spawnGKItem();

            const itemNode = node;
            const itemCenterX = itemNode.x;
            const itemCenterY = (idx + 0.5) * (this.itemHeight + 0);
            const off = this._offsetToAncestor(gk, itemNode);

            gkItem.parent = this._gkLayer;
            gkItem.setPosition(itemCenterX + off.x, itemCenterY + off.y);
            gkItem.setSiblingIndex(0);
            gkItem.active = GameManager.getInstance().maxMapID >= (id - 1);

            this._gkMap.set(id, gkItem);
            this.gkItems.set(id, gkItem);

            // —— 懒挂载状态节点 —— //
            // 先全部隐藏
            this.clearOtherStates(gkItem, []);

            if (this.gkIndex == id) {
                const select = this.ensureStateNode(gkItem, "select");
                const b1 = select.getChildByName("b1");
                const b2 = select.getChildByName("b2");
                if (b1) b1.getChildByName("num").getComponent(cc.Label).string = id + "";
                if (b2) b2.getChildByName("num").getComponent(cc.Label).string = id + "";
                this.clearOtherStates(gkItem, ["select"]);

                // FX 控制
                this.loadSelect(select);
                const FX_guanka = select.getChildByName("FX_guanka");
                if (FX_guanka) FX_guanka.active = !GameManager.getInstance().isWin;
                const playGK2 = select.getChildByName("playGK");
                if (playGK2) playGK2.active = !GameManager.getInstance().isWin;
            }
            else if (PlayerManager.getInstance().getMapID() > id) {
                const complete = this.ensureStateNode(gkItem, "complete");
                complete.getChildByName("num").getComponent(cc.Label).string = id + "";
                this.clearOtherStates(gkItem, ["complete"]);
            }
            else {
                const lock = this.ensureStateNode(gkItem, "lock");
                lock.getChildByName("num").getComponent(cc.Label).string = id + "";
                const ret = id >= GameManager.getInstance().maxMapID && PlayerManager.getInstance().pass_stage >= GameManager.getInstance().maxMapID;
                const fx = lock.getChildByName("FX_jiesuo");
                const pass = lock.getChildByName("pass");
                if (fx) fx.active = !ret;
                if (pass) pass.active = ret;
                this.clearOtherStates(gkItem, ["lock"]);
            }

            let ts = gkItem.getComponent(GKItem);
            if (!ts) ts = gkItem.addComponent(GKItem);
            ts.setData(id);
        }

        // 下一帧收缩
        this.scheduleOnce(() => { this._shrinkToWindowByCurrentRow(); }, 0);
    }

    loadSelect(select: cc.Node) {
        const FX_guanka = select.getChildByName("FX_guanka");
        const nongmincahanRoot = select.getChildByName("nongmincahan");
        let guanka = FX_guanka.getChildByName("FX_guanka");
        if (!guanka && FX_guanka) {
            guanka = cc.instantiate(this.FX_guankaPrefab);
            guanka.parent = FX_guanka;
            guanka.setPosition(0, 0, 0);
            guanka.getComponent(cc.Animation).play("guanka");
        }

        let nongmin = nongmincahanRoot.getChildByName("nongmin");
        if (nongmin) return;

        nongmin = cc.instantiate(this.nongminPrefab);
        nongmin.parent = nongmincahanRoot;
        nongmin.setPosition(0, 100, 0);
        const nongmincahanNode = nongmin.getChildByName("nongmincahan");
        const nongmintiaoNode = nongmin.getChildByName("nongmintiao");

        const nongmincahan2 = cc.instantiate(this.nongmincahanPrefab);
        nongmincahan2.parent = nongmincahanNode;
        nongmincahan2.setPosition(0, 0, 0);
        nongmincahan2.active = true;

        const nongmintiao2 = cc.instantiate(this.nongmintiaoPrefab);
        nongmintiao2.parent = nongmintiaoNode;
        nongmintiao2.setPosition(0, 0, 0);
        nongmintiao2.active = false;

        nongmincahan2.getComponent(cc.Animation).play("cahan");
    }

    initData() {
        //GameManager.getInstance().maxMapID = 1001;
        const max = GameManager.getInstance().maxMapID;
        const len = max / 20 * itemDiff;
        for (let i = 0; i <= len; i++) this.itemArr.push(i);

        for (let idx = 0; idx < 99999; idx++) {
            const bgSeq: number[] = [2, 1];
            const mod = function (n: number, m: number) { return ((n % m) + m) % m; }
            const bgId = bgSeq[mod(idx, bgSeq.length)];
            if (!this.idsArr[idx]) this.idsArr[idx] = bgId;
        }
        this.idsArr[0] = 0;
    }

    private onTableViewItemClick(itemId: number, node: cc.Node) {
        util.Log("onTableViewItemClick", itemId, node);
    }

    private spawnGKItem(): cc.Node {
        let node: cc.Node | undefined = this._gkCache.pop();
        if (!node || !cc.isValid(node)) node = cc.instantiate(this.cloneGKItem);
        node.active = true;
        return node;
    }

    private recycleGKItem(n: cc.Node) {
        if (!n || !cc.isValid(n)) return;
        n.stopAllActions?.();
        n.active = false;
        n.parent = this._recycleRoot;

        if (this._gkCache.length < this.GK_CACHE_MAX) {
            this._gkCache.push(n);
        } else {
            util.Log("recycleGKItem 缓存已满，直接销毁", n);
            n.destroy();
        }
    }

    private _offsetToAncestor(n: cc.Node, ancestor: cc.Node): cc.Vec2 {
        let x = 0, y = 0;
        for (let p: cc.Node | null = n; p && p !== ancestor; p = p.parent) {
            x += p.x;
            y += p.y;
        }
        return cc.v2(x, y);
    }

    onDestroy() {
        for (const n of this._gkCache) {
            if (cc.isValid(n)) n.destroy();
        }
        this._gkCache.length = 0;

        if (this._recycleRoot && cc.isValid(this._recycleRoot)) {
            this._recycleRoot.destroy();
        }
    }


}
