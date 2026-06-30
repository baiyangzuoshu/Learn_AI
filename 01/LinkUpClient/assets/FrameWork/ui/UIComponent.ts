
import { BundleName } from "../../Scripts/Constant";
import { EventManager, EventNode } from "../manager/EventManager";
import { ResManager } from "../manager/ResManager";
import { util } from "../Utils/util";

export class UIComponent extends cc.Component {
    private view: Record<string, cc.Node> = {}
    protected events: EventNode[] = [];
    private static isButtonLocked = false;
    private static lockTime = 0;

    onLoad() {
        this.traverseAllChildren(this.node, "");
    }

    adaptUI() {
        const frameSize = cc.view.getFrameSize();
        const realSize = new cc.Rect(0, 0, 0, 0);
        const curDesign = new cc.Rect(0, 0, util.getDesignSize().width, util.getDesignSize().height);
        const designWidth = curDesign.width;
        const designHeight = curDesign.height;
        realSize.width = designWidth;
        realSize.height = designWidth / (frameSize.width / frameSize.height);
        util.Log("UIMainUICtrl frameSize", frameSize.width, frameSize.height);
        util.Log("UIMainUICtrl realSize", realSize.width, realSize.height);
        util.Log("UIMainUICtrl curDesign", curDesign.width, curDesign.height);
        if (realSize.height <= designHeight) {
            return;
        }
        const area = cc.v2(80, 80);//SDKAdapter.getInstance().HLDDZ_getSafeArea();
        const diffY = realSize.height / 2 - designHeight / 2 - area.y;
        const bottom = this.getChildByUrl("bottom");
        const top = this.getChildByUrl("top");
        if (bottom) {
            bottom.setPosition(0, -diffY);
        }
        if (top) {
            top.setPosition(0, diffY);
        }
    }

    protected onDestroy(): void {
        for (const event of this.events) {
            this.removeUIEventListener(event.name, event.func, event.target);
        }
    }

    private async loadLabel(id: number, parent: cc.Node) {
        const tbLabelJson = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, "Tables/json/tblabel", cc.JsonAsset) as cc.JsonAsset;
        if (!tbLabelJson) {
            console.error("loadLabel id=", id, "tbLabelJson is null")
            return
        }
        const labelJson = tbLabelJson.json[id - 1]
        if (!labelJson) {
            console.error("loadLabel id=", id, "labelJson is null")
            return
        }
        const labelSDFPrefab = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, "Lab/" + labelJson["path"], cc.Prefab) as cc.Prefab;
        if (!labelSDFPrefab) {
            console.error("loadLabel id=", id, "labelSDFPrefab is null")
            return
        }
        const labelSDFNode = cc.instantiate(labelSDFPrefab);
        if (!labelSDFNode) {
            console.error("loadLabel id=", id, "labelSDFNode is null")
            return
        }
        labelSDFNode.parent = parent;
        labelSDFNode.getComponent(cc.Label).string = labelJson["text"];
    }

    private traverseAllChildren(node: cc.Node, url: string): void {
        for (const child of node.children) {
            const name = child.name
            const labels = name.split("_");
            if (labels.length == 2 && labels[0] == "label") {
                console.warn("label name=", name);
                const labelId = parseInt(labels[1])
                this.loadLabel(labelId, child);
            }

            this.view[url + name] = child

            this.traverseAllChildren(child, url + name + "/")
        }
    }

    getChildByUrl(url: string): cc.Node {
        return this.view[url] as cc.Node
    }

    AddDelayButtonListener(url: string, func: (btn: cc.Button) => void, target: unknown): void {
        const node = this.getChildByUrl(url)
        if (!node) {
            console.error("buttonAddClickEvent url=", url)
            return
        }

        const nodeBtn = node.getComponent(cc.Button) as cc.Button
        if (!nodeBtn) {
            console.error("buttonAddClickEvent nodeBtn", url)
            return
        }

        if (!util.isAppPCGame()) {
            node.on("click", (btn: cc.Button) => {
                if (!btn.enabled) return;

                if (UIComponent.isButtonLocked) return;

                btn.enabled = false;
                UIComponent.isButtonLocked = true;

                func.call(target, btn);

                UIComponent.lockTime = 1.0;

                setTimeout(() => {
                    if (btn.node) {
                        btn.enabled = true;
                    }
                }, 500)
            }, target);
            return;
        }

        node.on("click", func, target)

        nodeBtn.transition = cc.Button.Transition.NONE;

        // 使用枚举类型来注册
        node.on(cc.Node.EventType.MOUSE_DOWN, function () {
            node.color = new cc.Color(114, 114, 114, 255);
            //util.Log('Mouse down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_MOVE, function () {
            //util.Log('MOUSE_MOVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_ENTER, function () {
            node.scale = 1.1;
            //util.Log('MOUSE_ENTER down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_LEAVE, function () {
            node.scale = 1;
            node.color = new cc.Color(255, 255, 255, 255);

            //util.Log('MOUSE_LEAVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_UP, function () {
            //util.Log('MOUSE_UP down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_WHEEL, function () {
            //util.Log('MOUSE_WHEEL down');
        }, this);
    }

    AddButtonListener(url: string, func: (btn: cc.Button) => void, target: unknown): void {
        const node = this.getChildByUrl(url)
        if (!node) {
            console.error("buttonAddClickEvent url=", url)
            return
        }

        const nodeBtn = node.getComponent(cc.Button) as cc.Button
        if (!nodeBtn) {
            console.error("buttonAddClickEvent nodeBtn", url)
            return
        }

        node.on("click", func, target)

        if (!util.isAppPCGame()) {
            return;
        }

        nodeBtn.transition = cc.Button.Transition.NONE;

        // 使用枚举类型来注册
        node.on(cc.Node.EventType.MOUSE_DOWN, function () {
            node.color = new cc.Color(114, 114, 114, 255);
            //util.Log('Mouse down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_MOVE, function () {
            //util.Log('MOUSE_MOVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_ENTER, function () {
            node.scale = 1.1;
            //util.Log('MOUSE_ENTER down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_LEAVE, function () {
            node.scale = 1;
            node.color = new cc.Color(255, 255, 255, 255);

            //util.Log('MOUSE_LEAVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_UP, function () {
            //util.Log('MOUSE_UP down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_WHEEL, function () {
            //util.Log('MOUSE_WHEEL down');
        }, this);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    AddMOUSEListener(url: string, func_MOUSE_ENTER: (btn: cc.Node) => void, func_MOUSE_LEAVE: (btn: cc.Node) => void, target: unknown): void {
        const node = this.getChildByUrl(url)
        if (!node) {
            console.error("AddMOUSEListener url=", url)
            return
        }

        const nodeBtn = node.getComponent(cc.Button) as cc.Button
        if (!nodeBtn) {
            console.error("AddMOUSEListener nodeBtn", url)
            return
        }

        nodeBtn.transition = cc.Button.Transition.NONE;

        // 使用枚举类型来注册
        node.on(cc.Node.EventType.MOUSE_DOWN, function () {
            //node.color = new cc.Color(114, 114, 114, 255);
            //util.Log('Mouse down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_MOVE, function () {
            //util.Log('MOUSE_MOVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_ENTER, function () {
            //node.scale = 1.1;
            func_MOUSE_ENTER.bind(target)(target as cc.Node);
            //util.Log('MOUSE_ENTER down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_LEAVE, function () {
            //node.scale = 1;
            //node.color = new cc.Color(255, 255, 255, 255);
            func_MOUSE_LEAVE.bind(target)(target as cc.Node);
            //util.Log('MOUSE_LEAVE down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_UP, function () {
            //util.Log('MOUSE_UP down');
        }, this);
        node.on(cc.Node.EventType.MOUSE_WHEEL, function () {
            //util.Log('MOUSE_WHEEL down');
        }, this);
    }

    addUIEventListener(eventName: string, func: unknown, target: unknown) {
        EventManager.getInstance().on(eventName, func, target);

        const event = new EventNode();
        event.func = func;
        event.name = eventName;
        event.target = target;

        this.events.push(event)
    }

    removeUIEventListener(eventName: string, func: unknown, target: unknown): void {
        EventManager.getInstance().off(eventName, func, target);
    }

    emitUI(eventName: string, data?: unknown): void {
        EventManager.getInstance().emit(eventName, data);
    }

    update(dt: number) {
        UIComponent.lockTime -= dt;
        if (UIComponent.lockTime <= 0) {
            UIComponent.isButtonLocked = false;
        }
        else {
            //console.log("lockTime:", UIComponent.lockTime);
        }
    }
}
