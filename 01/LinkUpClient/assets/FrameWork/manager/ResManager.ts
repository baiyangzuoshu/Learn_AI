import { util } from "../Utils/util";

export class ResManager extends cc.Component {
    public static Instance: ResManager
    public static getInstance(): ResManager {
        return ResManager.Instance
    }

    onLoad() {
        ResManager.Instance = this
    }

    private async IE_LoadBundle(bundleName: string) {
        return new Promise((resolve, reject) => {
            cc.assetManager.loadBundle(bundleName, (err, bundleData) => {
                if (err) {
                    console.error(err);
                    reject(null);
                    return;
                }
                else {
                    resolve(bundleData);
                    return;
                }
            })
        });
    }

    private async IE_LoadAllAssetsInBundle(bundle: cc.AssetManager.Bundle, assetType: typeof cc.Asset) {
        return new Promise((resolve, reject) => {
            bundle.loadDir("", assetType, (err, infos) => {
                if (err) {
                    reject(err);
                    return;
                }
                else {
                    resolve(infos);
                }
            });
        });
    }

    private async IE_LoadAssetInBundle(bundle: cc.AssetManager.Bundle, assetName: string, assetType: typeof cc.Asset) {
        return new Promise((resolve, reject) => {
            bundle.load(assetName, assetType, (err, assetData) => {
                if (err) {
                    reject(err);
                    return;
                }
                else {
                    resolve(assetData);
                }
            });
        });
    }

    private async IE_LoadSceneInBundle(bundle: cc.AssetManager.Bundle, sceneName: string) {
        return new Promise((resolve, reject) => {
            bundle.loadScene(sceneName, (err, sceneData) => {
                if (err) {
                    reject(err);
                    return;
                }
                else {
                    resolve(sceneData);
                    return;
                }
            });
        });
    }

    public async IE_LoadBundleAndAllAssets(bundleName: string, assetType: typeof cc.Asset) {
        const bundle: cc.AssetManager.Bundle = await this.IE_LoadBundle(bundleName) as cc.AssetManager.Bundle;
        if (bundle === null) {
            return null;
        }

        await this.IE_LoadAllAssetsInBundle(bundle, assetType);
    }

    public async IE_GetScene(bundleName: string, scenePath: string) {
        let bundle: cc.AssetManager.Bundle = cc.assetManager.getBundle(bundleName);

        if (bundle === null) {
            bundle = await this.IE_LoadBundle(bundleName) as cc.AssetManager.Bundle;
            if (bundle === null) {
                // util.Log("bundle load err: " + bundleName);
                return;
            }
        }

        const sceneData = await this.IE_LoadSceneInBundle(bundle, scenePath) as unknown;
        return sceneData;
    }

    public async IE_GetAsset(bundleName: string, assetPath: string, assetType: typeof cc.Asset) {
        let bundle: cc.AssetManager.Bundle = cc.assetManager.getBundle(bundleName);
        if (bundle == null) {
            bundle = await this.IE_LoadBundle(bundleName) as cc.AssetManager.Bundle;
            if (bundle == null) {
                console.error("bundle load err: " + bundleName);
                return;
            }
        }
        let assetData = bundle.get(assetPath, assetType);
        if (assetData) {
            return assetData; // 修改了没有返回资源的bug
        }

        assetData = await this.IE_LoadAssetInBundle(bundle, assetPath, assetType) as cc.Asset;
        return assetData;
    }

    public ReleaseAsset(assetData: cc.Asset): void {
        cc.assetManager.releaseAsset(assetData);
    }

    public ReleaseAllAssetInBundle(bundleName: string): void {
        const bundle: cc.AssetManager.Bundle = cc.assetManager.getBundle(bundleName);
        if (bundle === null) {
            return;
        }

        bundle.releaseAll();

        cc.assetManager.removeBundle(bundle);
    }

    public printAssetRefCount(bundleName: string, assetPath: string) {
        const bundle: cc.AssetManager.Bundle = cc.assetManager.getBundle(bundleName);
        if (bundle === null) {
            return;
        }

        const assetData = bundle.get(assetPath);
        if (assetData === null) {
            return;
        }

        util.Log("asset ref count: ", assetData.refCount);
    }
}

