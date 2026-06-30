import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";
import PlayerManager from "../Manager/PlayerManager";

export default class UIRewardInfoCtrl extends UIComponent {
    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg/closeBtn", this.onBtnClick, this);
        this.AddButtonListener("bg/closeBtn2", this.onBtnClick, this);

        this.initData(PlayerManager.getInstance().item);
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }

    initData(index: number) {
        this.getChildByUrl("bg/" + 1).active = false;
        this.getChildByUrl("bg/" + 2).active = false;
        this.getChildByUrl("bg/" + 3).active = false;

        this.getChildByUrl("bg/" + index).active = true;
    }

    onBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);

        UIManager.Instance.DestroyUIView(UIName.UIRewardInfo);
    }


    // update (dt) {}
}
