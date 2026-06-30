import { EventManager } from "../../FrameWork/manager/EventManager";
import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { DiamondSkipAD, ModelName, UIControllerName } from "../Constant";
import { IDataModel } from "../DataModel/IDataModel";
import ScoreData from "../DataModel/ScoreData";
import SDKAdapter from "../SDKAdapter";
import GameManager from "./GameManager";
import PlayerManager from "./PlayerManager";

export default class DataManager extends UIComponent {
    private static Instance: DataManager
    private queryTime = 0;
    private queryCount = 0;
    private queryInvertal = [0.3, 3, 5, 9];
    private queryDiamond = 0;
    onLoad() {
        DataManager.Instance = this;

        this.init();
    }

    public static getInstance() {
        return DataManager.Instance;
    }

    handleQuery(dt: number) {
        if (this.queryCount > 0) {
            this.queryTime -= dt;
            if (this.queryTime <= 0) {
                this.queryTime = this.queryInvertal[4 - this.queryCount];
                this.queryCount--;
                util.Log("this.queryTime=", this.queryTime);
                this.queryOrder();
            }
        }
    }

    queryOrder() {
        SDKAdapter.getInstance().HLDDZ_getPlayerProfile((data: number) => {
            util.Log("queryOrder", data, PlayerManager.getInstance().HLDDZ_user.diamondCount)
            if (PlayerManager.getInstance().HLDDZ_user.diamondCount >= this.queryDiamond) {
                this.queryCount = 0;
                //this.emitUI(UIControllerName.UIController_UIPaySuccess, { type: 2 });
            }
        })
    }
    //
    startQuery(diamond = DiamondSkipAD) {
        this.queryCount = 4;
        this.queryTime = this.queryInvertal[4 - this.queryCount];
        this.queryCount--;
        this.queryDiamond = diamond;

        this.emitUI(UIControllerName.UIController_UIPaySuccess, { type: 1 });

        if (SDKAdapter.getInstance().isWebDev()) {
            setTimeout(() => {
                PlayerManager.getInstance().HLDDZ_user.diamondCount += 300;
            }, 2300);
        }
    }
    queryViewableAdCount() {
        setTimeout(() => {
            SDKAdapter.getInstance().HLDDZ_queryViewableAdCount((data: number) => {
                GameManager.getInstance().canAd = data;
            });
        }, 3000);
    }
    playVibrateShort() {
        if (SoundManager.Instance.GetShakeMute()) {
            SDKAdapter.getInstance().HLDDZ_vibrateShort();
        }
    }
    update(dt: number) {
        this.handleQuery(dt);
    }

    rankonChallengeStart(res: unknown) {
        const ret = res as { scoreKey: string, subScoreKey: number };
        console.warn('擂台赛开始', ret.scoreKey);
        console.warn('关卡数', ret.subScoreKey);

        if (!ret.subScoreKey) return;

        EventManager.getInstance().emit(UIControllerName.UIController_rankonChallengeStart, { scoreKey: ret.scoreKey, subScoreKey: ret.subScoreKey });
    }

    //
    private readonly models = new Map<string, IDataModel>();

    public registerDataModel(name: string, factory: IDataModel): void {
        this.models.set(name, factory);
    }

    public init(): void {
        this.models.clear();

        this.registerDataModel(ModelName.ScoreData, new ScoreData());
    }

    public clear(modelName = ModelName.ScoreData): void {
        this.models.get(modelName)?.clear?.();
    }

    public getModel<T extends IDataModel>(name: string): T | undefined {
        return this.models.get(name) as T | undefined;
    }
}