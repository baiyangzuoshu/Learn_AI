
import { BundleName } from '../../Scripts/Constant';
import { util } from '../Utils/util';
import { ResManager } from './ResManager';

export class UIManager extends cc.Component {

    private uiMap: Map<string, cc.Node> = new Map<string, cc.Node>;
    private uiZIndex = 10;
    public static Instance: UIManager
    public uiRoot!: cc.Node;

    protected onLoad(): void {
        UIManager.Instance = this;
    }

    public clear() {
        this.uiMap = new Map<string, cc.Node>;
    }

    public Init(root: cc.Node): void {
        this.uiRoot = root;
        this.clear();
    }

    public ShowUIPrefab(uiPrefab: cc.Prefab, parent: cc.Node | undefined): cc.Node | undefined {
        if (this.uiMap.has(uiPrefab.data.name)) {
            console.error(uiPrefab.data.name, "界面已存在，请勿重复创建!");
            const view = this.uiMap.get(uiPrefab.data.name) as cc.Node;
            view.zIndex = this.uiZIndex++;
            return undefined;
        }

        const uiView: cc.Node = cc.instantiate(uiPrefab) as cc.Node;
        parent = (!parent) ? this.uiRoot : parent;
        parent.addChild(uiView);

        this.uiMap.set(uiPrefab.data.name, uiView);
        this.uiZIndex++;

        return uiView as cc.Node;
    }

    public isUiMapHas(name: string): cc.Node | undefined {
        if (this.uiMap.has(name)) {
            const view = this.uiMap.get(name) as cc.Node;
            return view;
        }
        return undefined;
    }

    public async IE_ShowUIView(viewName: string): Promise<cc.Node | undefined> {
        viewName = "GUI/" + viewName;
        // 实例化UI视图出来; 
        const bundleName = BundleName.BundleMain;
        let parent: cc.Node | undefined;

        const uiPrefab = await ResManager.Instance.IE_GetAsset(bundleName, viewName, cc.Prefab);
        if (!uiPrefab) {
            console.error("cannot find ui Prefab: ", viewName);
            return undefined;
        }
        return this.ShowUIPrefab(uiPrefab as cc.Prefab, parent);
    }

    public DestroyUIView(viewName: string): void {
        if (!this.uiMap.has(viewName)) {
            util.Log('UIManager:DestroyUIView: cannot find view: ', viewName);
            return;
        }

        const view = this.uiMap.get(viewName) as cc.Node;
        view.destroy();

        this.uiMap.delete(viewName);
    }

    public GetUIView(viewName: string): cc.Node | undefined {
        return this.uiMap.get(viewName);
    }

    public removeAllUI() {
        this.uiMap.forEach(uiNode => {
            uiNode.destroy();
        })

        this.uiMap.clear();
    }
}

