import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { UIName } from "../Constant";

export default class UICommonTipUICtrl extends UIComponent {
    private time = 5;
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        super.onLoad();
        this.adaptUI();
        this.getChildByUrl("bg").scale = 0.1;
        cc.tween(this.getChildByUrl("bg"))
            .to(0.2, { scale: 1.2 })
            .to(0.1, { scale: 1.0 })
            .delay(1.8)
            .to(0.2, { scale: 0.1 })
            .call(() => {
                UIManager.Instance.DestroyUIView(UIName.UICommonTip);
                this.node.destroy();
            })
            .start();
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }
    initText(txt: string) {
        this.getChildByUrl("bg/text").getComponent(cc.Label).string = txt;
    }

    update(dt: number) {
        this.time -= dt;
        if (this.time < 0) {
            UIManager.Instance.DestroyUIView(UIName.UICommonTip);
            this.node.destroy();
        }
    }
}