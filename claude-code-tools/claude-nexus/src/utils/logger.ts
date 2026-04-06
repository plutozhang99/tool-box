type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const VALID_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// HIGH-9: Validate log level from env instead of unsafe cast
function parseLogLevel(envValue: string | undefined): LogLevel {
  if (envValue && VALID_LEVELS.includes(envValue as LogLevel)) {
    return envValue as LogLevel;
  }
  return 'info';
}

let currentLevel: LogLevel = parseLogLevel(process.env['NEXUS_LOG_LEVEL']);
let sessionContext = '';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setSessionContext(sessionId: string): void {
  sessionContext = sessionId.slice(0, 8);
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = sessionContext ? `[${sessionContext}]` : '';
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  // Always write to stderr — stdout is reserved for MCP stdio transport
  process.stderr.write(`${timestamp} ${level.toUpperCase()} ${prefix} ${message}${suffix}\n`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
};
