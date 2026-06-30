import { ResManager } from '../../FrameWork/manager/ResManager';
import { UIComponent } from '../../FrameWork/ui/UIComponent';
import { util } from '../../FrameWork/Utils/util';
import { ArtPath, BlockIDs, BundleName, SoundID, SpecialBlockTip, UIControllerName } from '../Constant';
import GameManager from '../Manager/GameManager';
import SpriteAtlasManager from '../Manager/SpriteAtlasManager';
import { Block } from '../types';

export class GameBlock extends UIComponent {
    private k1Node = new cc.Node;
    private k2Node = new cc.Node;
    private k3Node = new cc.Node;
    private guangNode = new cc.Node;
    private specialNode = new cc.Node;
    private itemNode = new cc.Node;
    private baseData: Block = new Block();
    public canConnect = true;
    public isVisible = true;
    private isShake = false;
    private sleepTime = 0;

    onLoad() {
        super.onLoad();

        this.k1Node = this.node.getChildByName("k1");
        this.k2Node = this.node.getChildByName("k2");
        this.k3Node = this.node.getChildByName("k3");
        this.guangNode = this.node.getChildByName("guang");
        this.specialNode = this.node.getChildByName("special");
        this.itemNode = this.node.getChildByName("item");
        this.k2Node.active = true;
        this.k2Node.scale = 0.0001;
    }

    public setSleepTime(time: number) {
        if (time > this.sleepTime) {
            this.sleepTime = time;
        }
    }

    public async shake() {
        if (this.isShake || this.sleepTime > 0) return;

        this.isShake = true;
        cc.tween(this.node)
            .to(0.05, { angle: 20 })
            .to(0.05, { angle: -20 })
            .to(0.05, { angle: 15 })
            .to(0.05, { angle: 0 })
            .call(() => {
                this.isShake = false;
            })
            .start()
    }

    public shakeSpecial() {
        if (this.isShake || this.sleepTime > 0) return;
        this.isShake = true;

        if (this.baseData.type == BlockIDs.Green) {
            const FX_hudieNode = this.specialNode.getChildByName("FX_hudie");
            const FX_hudiedianjiNode = this.specialNode.getChildByName("FX_hudiedianji");
            FX_hudiedianjiNode.active = true;
            FX_hudieNode.active = false;
            FX_hudiedianjiNode.getComponent(cc.Animation).play("hudiedianji");
            FX_hudiedianjiNode.getComponent(cc.Animation).on("finished", () => {
                FX_hudiedianjiNode.active = false;
                FX_hudieNode.active = true;

                this.isShake = false;
            }, this);
        }
        else {
            this.isShake = false;
        }

        if (SpecialBlockTip[this.baseData.type]) {
            this.emitUI(UIControllerName.UIController_uiCommonTip, { text: SpecialBlockTip[this.baseData.type] });
        }

    }

    public setSelect(isSelect: boolean) {
        //this.k2Node.active = isSelect;
        this.k2Node.scale = isSelect ? 1 : 0.0001;
        if (isSelect) {
            //卡牌点击缩放
            cc.tween(this.itemNode)
                .to(0.1, { scale: 1.2 })
                .to(0.1, { scale: 1 })
                .start();
            cc.tween(this.specialNode)
                .to(0.1, { scale: 1.2 })
                .to(0.1, { scale: 1 })
                .start();
        }
    }

    public setClean(isClean: boolean) {
        this.k3Node.active = isClean;
        if (isClean) {
            cc.tween(this.itemNode).repeatForever(cc.tween().to(1, { scale: 1.2 }).to(1, { scale: 1 })).start();

            this.node.getComponent(cc.Animation).play("kuai");
        }
        else {
            cc.Tween.stopAllByTarget(this.node);
            cc.Tween.stopAllByTarget(this.itemNode);
            this.itemNode.scale = 1;
        }
    }

    private setNo() {
        this.k1Node.active = false;
        //this.k2Node.active = false;
        this.k2Node.scale = 1;
        this.itemNode.active = false;
        this.specialNode.active = false;
        this.isVisible = false;

        this.canConnect = false;
    }

    public async connect(_parent: cc.Node) {
        this.setNo();

        const FX_dianji = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_baozha, cc.Prefab) as cc.Prefab;
        const fx = cc.instantiate(FX_dianji);
        fx.active = true;
        fx.parent = _parent;
        fx.setPosition(this.node.position);

        this.itemNode.active = true;
        cc.tween(this.itemNode)
            .to(0.3, { scale: 0.1 })
            .call(() => {
                this.itemNode.active = false;
                this.node.active = false;
            })
            .start();
    }

    public async doGreenAction(_parent: cc.Node) {
        GameManager.getInstance().playSoundBlock(SoundID.hudie);
        this.specialNode.removeAllChildren();
        const type = util.clamp(Math.ceil(Math.random() * 4), 1, 4);

        const worldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
        const nodePos = _parent.convertToNodeSpaceAR(worldPos);
        const FX_hudiefei1 = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_hudiefei1, cc.Prefab) as cc.Prefab;
        const FX_hudiefei1Node = cc.instantiate(FX_hudiefei1);
        FX_hudiefei1Node.parent = _parent;
        FX_hudiefei1Node.setPosition(nodePos);
        FX_hudiefei1Node.getComponent(cc.Animation).play("hudiefei" + type);
        FX_hudiefei1Node.getComponent(cc.Animation).on("finished", () => {
            FX_hudiefei1Node.active = false;
            FX_hudiefei1Node.destroy();
        })

        this.itemNode.opacity = 255;
        this.canConnect = true;
        this.baseData.type = 0;
    }

    public async doGrassAction() {
        GameManager.getInstance().playSoundBlock(SoundID.tenman);
        this.specialNode.active = false;
        this.canConnect = true;
        this.baseData.type = 0;

        const FX_tengman = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tengman, cc.Prefab) as cc.Prefab;
        const fx = cc.instantiate(FX_tengman);
        fx.active = true;
        fx.parent = this.node;
        fx.setPosition(cc.v2(0, 0));
        fx.getComponent(cc.Animation).play("tengman");
        fx.getComponent(cc.Animation).on("finished", () => {
            fx.active = false;
            fx.destroy();
        })
    }

    public doStoneAction() {
        this.node.active = false;
        this.isVisible = false;
        this.baseData.type = 0;
    }

    public doWoodenAction() {
        this.node.active = false;
        this.isVisible = false;
        this.baseData.type = 0;
    }

    public doMagnetAction() {
        this.node.active = false;
        this.isVisible = false;
        this.baseData.type = 0;
    }

    public doIceAction(_parent: cc.Node) {
        if (!this.specialNode.active) {
            return false;
        }

        switch (this.baseData.id) {
            case BlockIDs.Ice: {
                GameManager.getInstance().playSoundBlock(SoundID.ice);
                this.playIceNormalAction(_parent);
                this.baseData.id = BlockIDs.Ice2;
                this.specialNode.getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(this.baseData.id + "");
                break;
            }
            case BlockIDs.Ice2: {
                GameManager.getInstance().playSoundBlock(SoundID.ice);
                this.playIceNormalAction(_parent);
                this.baseData.id = BlockIDs.Ice3;
                this.specialNode.getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(this.baseData.id + "");
                break;
            }
            case BlockIDs.Ice3: {
                GameManager.getInstance().playSoundBlock(SoundID.ice);
                this.playIceAction(_parent);
                return true;
            }
            default:
                break;
        }

        return false;
    }

    public clearIceAction() {
        this.setNo();
        this.k2Node.active = false;
    }

    private async playIceNormalAction(_parent: cc.Node) {
        const FX_bingkuai = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_bingkuai, cc.Prefab) as cc.Prefab;
        const fx = cc.instantiate(FX_bingkuai);
        fx.active = true;
        fx.parent = _parent;
        fx.setPosition(this.node.position);
        fx.getComponent(cc.Animation).play("bingkuai");
        fx.getComponent(cc.Animation).on("finished", () => {
            fx.active = false;
            fx.destroy();
        })
    }

    private async playIceAction(_parent: cc.Node) {
        this.setNo();
        const FX_bingkuai = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_bingkuai, cc.Prefab) as cc.Prefab;
        const fx = cc.instantiate(FX_bingkuai);
        fx.active = true;
        fx.parent = _parent;
        fx.setPosition(this.node.position);
        fx.getComponent(cc.Animation).play("bingkuai");
        fx.getComponent(cc.Animation).on("finished", () => {
            fx.active = false;
            this.node.active = false;
            fx.destroy();
        })
    }

    public async playCleanAction() {
        this.setNo();
        this.k2Node.active = false;
        this.node.active = true;
        const FX_baozha = await ResManager.getInstance().IE_GetAsset(BundleName.BundleMain, ArtPath.FX_baozha, cc.Prefab) as cc.Prefab;
        const fx = cc.instantiate(FX_baozha);
        fx.active = true;
        fx.parent = this.node;
        fx.setPosition(cc.v2(0, 0));
        this.scheduleOnce(() => {
            fx.active = false;
            this.itemNode.active = false;
            this.node.active = false;
            fx.destroy();
        }, 1.1);

        cc.tween(this.itemNode)
            .to(1, { scale: 0.1 })
            .start();
    }

    public setData(data: Block) {
        this.baseData.x = data.x;
        this.baseData.y = data.y;
        this.baseData.id = data.id;
        this.baseData.type = data.type;
        this.guangNode.active = false;
        if (data.type == BlockIDs.Placeholder) {
            this.node.active = false;
            this.canConnect = false;
            this.isVisible = false;
        }
        else if (data.type == BlockIDs.Random1 || data.type == BlockIDs.Random2 || data.type == BlockIDs.Random3 || data.type == BlockIDs.Random4) {
            this.canConnect = true;
        }
        else if (data.type > BlockIDs.None) {
            this.loadItem(data);
        }

        this.setBlockPosition(data.x, data.y);
    }

    private async loadItem(data: Block) {
        this.specialNode.getComponent(cc.Sprite).spriteFrame = SpriteAtlasManager.getInstance().blockSpriteAtlas.getSpriteFrame(data.type + "");

        this.specialNode.active = true;
        this.guangNode.active = data.type == BlockIDs.Rocket;
        this.canConnect = data.type == BlockIDs.Rocket;
        if (data.type == BlockIDs.Rocket) {
            this.itemNode.opacity = 0;
            this.specialNode.getComponent(cc.Sprite).enabled = false;
            const FX_tbzhadan = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_tbzhadan, cc.Prefab) as cc.Prefab;
            const FX_tbzhadanNode = cc.instantiate(FX_tbzhadan);
            FX_tbzhadanNode.parent = this.specialNode;
            FX_tbzhadanNode.setPosition(cc.v2(5, 0));
            FX_tbzhadanNode.getComponent(cc.Animation).play("tubiaozhadan");
        }
        else if (data.type == BlockIDs.Green) {
            this.itemNode.opacity = 0;
            this.specialNode.getComponent(cc.Sprite).enabled = false;
            const FX_hudie = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_hudie, cc.Prefab) as cc.Prefab;
            const FX_hudieNode = cc.instantiate(FX_hudie);
            FX_hudieNode.parent = this.specialNode;
            FX_hudieNode.setPosition(cc.v2(10, 0));
            FX_hudieNode.getComponent(cc.Animation).play("hudie");
            FX_hudieNode.setScale(0.95);

            const FX_hudiedianji = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_hudiedianji, cc.Prefab) as cc.Prefab;
            const FX_hudiedianjiNode = cc.instantiate(FX_hudiedianji);
            FX_hudiedianjiNode.parent = this.specialNode;
            FX_hudiedianjiNode.setPosition(cc.v2(10, 0));
            FX_hudiedianjiNode.setScale(0.95);
            FX_hudiedianjiNode.active = false;
            FX_hudiedianjiNode.getComponent(cc.Animation).play("hudiedianji");
        }
        else if (data.type == BlockIDs.Grass) {
            //this.specialNode.active = false;
        }
        else if (data.type == BlockIDs.Magnet) {
            this.itemNode.opacity = 0;
            this.specialNode.getComponent(cc.Sprite).enabled = false;
            const FX_xuanwo = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, ArtPath.FX_xuanwo, cc.Prefab) as cc.Prefab;
            const FX_xuanwoNode = cc.instantiate(FX_xuanwo);
            FX_xuanwoNode.parent = this.specialNode;
            FX_xuanwoNode.setPosition(cc.v2(0, 0));
            FX_xuanwoNode.getComponent(cc.Animation).play("xuanwo");
            FX_xuanwoNode.setScale(0.95);
        }
        else if (data.type == BlockIDs.Stone) {
            this.itemNode.opacity = 0;
        }
        else if (data.type == BlockIDs.Wooden) {
            this.itemNode.opacity = 0;
        }
    }

    public setBlockPosition(x: number, y: number) {
        this.baseData.x = x;
        this.baseData.y = y;
    }

    public getBaseData() {
        return this.baseData;
    }

    public isSleep() {
        return this.sleepTime > 0;
    }

    public canBlockConnect() {
        return this.canConnect;
    }

    public setVisible(visible: boolean) {
        if (!this.isVisible) return;

        this.node.active = visible;
    }

    update(dt: number): void {
        if (this.sleepTime > 0) {
            this.sleepTime -= dt;
        }
    }
}


