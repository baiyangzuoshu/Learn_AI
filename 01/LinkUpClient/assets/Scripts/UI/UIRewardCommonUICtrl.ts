import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";

export default class UIRewardCommonUICtrl extends UIComponent {
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
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    initData(data: { type: number, arr: { id: number, num: number }[] }) {
        this.getChildByUrl("bg/bg1").active = false;
        this.getChildByUrl("bg/" + 1).active = false;
        this.getChildByUrl("bg/" + 2).active = false;
        this.getChildByUrl("bg/" + 3).active = false;

        this.getChildByUrl("bg/warn").active = false;
        this.getChildByUrl("bg/itemtip").active = true;
        this.getChildByUrl("bg/item").active = true;
        this.getChildByUrl("bg/title").getComponent(cc.Label).string = data.type == 1 ? "擂台赛奖励" : "奖励";

        const exit = [];
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < data.arr.length; i++) {
            this.getChildByUrl("bg/item/" + data.arr[i].id).active = true;
            this.getChildByUrl("bg/item/" + data.arr[i].id).getChildByName("num").getComponent(cc.Label).string = data.arr[i].num + '';

            exit.push(data.arr[i].id);
        }

        for (let i = 1; i < 4; i++) {
            if (exit.includes(i)) continue;

            this.getChildByUrl("bg/item/" + i).destroy();
        }

        const len = [0, 160, 350, 500]

        this.getChildByUrl("bg/item").setContentSize(cc.size(len[exit.length], 200));
        this.getChildByUrl("bg/item").getComponent(cc.Layout).updateLayout();
    }

    onBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);

        UIManager.Instance.DestroyUIView(UIName.UIRewardInfo);
    }


    // update (dt) {}
}
