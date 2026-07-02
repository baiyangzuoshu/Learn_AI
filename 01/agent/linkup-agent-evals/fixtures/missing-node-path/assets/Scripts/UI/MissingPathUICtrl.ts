const { ccclass, property } = cc._decorator;

@ccclass
export default class MissingPathUICtrl extends cc.Component {
    @property(cc.Node)
    btnAction: cc.Node = null;  // This path does not exist in prefab

    onLoad() {
        this.btnAction.on('click', this.onAction, this);
    }

    onAction() {
        // Do something
    }
}
