import { UIControllerName } from "../Constant";
import { UITestUICtrl } from "../UI/UITestUICtrl";

const { ccclass, property } = cc._decorator;

@ccclass
export class UIController extends cc.Component {
  onLoad() {
    this.addUIEventListener(UIControllerName.UIController_UITest, this.onShowUITest, this);
  }

  onShowUITest() {
    let view = cc.director.getScene().getChildByName("Canvas").getChildByName("UIRoot");
    view = UIManager.Instance.IE_ShowUIView(UIName.UITest);
    view.addComponent(UITestUICtrl);
  }
}
