import GameManager from "./GameManager";
import MapManager from "./MapManager";
import ShareManager from "./ShareManager";


export default class GameControl extends cc.Component {

    public static Instance: GameControl

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        GameControl.Instance = this;
    }

    reset() {
        GameManager.getInstance().reset();
        MapManager.getInstance().reset();
        ShareManager.getInstance().reset();
    }

}
