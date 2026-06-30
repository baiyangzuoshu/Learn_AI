import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { UIName } from "../Constant";

export default class UIShareRewardUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();

        this.AddButtonListener("bg/closeBtn", this.onCloseClick, this);
    }

    initData(names: string[], add: number) {
        if (add == 1) {
            const name1 = this.getChildByUrl("bg/name1");
            name1.active = true;
            const name = this.getChildByUrl("bg/name1/1/name");
            name.getComponent(cc.Label).string = util.abbreviateByDisplayWidth(names[names.length - 1]);
        }
        else if (2 == add) {
            const name2 = this.getChildByUrl("bg/name2");
            name2.active = true;
            const name = this.getChildByUrl("bg/name2/1/name");
            name.getComponent(cc.Label).string = util.abbreviateByDisplayWidth(names[names.length - 2]);
            const name22 = this.getChildByUrl("bg/name2/2/name");
            name22.getComponent(cc.Label).string = util.abbreviateByDisplayWidth(names[names.length - 1]);
        }
        else if (add > 2) {
            const name3 = this.getChildByUrl("bg/name3");
            name3.active = true;
            const name = this.getChildByUrl("bg/name3/name");
            const n1 = util.abbreviateByDisplayWidth(names[0]);
            const n2 = util.abbreviateByDisplayWidth(names[1]);
            const n3 = util.abbreviateByDisplayWidth(names[2]);
            name.getComponent(cc.Label).string = n1 + "、" + n2 + "、" + n3;
        }

        this.getChildByUrl("bg/2/tip").getComponent(cc.Label).string = "获得 " + add + " 个提示";
    }

    onCloseClick() {
        UIManager.Instance.DestroyUIView(UIName.UIShareReward);
    }
}
