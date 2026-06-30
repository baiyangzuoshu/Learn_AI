import { SoundManager } from "../../FrameWork/manager/SoundManager";
import { UIManager } from "../../FrameWork/manager/UIManager";
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { util } from "../../FrameWork/Utils/util";
import { ModelName, SoundID, UIName } from "../Constant";
import ScoreData from "../DataModel/ScoreData";
import DataManager from "../Manager/DataManager";

export default class UIScoreUICtrl extends UIComponent {
    onLoad() {
        super.onLoad();
        if (util.isAppPCGame()) {
            this.adaptPC();
        }
        else {
            this.adaptUI();
        }
        this.AddButtonListener("bg3/useBtn", this.onuse3BtnClick, this);
        this.AddButtonListener("bg3/closeBtn", this.onskip3BtnClick, this);
    }
    protected adaptPC() {
        this.node.scale = 1.0
    }
    onskip3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        //const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
        //dataModel.netGameChange(6);
        UIManager.Instance.DestroyUIView(UIName.UIScore);
    }

    onuse3BtnClick() {
        SoundManager.Instance.PlaySound(SoundID.point);
        const dataModel = DataManager.getInstance().getModel(ModelName.ScoreData) as ScoreData;
        dataModel.netGame(0);
    }
}
