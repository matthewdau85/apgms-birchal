export type LogPayload = Record<string, unknown>;

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

function log(level: LogLevel, payload: LogPayload, message: string) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    service: 'worker',
    ...payload,
  };

  const serialized = JSON.stringify(entry);

  switch (level) {
    case 'warn':
      console.warn(serialized);
      break;
    case 'error':
    case 'fatal':
      console.error(serialized);
      break;
    default:
      console.log(serialized);
      break;
  }
}

export const logger = {
  info(payload: LogPayload, message: string) {
    log('info', payload, message);
  },
  warn(payload: LogPayload, message: string) {
    log('warn', payload, message);
  },
  error(payload: LogPayload, message: string) {
    log('error', payload, message);
  },
  fatal(payload: LogPayload, message: string) {
    log('fatal', payload, message);
  },
};

export type Logger = typeof logger;
