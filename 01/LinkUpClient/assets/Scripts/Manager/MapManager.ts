
import { UIComponent } from "../../FrameWork/ui/UIComponent";
import { BlockIDs, GameDirection } from "../Constant";
import { GameBlock } from "../Game/GameBlock";

export default class MapManager extends UIComponent {
    private static Instance: MapManager
    public mapTitles: cc.Node[][] = [];
    public mapWidth = 0;
    public mapHeight = 0;
    public dirction = GameDirection.None;

    onLoad() {
        MapManager.Instance = this;
    }

    public static getInstance() {
        return MapManager.Instance;
    }

    public reset() {
        this.mapTitles = [];
        this.mapWidth = 0;
        this.mapHeight = 0;
    }

    public getBoard() {
        const board: number[][] = [];
        for (const row of this.mapTitles) {
            for (const item of row) {

                const ts = item.getComponent(GameBlock).getBaseData();
                if (!board[ts.y]) {
                    board[ts.y] = [];
                }
                //
                if (item.getComponent(GameBlock).isVisible) {
                    board[ts.y][ts.x] = ts.id;
                }
                else {
                    board[ts.y][ts.x] = 0;
                }
            }
        }

        return board;
    }

    public checkWin() {
        const board = this.getBoard();
        for (const row of board) {
            for (const id of row) {
                if (id == 0) {
                    continue;
                }
                if (id >= BlockIDs.None) {
                    continue;
                }

                return false;
            }
        }

        return true;
    }

    public getBlocksById(id: number) {
        const blocks: cc.Node[] = [];
        for (const row of this.mapTitles) {
            for (const item of row) {
                if (item.getComponent(GameBlock).getBaseData().id == id) {
                    blocks.push(item);
                }
            }
        }
        return blocks;
    }
}
