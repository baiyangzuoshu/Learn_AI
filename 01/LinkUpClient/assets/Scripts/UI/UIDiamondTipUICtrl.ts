import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { UIName } from "../Constant";

export default class UIDiamondTipUICtrl extends UIComponent {
    private time = 3;
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        cc.tween(this.getChildByUrl("tip"))
            .by(1.0, { position: cc.v3(0, 120) })
            .start();
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }
    update(dt: number) {
        this.time -= dt;
        if (this.time < 0) {
            UIManager.Instance.DestroyUIView(UIName.UIDiamondTip)
        }
    }
}
