
export default class LoadRemoteManager {
    private images = new Map<string, cc.Texture2D>();
    private mapJsons = new Map<string, cc.JsonAsset>();

    private static _instance: LoadRemoteManager

    private constructor() {
        //
    }

    public static getInstance(): LoadRemoteManager {
        if (!LoadRemoteManager._instance) {
            LoadRemoteManager._instance = new LoadRemoteManager();
        }
        return LoadRemoteManager._instance;
    }

    public clear() {
        for (const k of this.images) {
            cc.assetManager.releaseAsset(k[1]);
        }
        for (const k of this.mapJsons) {
            cc.assetManager.releaseAsset(k[1]);
        }

        this.images.clear();
        this.mapJsons.clear();
    }

    protected onDestroy(): void {
        this.clear();
    }

    loadJson(id: string) {
        return new Promise((resolve, reject) => {
            const text = this.mapJsons.get(id);
            if (text) {
                resolve(text);
                return;
            }

            cc.assetManager.loadRemote("https://mow2.yolinet.cn/mapData/" + id + ".json", (err, text: cc.JsonAsset) => {
                if (err) {
                    reject(err);
                    return;
                }
                else {
                    resolve(text);
                    this.mapJsons.set(id, text)
                }
            });
        })
    }

    public loadImage(url: string): cc.Texture2D | undefined {
        const img = this.images.get(url);
        if (img) {
            return img;
        }

        cc.assetManager.loadRemote(url, { ext: '.png' }, (err, texture: cc.Texture2D) => {
            if (!err) {
                this.images.set(url, texture)
            }
        });

        return undefined;
    }
}

