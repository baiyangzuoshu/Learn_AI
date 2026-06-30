import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";

export default class UICommonUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg/useBtn", this.onuse3BtnClick, this);
        this.AddButtonListener("bg/skipBtn", this.onskip3BtnClick, this);
    }

    initData(data: { type: number, texts: string[] }) {
        util.Log(data.type);
        if (data.type == 1) {
            this.node.getChildByName("bg").getChildByName("tip1").getComponent(cc.Label).string = data.texts[0];
            this.node.getChildByName("bg").getChildByName("tip2").getComponent(cc.Label).string = data.texts[1];
        }
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    onskip3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UICommon);
    }

    onuse3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UICommon);
    }
}
