import LoadRemoteManager from "../../FrameWork/manager/LoadRemoteManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { SoundID, UIName } from "../Constant";
import SDKAdapter from "../SDKAdapter";

export default class UIFirstUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("closeBtn", this.onCloseBtnClick, this);
    }

    initData(data: {
        ranks: {
            avatar: string,
            name: string,
            stage_time: number
        }[], id: number
    }) {
        this.getChildByUrl("gkInfo").getComponent(cc.Label).string = "第" + data.id + "关";
        for (let i = 1; i < 4; i++) {
            const info = this.getChildByUrl(i + "/info");
            info.active = false;
            const empty = this.getChildByUrl(i + "/empty");
            empty.active = true;
        }

        let index = 0;
        data.ranks.sort((a, b) => a["stage_time"] - b["stage_time"]);

        for (const item of data.ranks) {
            console.log(item["avatar"]);
            console.log(item["name"]);
            console.log(item["stage_time"]);
            index++;
            if (index > 3) continue;

            const info = this.getChildByUrl(index + "/info");
            info.active = true;
            const empty = this.getChildByUrl(index + "/empty");
            empty.active = false;
            const name = info.getChildByName("name");
            name.getComponent(cc.Label).string = util.abbreviateByDisplayWidth(item["name"]);
            const time = info.getChildByName("time");
            time.getComponent(cc.Label).string = util.formatTime(item["stage_time"]);

            // 加载头像图片（如果不是 Web 游戏）
            if (!SDKAdapter.getInstance().isWebDev()) {
                const tex = LoadRemoteManager.getInstance().loadImage(util.processUrl(item["avatar"]));
                if (tex) {
                    const img = info.getChildByName("frame").getChildByName("6").getComponent(cc.Sprite);
                    const spriteFrame = new cc.SpriteFrame(tex);
                    img.spriteFrame = spriteFrame;
                    img.node.width = 144;
                    img.node.height = 144;
                }
            }
        }
    }

    protected adaptPC() {
        this.node.scale = 1.0
    }

    onCloseBtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        UIManager.Instance.DestroyUIView(UIName.UIFirst);
    }


}
