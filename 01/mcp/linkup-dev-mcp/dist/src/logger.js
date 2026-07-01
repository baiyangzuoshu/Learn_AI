/**
 * Logger that writes only to stderr to keep stdout pure for MCP JSON-RPC.
 */
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let currentLevel = 'info';
export function setLogLevel(level) {
    currentLevel = level;
}
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function formatMsg(level, component, msg) {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${component}] ${msg}`;
}
export function createLogger(component) {
    return {
        debug(msg) {
            if (shouldLog('debug')) {
                process.stderr.write(formatMsg('debug', component, msg) + '\n');
            }
        },
        info(msg) {
            if (shouldLog('info')) {
                process.stderr.write(formatMsg('info', component, msg) + '\n');
            }
        },
        warn(msg) {
            if (shouldLog('warn')) {
                process.stderr.write(formatMsg('warn', component, msg) + '\n');
            }
        },
        error(msg) {
            if (shouldLog('error')) {
                process.stderr.write(formatMsg('error', component, msg) + '\n');
            }
        },
    };
}
//# sourceMappingURL=logger.js.map