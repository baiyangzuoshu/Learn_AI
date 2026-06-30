import { WSRoute } from "./Constant";
import NetManager from "./NetManager";
import * as Proto from "./protocol";

export type GameSocketLoginResult = {
    code: number;
    msg: string;
    token: string;
    roleId: number;
    maxStage: number;
}

export type GameSocketLoginData = {
    session: string;
    openid: string;
    name: string;
    avatar: string;
}

export type GameSocketBlock = {
    id: number;
    x: number;
    y: number;
    type: number;
}

export type GameSocketSnapshot = {
    code: number;
    msg: string;
    roomId: string;
    stageId: number;
    width: number;
    height: number;
    dirction: number;
    blocks: GameSocketBlock[];
}

export default class GameSocketService {
    private static instance: GameSocketService;
    private loginResult: GameSocketLoginResult | null = null;
    private loginPromise: Promise<GameSocketLoginResult> | null = null;
    private loginKey = "";
    private snapshot: GameSocketSnapshot | null = null;

    public static getInstance(): GameSocketService {
        if (!GameSocketService.instance) {
            GameSocketService.instance = new GameSocketService();
        }
        return GameSocketService.instance;
    }

    private constructor() {
        //
    }

    public isConnected(): boolean {
        return NetManager.Instance.isConnected();
    }

    public getLoginResult(): GameSocketLoginResult | null {
        return this.loginResult;
    }

    public getToken(): string {
        return this.loginResult?.token || "";
    }

    public getRoleId(): number {
        return this.loginResult?.roleId || 0;
    }

    public getMaxStage(): number {
        return this.loginResult?.maxStage || 0;
    }

    public getSnapshot(): GameSocketSnapshot | null {
        return this.snapshot;
    }

    public async connect(): Promise<void> {
        if (NetManager.Instance.isConnected()) return;
        await NetManager.Instance.connect();
    }

    public async login(data: GameSocketLoginData): Promise<GameSocketLoginResult> {
        const loginKey = this.buildLoginKey(data);
        if (this.loginResult && this.loginKey === loginKey) {
            return this.loginResult;
        }
        if (this.loginPromise && this.loginKey === loginKey) {
            return this.loginPromise;
        }

        this.loginKey = loginKey;
        this.loginPromise = this.doLogin(data);
        try {
            return await this.loginPromise;
        }
        finally {
            this.loginPromise = null;
        }
    }

    private buildLoginKey(data: GameSocketLoginData): string {
        return [data.session, data.openid, data.name, data.avatar].join("|");
    }

    private async doLogin(data: GameSocketLoginData): Promise<GameSocketLoginResult> {
        await this.connect();
        const body = Proto.encodeLoginRequest({
            session: data.session,
            openid: data.openid,
            name: data.name,
            avatar: data.avatar,
        });
        const response = Proto.decodeLoginResponse(await NetManager.Instance.request(WSRoute.Login, body));
        const result: GameSocketLoginResult = {
            code: response.code || 0,
            msg: response.msg || "",
            token: response.token || "",
            roleId: response.role_id || 0,
            maxStage: response.max_stage || 0,
        };
        if (result.code !== 200) {
            throw new Error(result.msg || `socket login failed: ${result.code}`);
        }
        this.loginResult = result;
        return result;
    }

    public async enterStage(stageId: number, timeout = 10000): Promise<GameSocketSnapshot> {
        if (this.loginPromise) {
            await this.loginPromise;
        }
        await this.connect();
        const body = Proto.encodeEnterStageRequest({ stage_id: stageId });
        const response = Proto.decodeGameSnapshotResponse(await NetManager.Instance.request(WSRoute.EnterStage, body, timeout));
        const result: GameSocketSnapshot = {
            code: response.code || 0,
            msg: response.msg || "",
            roomId: response.room_id || "",
            stageId: response.stage_id || 0,
            width: response.width || 0,
            height: response.height || 0,
            dirction: response.dirction || 0,
            blocks: (response.blocks || []).map((block) => ({
                id: block.id || 0,
                x: block.x || 0,
                y: block.y || 0,
                type: block.type || 0,
            })),
        };
        if (result.code !== 200) {
            throw new Error(result.msg || `enter stage failed: ${result.code}`);
        }
        this.snapshot = result;
        return result;
    }
}
