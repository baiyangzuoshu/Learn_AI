const { ccclass, property } = cc._decorator;

@ccclass
export default class DuplicateUICtrl extends cc.Component {
    @property(cc.Node)
    btnConfirm: cc.Node = null;

    onLoad() {
        // First attachment
        this.btnConfirm.on('click', this.onConfirm, this);
    }

    start() {
        // Duplicate attachment - same event on same node
        this.btnConfirm.on('click', this.onConfirm, this);
    }

    onConfirm() {
        // Handle confirm
    }
}
