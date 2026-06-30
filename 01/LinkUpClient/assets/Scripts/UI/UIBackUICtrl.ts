import { EventManager } from "../../FrameWork/manager/EventManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";
import DataManager from "../Manager/DataManager";
import SDKAdapter from "../SDKAdapter";

export default class UIBackUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg3/useBtn", this.onuse3BtnClick, this);
        this.AddButtonListener("bg3/closeBtn", this.onskip3BtnClick, this);
        this.AddButtonListener("bg3/cancleBtn", this.onskip3BtnClick, this);
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }
    onskip3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIBack);
    }

    onuse3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        EventManager.getInstance().clear();

        SoundManager.Instance.StopMainMusic();
        SDKAdapter.getInstance().HLDDZ_offChallengeStart(DataManager.getInstance().rankonChallengeStart);
        SDKAdapter.getInstance().HLDDZ_backTo();
    }
}
