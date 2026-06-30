import type { ErrorResponse } from "../../Scripts/types";
import { util } from "../Utils/util";
function queryParams_(params: Record<string, string> = {}) {
    return Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
}

function withQuery_(url: string, params: Record<string, string> = {}) {
    const queryString = queryParams_(params);
    return queryString ? url + (url.indexOf('?') === -1 ? '?' : '&') + queryString : url;
}

function parseXHRResult_(xhr: XMLHttpRequest): RequestResult {
    return {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: xhr.getAllResponseHeaders(),
        data: xhr.responseText,
        text: <T>() => xhr.responseText as T,
    };
}

function errorResponse_(xhr: XMLHttpRequest, message: string | null = null): RequestResult {
    return {
        ok: false,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: xhr.getAllResponseHeaders(),
        data: message || xhr.statusText,
        text: <T>() => xhr.responseText as T,
    };
}

export interface ResponseData {
    code: number,
    data: unknown,
    msg: string,
    time: number
}

export interface RequestResult {
    ok: boolean;
    status: number;
    statusText: string;
    data: string;
    text: <T>() => T;
    headers: string;
}

export default class HttpManager {
    private static _instance: HttpManager | null = null;
    public static get Instance(): HttpManager {
        if (!HttpManager._instance) {
            HttpManager._instance = new HttpManager();
        }
        return HttpManager._instance;
    }
    //
    public static address = "";
    public static token = "";
    public static time = 0;
    static setAddress(address: string): void {
        HttpManager.address = address;
    }

    static setToken(token: string): void {
        HttpManager.token = token;
    }

    static getURL(path: string) {
        return `${HttpManager.address}/${path}`;
    }
    //
    public request<D, P>(data: { msgId: string, param: P }, onSuccess: (data: D) => void, onError: (data: ErrorResponse) => void): void {
        const msgId = data.msgId;
        const param = data.param;

        const url = HttpManager.getURL(msgId); // 获取请求的URL
        const reqData = { "token": HttpManager.token, "param": param }; // 构建请求数据
        util.Log("请求数据:", url, reqData);
        HttpManager.Instance.Post(url, reqData).then((ret: RequestResult) => {
            if (!ret.ok) {
                onError({ msgId: msgId, msg: ret.data });
                return;
            }
            const responseData: ResponseData = JSON.parse(ret.text()); // 解析响应数据
            if (responseData.code == 200) {
                util.Log(msgId + "数据请求成功:", responseData);
                onSuccess(responseData.data as D);
            }
            else {
                onError({ msgId: msgId, msg: responseData.msg });
            }
        });
    }

    Post(url: string, body: unknown) {
        const ignoreCache = false;
        const headers = {};
        const timeout = 5000;        // XHR 自带超时：5s
        const watchdogMs = 5000;     // 额外看门狗：5s
        const queryParams = {};
        const method = 'post';

        return new Promise<RequestResult>((resolve, _) => {
            util.Log(_);
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'text';
            xhr.open(method, withQuery_(url, queryParams));

            if (headers) {
                const v: Record<string, string> = headers;
                Object.keys(headers).forEach(key => xhr.setRequestHeader(key, v[key]));
            }

            if (ignoreCache) {
                xhr.setRequestHeader('Cache-Control', 'no-cache');
            }

            xhr.timeout = timeout;

            // ---- 只允许完成一次的封装 ----
            let settled = false;
            let watchdog: number | null = null;
            const done = (result: RequestResult) => {
                if (settled) return;
                settled = true;
                if (watchdog !== null) {
                    clearTimeout(watchdog);
                    watchdog = null;
                }
                resolve(result);
            };

            // ---- 事件回调 ----
            xhr.onload = () => {
                done(parseXHRResult_(xhr));
            };

            xhr.onerror = () => {
                done(errorResponse_(xhr, 'msg.net_error'));
            };

            xhr.ontimeout = () => {
                done(errorResponse_(xhr, 'msg.net_timeout')); // XHR 自带超时
            };

            // ---- 10 秒看门狗：防止极端情况下回调不触发 ----
            watchdog = setTimeout(() => {
                if (settled) return;
                try { xhr.abort(); } catch { /* 忽略 */ }
                done(errorResponse_(xhr, 'msg.net_timeout_10s'));
            }, watchdogMs) as unknown as number;

            // ---- 发送 ----
            if (typeof body === "object") {
                body = JSON.stringify(body);
                // 如需可加：xhr.setRequestHeader('Content-Type', 'application/json');
            }

            // 你的代码里把 body 强转 Document，这里保留以兼容现有签名
            const v: Document = body as Document;
            xhr.send(v);
        });
    }

}
