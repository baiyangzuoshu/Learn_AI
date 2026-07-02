const { ccclass, property } = cc._decorator;

@ccclass
export default class UISetUICtrl extends cc.Component {
    @property(cc.Node)
    btnClose: cc.Node = null;

    @property(cc.Node)
    labelTitle: cc.Node = null;

    onLoad() {
        this.btnClose.on('click', this.onClose, this);
    }

    onClose() {
        this.node.active = false;
    }
}
