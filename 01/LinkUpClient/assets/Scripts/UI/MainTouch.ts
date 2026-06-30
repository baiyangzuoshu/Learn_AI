import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";

export default class MainTouch extends UIComponent {


    // onLoad () {}

    start() {
        this.node.getChildByName("event").on(cc.Node.EventType.TOUCH_START, this.onTOUCH_STARTClick, this, true);
        this.node.getChildByName("event").on(cc.Node.EventType.TOUCH_END, this.onTOUCH_ENDClick, this);
    }

    onTOUCH_STARTClick(e: cc.Event) {
        util.Log("onTOUCH_STARTClick", e);

        return true;
    }

    onTOUCH_ENDClick(e: cc.Event) {
        util.Log("onTOUCH_ENDClick", e);
    }

    // update (dt) {}
}
