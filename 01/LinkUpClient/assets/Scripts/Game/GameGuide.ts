import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { GameType, UIEventName } from "../Constant";
import GameManager from "../Manager/GameManager";
import MapManager from "../Manager/MapManager";
import PlayerManager from "../Manager/PlayerManager";

const guidePos1 = [
    cc.v3(2, 0, 0),
    cc.v3(2, 3, 0),
]

const guidePos31 = [
    cc.v3(0, 2, 0),
    cc.v3(0, 5, 0),
]

export default class GameGuide extends UIComponent {
    private newNode!: cc.Node;
    private newTip!: cc.Node;
    private startPos: cc.Vec2 = cc.v2(0, 0);

    onLoad(): void {
        super.onLoad();

        this.newNode = this.node.getChildByName("new");
        this.newTip = this.newNode.getChildByName("tip");
        this.newNode.active = false;
    }

    // LIFE-CYCLE CALLBACKS:
    initNewAction() {
        if (PlayerManager.getInstance().getMapID() == 1) {
            this.newNode.active = GameManager.getInstance().gameType == GameType.Normal;
            this.init1();
            this.register1TouchEvent();
            this.emitUI(UIEventName.UIGame_touchStart);
        }
        else if (PlayerManager.getInstance().getMapID() == 31) {
            this.newNode.active = false;
            cc.tween(this.node)
                .delay(3.0)
                .call(() => {
                    this.newNode.active = true;
                    this.init31();
                    this.register31TouchEvent();
                    this.emitUI(UIEventName.UIGame_touchStart);
                })
                .start()
        }
    }

    init31() {
        this.addUIEventListener(UIEventName.GameGuide_touchCancel, this.nodeTouch31CancelEvent, this);
        this.newTip.active = true;
        this.newNode.getComponent(cc.BlockInputEvents).enabled = false;
        this.newTip.scale = 0.1;
        cc.tween(this.newTip)
            .to(0.2, { scale: 1.2 })
            .to(0.1, { scale: 1.0 })
            .start();
        //
        const guideNode = this.newNode.getChildByName("guide31");
        const quanNode = guideNode.getChildByName("quan3");
        const quanNode2 = guideNode.getChildByName("quan2");
        guideNode.active = true;
        const szNode = guideNode.getChildByName("shouzhi");
        const pos = guidePos31[GameManager.getInstance().newGuideStep];
        const block = MapManager.getInstance().mapTitles[pos.x][pos.y];
        const worldPos = block.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const nodePos = guideNode.parent.convertToNodeSpaceAR(worldPos);
        guideNode.setPosition(nodePos);
        quanNode.scale = 0.1;
        cc.tween(quanNode)
            .to(0.4, { scale: 0.6 })
            .to(0.4, { scale: 0.5 })
            .repeatForever(
                cc.tween()
                    .to(1.0, { scale: 0.6 })
                    .to(1.0, { scale: 0.5 })
            )
            .start()
        //

        const pos2 = guidePos31[GameManager.getInstance().newGuideStep + 1];
        const block2 = MapManager.getInstance().mapTitles[pos2.x][pos2.y];
        const worldPos2 = block2.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const nodePos2 = quanNode2.parent.convertToNodeSpaceAR(worldPos2);
        quanNode2.setPosition(nodePos2);
        quanNode2.scale = 0.1;
        cc.tween(quanNode2)
            .to(0.4, { scale: 0.6 })
            .to(0.4, { scale: 0.5 })
            .repeatForever(
                cc.tween()
                    .to(1.0, { scale: 0.6 })
                    .to(1.0, { scale: 0.5 })
            )
            .start()
        const shouzhiPosX = szNode.position.x;
        const shouzhiPosY = szNode.position.y;
        szNode.scale = 0.1;
        cc.tween(szNode)
            .to(0.4, { scale: 1.2 })
            .to(0.2, { scale: 1 })
            .repeatForever(
                cc.tween()
                    .delay(0.5)
                    .to(0.1, { opacity: 255 })
                    .by(1, { position: cc.v3(250, 0, 0) })
                    .delay(0.2)
                    .to(0.1, { opacity: 0 })
                    .call(() => {
                        szNode.setPosition(cc.v3(shouzhiPosX, shouzhiPosY, 0));
                    })
            )
            .start();
    }

    nodeTouch31CancelEvent() {
        this.newNode.active = false;
        this.newTip.active = false;
    }

    init1() {
        const guideNode = this.newNode.getChildByName("guide1");
        const quanNode = guideNode.getChildByName("quan");
        const szNode = guideNode.getChildByName("shouzhi");
        guideNode.active = true;
        quanNode.scale = 0.1;
        cc.tween(quanNode)
            .to(0.8, { scale: 1.05 })
            .to(1.0, { scale: 0.7 })
            .repeatForever(
                cc.tween()
                    .to(1.0, { scale: 1 })
                    .to(1.0, { scale: 0.7 })
            )
            .start()
        szNode.setPosition(cc.v2(50, -50))
        cc.tween(szNode)
            .repeatForever(
                cc.tween()
                    .by(1.0, { position: cc.v3(-50, 50, 0) })
                    .by(1.0, { position: cc.v3(50, -50, 0) })
            )
            .start()

        const pos = PlayerManager.getInstance().getMapID() == 1 ? guidePos1[GameManager.getInstance().newGuideStep] : guidePos31[GameManager.getInstance().newGuideStep];
        const block = MapManager.getInstance().mapTitles[pos.x][pos.y];
        const worldPos = block.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const nodePos = guideNode.parent.convertToNodeSpaceAR(worldPos);
        guideNode.setPosition(nodePos);
    }

    register1TouchEvent(): void {
        this.newNode.on(cc.Node.EventType.TOUCH_START, this.nodeTouchStartEvent, this);
    }

    register31TouchEvent(): void {
        this.newNode.on(cc.Node.EventType.TOUCH_START, this.nodeTouch31StartEvent, this);
        this.newNode.on(cc.Node.EventType.TOUCH_END, this.nodeTouch31EndEvent, this);
    }

    nodeTouch31StartEvent(e: cc.Event.EventTouch): boolean {
        this.startPos = cc.v2(e.getLocation().x, e.getLocation().y);

        return false;
    }

    nodeTouch31EndEvent(e: cc.Event.EventTouch): boolean {
        const endPos = cc.v2(e.getLocation().x, e.getLocation().y);

        const pos = guidePos31[GameManager.getInstance().newGuideStep];
        const block = MapManager.getInstance().mapTitles[pos.x][pos.y];
        const worldPos = block.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const worldRect = new cc.Rect(worldPos.x - 50, worldPos.y - 50, 100, 100);
        if (!worldRect.contains(this.startPos)) {
            return true;
        }
        this.emitUI(UIEventName.UIGame_onTileClick, block);

        const pos2 = guidePos31[GameManager.getInstance().newGuideStep + 1];
        const block2 = MapManager.getInstance().mapTitles[pos2.x][pos2.y];
        const worldPos2 = block2.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const worldRect2 = new cc.Rect(worldPos2.x - 50, worldPos2.y - 50, 100, 100);
        if (!worldRect2.contains(endPos)) {
            return true;
        }
        this.emitUI(UIEventName.UIGame_onTileClick, block2);

        GameManager.getInstance().newGuideStep++;

        this.newNode.active = false;
        this.newTip.active = false;
        return true;
    }

    nodeTouchStartEvent(e: cc.Event.EventTouch): boolean {
        const guideNode = this.newNode.getChildByName("guide1");
        const worldPos = guideNode.convertToWorldSpaceAR(cc.v3(0, 0, 0));
        const worldRect = new cc.Rect(worldPos.x - 50, worldPos.y - 50, 100, 100);
        if (!worldRect.contains(e.getLocation())) {
            return false;
        }
        const pos = guidePos1[GameManager.getInstance().newGuideStep];
        const block = MapManager.getInstance().mapTitles[pos.x][pos.y];
        this.emitUI(UIEventName.UIGame_onTileClick, block);

        GameManager.getInstance().newGuideStep++;
        this.newTip.active = false;
        if (GameManager.getInstance().newGuideStep < 2) {
            const pos = guidePos1[GameManager.getInstance().newGuideStep];
            const block = MapManager.getInstance().mapTitles[pos.x][pos.y];
            const worldPos = block.convertToWorldSpaceAR(cc.v3(0, 0, 0));
            const nodePos = guideNode.parent.convertToNodeSpaceAR(worldPos);
            guideNode.setPosition(nodePos);
        }
        else {
            this.newNode.active = false;
        }

        return false;
    }

    // update (dt) {}
}
