/**
 * Logger that writes only to stderr to keep stdout pure for MCP JSON-RPC.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMsg(level: LogLevel, component: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${component}] ${msg}`;
}

export function createLogger(component: string) {
  return {
    debug(msg: string): void {
      if (shouldLog('debug')) {
        process.stderr.write(formatMsg('debug', component, msg) + '\n');
      }
    },
    info(msg: string): void {
      if (shouldLog('info')) {
        process.stderr.write(formatMsg('info', component, msg) + '\n');
      }
    },
    warn(msg: string): void {
      if (shouldLog('warn')) {
        process.stderr.write(formatMsg('warn', component, msg) + '\n');
      }
    },
    error(msg: string): void {
      if (shouldLog('error')) {
        process.stderr.write(formatMsg('error', component, msg) + '\n');
      }
    },
  };
}
