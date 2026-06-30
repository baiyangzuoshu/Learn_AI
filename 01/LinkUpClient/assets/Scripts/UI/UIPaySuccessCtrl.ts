import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";

export default class UIPaySuccessCtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg3/confirmBtn", this.onskip3BtnClick, this);
        this.AddButtonListener("bg3/closeBtn", this.onskip3BtnClick, this);

    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    init(type: number) {
        this.getChildByUrl("bg3/tip" + type).active = true;
        const payDiamond = PlayerManager.getInstance().HLDDZ_user.diamondCount - GameManager.getInstance().diamondCount;
        this.getChildByUrl("bg3/tip2/4/num").getComponent(cc.Label).string = (payDiamond) + "";
    }

    onskip3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIPayTip);
        UIManager.Instance.DestroyUIView(UIName.UIPaySuccess);
    }
}
