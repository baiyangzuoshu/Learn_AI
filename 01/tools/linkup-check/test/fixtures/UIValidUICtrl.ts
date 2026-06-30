import { UIComponent } from '../UIComponent';

export default class UIValidUICtrl extends UIComponent {
    async onShow() {
        const view = await UIManager.Instance.IE_ShowUIView(UIName.UIValid);
        if (!view) return;
        view.addComponent(UIValidUICtrl);
    }

    setupListeners() {
        this.getChildByUrl("bg/btnClose");
        this.AddButtonListener("bg/btnClose", this onClose, this);
        this.AddMOUSEListener("bg/bg", this onBg, this);
    }

    dynamicPaths() {
        this.getChildByUrl("bg/" + this.type);
        this.getChildByUrl(`bg/${this.name}`);
        this.AddButtonListener("/absolute/path", this onAbs, this);
    }
}
