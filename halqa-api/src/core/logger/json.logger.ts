import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { scrubLine } from './scrubber';

function line(level: string, message: unknown, context?: string, requestId?: string): string {
  return scrubLine(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ctx: context ?? 'app',
      req: requestId ?? '-',
      msg: typeof message === 'string' ? message : message,
    }),
  );
}

@Injectable()
export class JsonLogger implements LoggerService {
  private level: LogLevel = 'log';
  setRequestId(_id: string): void {
    /* per-request id is passed explicitly via context string instead of ALS
       to keep Phase 0 dependency-free; see request-id.interceptor.ts */
  }
  setLogLevels?(levels: LogLevel[]): void {
    if (levels?.length) this.level = levels[0];
  }
  log(message: unknown, context?: string): void {
    process.stdout.write(line('log', message, context) + '\n');
  }
  error(message: unknown, ...rest: unknown[]): void {
    const ctx = typeof rest[0] === 'string' ? rest[0] : 'app';
    process.stderr.write(line('error', message, ctx) + '\n');
  }
  warn(message: unknown, context?: string): void {
    process.stdout.write(line('warn', message, context) + '\n');
  }
  debug(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== 'production')
      process.stdout.write(line('debug', message, context) + '\n');
  }
  verbose(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== 'production')
      process.stdout.write(line('verbose', message, context) + '\n');
  }
}
