export interface LogContext {
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}

export interface Logger {
  info(context: LogContext, message: string): void;
  error(context: LogContext, message: string): void;
}

export class ConsoleLogger implements Logger {
  info(context: LogContext, message: string): void {
    console.log(formatMessage('INFO', context, message));
  }

  error(context: LogContext, message: string): void {
    console.error(formatMessage('ERROR', context, message));
  }
}

function formatMessage(level: string, context: LogContext, message: string): string {
  const meta = JSON.stringify(context);
  return `[${level}] ${message} ${meta}`;
}
