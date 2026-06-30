import { ResManager } from "../../FrameWork/manager/ResManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { ArtPath, BundleName, LinkUpTip, TitleSize, UIControllerName } from "../Constant";
import SDKAdapter from "../SDKAdapter";
import { Pos } from "../types";
export default class GameAction extends UIComponent {
    public openShareAction() {
        if(SDKAdapter.getInstance().isAppHarmonyGame())return;
        
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        const matchBtn = bagNode.getChildByName("matchBtn");
        const refreshBtn = bagNode.getChildByName("refreshBtn");
        const shareBtn = bagNode.getChildByName("share").getChildByName("shareBtn");
        const cleanBtn = bagNode.getChildByName("cleanBtn");
        const shareTip = shareBtn.getChildByName("tip");
        shareTip.active = true;
        shareTip.setScale(1);
        const scale = 0.9;
        cc.tween(shareTip)
            .repeat(3,
                cc.tween()
                    .to(1, { scale: scale })
                    .to(1, { scale: 1 })
            )
            .to(0.5, { scale: 0.1 })
            .call(() => {
                shareTip.active = false;
            })
            .start();
        const time = 0.5;
        cc.tween(matchBtn)
            .to(time, { position: cc.v3(-285, -590, 0) })
            .start()
        cc.tween(refreshBtn)
            .to(time, { position: cc.v3(-100, -590, 0) })
            .start()

        cc.tween(cleanBtn)
            .to(time, { position: cc.v3(85, -590, 0) })
            .start()

        cc.tween(shareBtn)
            .to(time, { position: cc.v3(270, -580, 0) })
            .start()
    }

    public closeShareAction() {
        const bottm = this.node.getChildByName("bottomBtn");
        const bagNode = bottm.getChildByName("bag");
        const matchBtn = bagNode.getChildByName("matchBtn");
        const refreshBtn = bagNode.getChildByName("refreshBtn");
        const shareBtn = bagNode.getChildByName("share").getChildByName("shareBtn");
        const cleanBtn = bagNode.getChildByName("cleanBtn");
        const time = 0.5;
        cc.tween(matchBtn)
            .to(time, { position: cc.v3(-240, -590, 0) })
            .start()
        cc.tween(refreshBtn)
            .to(time, { position: cc.v3(-8, -590, 0) })
            .start()
        cc.tween(cleanBtn)
            .to(time, { position: cc.v3(230, -590, 0) })
            .start()
        cc.tween(shareBtn)
            .to(time, { position: cc.v3(1000, -580, 0) })
            .start()
    }

    public successShareAction(dayMax: number) {
        if (dayMax >= 3) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: "分享次数已达到今日上限!" });
        }
        else {
            const bottm = this.node.getChildByName("bottomBtn");
            const bagNode = bottm.getChildByName("bag");
            const shareTip = bagNode.getChildByName("share").getChildByName("tip");
            shareTip.active = true;
            shareTip.setScale(0.1);
            cc.tween(shareTip)
                .to(0.25, { scale: 1.2 })
                .to(0.25, { scale: 1 })
                .delay(5)
                .call(() => {
                    shareTip.active = false;
                })
                .start();
        }
    }

    async linkupAction(rm: Pos[], clickLinkUp: number, size: { width: number, height: number }) {
        const width = size.width;
        const height = size.height;
        const linkupPrefab = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Direction/linkUp", cc.Prefab) as cc.Prefab;
        for (let i = 0; i < rm.length; i = i + 2) {
            const linkupNode = cc.instantiate(linkupPrefab);
            linkupNode.parent = this.getChildByUrl("tip");
            linkupNode.setPosition(rm[i].y * TitleSize + 30 - width / 2 * TitleSize, -rm[i].x * TitleSize - 30 + height / 2 * TitleSize);
            const count = Math.min(clickLinkUp, LinkUpTip.length - 1);
            linkupNode.getComponent(cc.Label).string = LinkUpTip[count]

            cc.tween(linkupNode)
                .parallel(
                    cc.tween().by(0.8, { position: cc.v3(0, 20) }),
                    cc.tween().to(0.8, { opacity: 0 })
                )
                .call(() => {
                    linkupNode.destroy();
                })
                .start();
        }
    }

    async useBagEffect(data: { type: number }) {
        const names = ["", "Refresh", "Match", "Clean"];
        const effect = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Effect/" + names[data.type], cc.Prefab) as cc.Prefab;
        const linkupNode = cc.instantiate(effect);
        linkupNode.parent = this.getChildByUrl("tip");
        linkupNode.setPosition(0, 200);

        const FX_daojutongyong = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_daojutongyong, cc.Prefab) as cc.Prefab;
        const FX_daojutongyongNode = cc.instantiate(FX_daojutongyong);
        FX_daojutongyongNode.parent = linkupNode.getChildByName("FX_daojutongyong");
        FX_daojutongyongNode.setPosition(0, 0);

        linkupNode.getChildByName("FX_daojutongyong").active = false;

        const FX_tubiaoguang = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tubiaoguang, cc.Prefab) as cc.Prefab;
        const FX_tubiaoguangNode = cc.instantiate(FX_tubiaoguang);
        FX_tubiaoguangNode.parent = linkupNode.getChildByName("FX_tubiaoguang");
        FX_tubiaoguangNode.setPosition(0, 0);
        FX_tubiaoguangNode.getComponent(cc.Animation).play("guangdian");

        if (1 == data.type) {
            cc.tween(linkupNode.getChildByName("icon"))
                .delay(0.5)
                .by(0.25, { angle: -180 })
                .start();
        }

        cc.tween(linkupNode)
            .by(0.5, { position: cc.v3(0, -200) })
            .delay(1)
            .call(() => {
                linkupNode.getChildByName("FX_daojutongyong").active = true;

                linkupNode.getChildByName("FX_tubiaoguang").active = false;
                linkupNode.getChildByName("icon").active = false;
            })
            .delay(2)
            .call(() => {
                linkupNode.destroy();
            })
            .start();
    }
}
