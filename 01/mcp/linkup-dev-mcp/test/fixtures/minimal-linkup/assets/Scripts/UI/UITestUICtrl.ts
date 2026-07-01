const { ccclass, property } = cc._decorator;

@ccclass
export class UITestUICtrl extends cc.Component {
  onLoad() {
    this.AddButtonListener("bg/btnStart", this.onBtnStart, this);
    this.getChildByUrl("bg/label");
  }

  onBtnStart() {
    // handler
  }
}
