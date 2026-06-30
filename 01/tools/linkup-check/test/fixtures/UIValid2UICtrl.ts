import { UIComponent } from '../UIComponent';

export default class UIValid2UICtrl extends UIComponent {
    setupListeners() {
        this.getChildByUrl("bg/nonexistent");
        this.AddButtonListener("bg/btnClose", this onClose, this);
    }
}
