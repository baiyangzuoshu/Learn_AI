import { EventManager } from "../../FrameWork/manager/EventManager";

export class IDataModel {
    private id=0;
    clear(){
        this.id=1;
        console.log("id=",this.id);
    }

    public emitUI(eventName: string, data?: unknown){
        EventManager.getInstance().emit(eventName, data);
    }
}