
export interface PlayerProfile {
    avatarUrl: string;
    diamondCount: number;
    nickName: string;

    sessionKey: string;
    userid: string;
}

export interface PlayerAuth {
    sessionKey: string,
    userid: string,
    netType: number,
    canBuyDiamond: number,
    musicOn: number,
    soundEffectOn: number,
    realShare: number
}

export function backToHLDDZ() {
    return null;
}

export function requestAuth(id) {
    return null;
}

export function getPlayerProfile() {
    return null;
}

export function showRewardedVideoAd() {
    return null;
}

export function shareMessage(title) {
    return null;
}

export function buyDiamond() {
    return null;
}

export function queryViewableAdCount() {
    return 1;
}

export function payDiamond(id, op) {
    return null;
}

export function onEnterFromShareLink(fn: () => void) {

}

export function showShareRewardsGuide() {

}

export const platform = {
    isMiniGameIOS: () => { return false },
    isMiniGameWin: () => { return false },
    isMiniGameMac: () => { return false }
}

export const __HLDDZ_APP__ = false;
export const __HLDDZ_CP_DEV__ = true;
export const __HLDDZ_MINA__ = false;
export const __MINIGAME_STD_MINA__ = false;
/*          宏	            webdev	webbuild	mina（合入宿主）	mina（独立打包）	用途
    __HLDDZ_CP_DEV__	    isDev	false	       false	          false	       CP 本地开发环境开关
    __HLDDZ_MINA__	        false	false	       true	              false	       欢乐斗地主小游戏宿主环境
    __HLDDZ_APP__	        false	true	       false	          false	       欢乐斗地主 APP 端宿主环境
    __HLDDZ_CP_STANDALONE__	false	false	       false	          true	       CP 独立小游戏环境
    __MINIGAME_STD_MINA__	false	false	       true	              true	       小游戏环境（合入宿主或独立打包）均为 true
*/
