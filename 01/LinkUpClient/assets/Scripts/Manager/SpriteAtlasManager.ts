
import { ResManager } from "../../FrameWork/manager/ResManager";
import { BundleName } from "../Constant";

export default class SpriteAtlasManager extends cc.Component {
    private static Instance: SpriteAtlasManager
    public blockSpriteAtlas!: cc.SpriteAtlas;

    onLoad() {
        SpriteAtlasManager.Instance = this;
    }

    public static getInstance() {
        return SpriteAtlasManager.Instance;
    }

    public async loadBlockSpriteAtlas() {
        this.blockSpriteAtlas = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Block/lianliankan", cc.SpriteAtlas) as cc.SpriteAtlas;
    }
}
