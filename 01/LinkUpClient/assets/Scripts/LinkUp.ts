import { UIComponent } from "../FrameWork/ui/UIComponent";
import { util } from "../FrameWork/Utils/util";
import { BundleName } from "./Constant";
import UIRootUICtrl from "./UI/UIRootUICtrl";

async function IE_LoadBundle(bundleName: string) {
    return new Promise((resolve, reject) => {
        cc.assetManager.loadBundle(bundleName, (err, bundleData) => {
            if (err) {
                console.error(err);
                reject(null);
                return;
            }
            else {
                resolve(bundleData);
                return;
            }
        })
    });
}

async function IE_LoadAssetInBundle(bundle: cc.AssetManager.Bundle, assetName: string) {
    return new Promise((resolve, reject) => {
        bundle.load(assetName, (err, assetData) => {
            if (err) {
                reject(err);
                return;
            }
            else {
                resolve(assetData);
            }
        });
    });
}
const { ccclass, property } = cc._decorator;
@ccclass
export default class Main extends UIComponent {

    async startPlay() {
        cc.view.setResizeCallback(() => {
            util.setDesignResolution(true);
        });

        util.setDesignResolution(true);

        const canvasNode = cc.find("Canvas");
        const uiCanvas = canvasNode.getComponent(cc.Canvas);
        const bundle = await IE_LoadBundle(BundleName.BundleMain) as cc.AssetManager.Bundle;
        const uiPrefab = await IE_LoadAssetInBundle(bundle, "GUI/UIRoot") as cc.Prefab;
        const $uiRoot: cc.Node = cc.instantiate(uiPrefab) as cc.Node;
        if (!$uiRoot) return;

        uiCanvas.node.addChild($uiRoot);

        $uiRoot.addComponent(UIRootUICtrl);
    }

    onLoad() {
        this.startPlay();

        cc.game.on(cc.game.EVENT_HIDE, this.onHide, this);
        cc.game.on(cc.game.EVENT_SHOW, this.onShow, this);
    }

    onHide() {
        // 暂停游戏逻辑
        cc.director.pause();
    }

    onShow() {
        // 恢复游戏逻辑
        cc.director.resume();
    }

    onDestroy() {
        cc.game.off(cc.game.EVENT_HIDE, this.onHide, this);
        cc.game.off(cc.game.EVENT_SHOW, this.onShow, this);
    }


}
