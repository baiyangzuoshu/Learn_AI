/**
 * CP 配置 - 纯值，零依赖，可被 src/game 内部任何模块安全引用
 */

interface CpConfig {
    /** CP 游戏是横屏还是竖屏 */
    orientation: 'landscape' | 'portrait';
    /** CP 在欢乐斗地主平台的注册 ID，用于 SDK 鉴权和支付等接口 */
    cpId: number;
    /** CP 标识符，用于 Bundle 命名（拼接为 `Bundle${cpName}`）等 */
    cpName: string;
    /** CP 显示名称 */
    cpGameName: string;
}

export const cpConfig: CpConfig = {
    orientation: 'portrait',
    cpId: 10004,
    cpName: 'LLK',
    cpGameName: '连连看',
} as const;
