import { UIComponent } from '../UIComponent';

export default class UIDupUICtrl extends UIComponent {
    setup() {
        this.node.addComponent(MapManager);
        this.node.addComponent(MapManager);
    }

    normalMethod() {
        this.node.addComponent(OtherManager);
    }
}
