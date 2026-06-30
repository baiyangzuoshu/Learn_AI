import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { DiamondSkipAD, SDKState, SoundID, UIName } from "../Constant";
import DataManager from "../Manager/DataManager";
import GameManager from "../Manager/GameManager";
import PlayerManager from "../Manager/PlayerManager";
import SDKAdapter from "../SDKAdapter";

export default class UIDiamondBuyUICtrl extends UIComponent {
    private diamond = 0;
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg3/useBtn", this.onuse3BtnClick, this);
        this.AddButtonListener("bg3/skipBtn", this.onskip3BtnClick, this);
        this.AddButtonListener("bg3/closeBtn", this.onskip3BtnClick, this);

        this.diamond = DiamondSkipAD;
        this.getChildByUrl("bg3/tip2/num").getComponent(cc.Label).string = "" + (this.diamond - PlayerManager.getInstance().HLDDZ_user.diamondCount)
        this.getChildByUrl("bg3/tip2").active = true;
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }
    onskip3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIDiamondBuy);
    }

    onuse3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        GameManager.getInstance().sdkState = SDKState.Pay;
        GameManager.getInstance().diamondCount = PlayerManager.getInstance().HLDDZ_user.diamondCount;
        SDKAdapter.getInstance().HLDDZ_buyDiamond((data: number) => {
            GameManager.getInstance().sdkState = SDKState.None;
            if (1 == data) {
                DataManager.getInstance().startQuery(this.diamond);
            }
        });
        UIManager.Instance.DestroyUIView(UIName.UIDiamondBuy);
    }
}
