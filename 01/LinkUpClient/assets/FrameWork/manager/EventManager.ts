
export class EventNode {
    public func: unknown;
    public target: unknown;
    public name = ""
}

export class EventManager extends cc.Component {
    private static Instance: EventManager
    public static getInstance(): EventManager {
        if (!EventManager.Instance) {
            EventManager.Instance = new EventManager();
        }

        return EventManager.Instance
    }


    private eventMap: Map<string, EventNode[]> = new Map<string, EventNode[]>;

    public clear(): void {
        this.eventMap = new Map<string, EventNode[]>;
    }

    public on(eventName: string, func: unknown, target: unknown): void {
        if (!this.eventMap.has(eventName)) {
            this.eventMap.set(eventName, []);
        }

        const listeners = this.eventMap.get(eventName) as EventNode[];
        // 检查是否已经存在相同的监听器
        const exists = listeners.some(node => node.func === func && node.target === target);

        if (!exists) {
            const node = new EventNode();
            node.func = func;
            node.target = target;
            listeners.push(node);
        }
    }

    public off(eventName: string, func: unknown, target: unknown): void {
        const listeners = this.eventMap.get(eventName);
        if (!listeners) {
            return;
        }

        for (let i = 0; i < listeners.length; i++) {
            const node = listeners[i];
            if (node.func === func && node.target === target) {
                listeners.splice(i, 1);
                break;
            }
        }

        // 如果该事件没有监听器了，删除该事件的数组
        if (listeners.length === 0) {
            this.eventMap.set(eventName, []);
        }
    }

    public emit(eventName: string, data?: unknown): void {
        const listeners = this.eventMap.get(eventName);
        if (!listeners) {
            return;
        }

        // 创建监听器列表的副本，防止遍历过程中数组变化
        const listenersCopy = listeners.slice();

        for (const node of listenersCopy) {
            if (node.func) {
                const f = node.func as (t: unknown) => void;
                f.call(node.target, data);
            }
        }
    }
}

