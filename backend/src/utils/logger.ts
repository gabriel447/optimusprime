import { EventEmitter } from 'node:events';
import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class Logger extends EventEmitter {
  private readonly minWeight = LEVEL_WEIGHT[env.LOG_LEVEL];

  log(level: LogLevel, scope: string, message: string, data?: unknown): void {
    if (LEVEL_WEIGHT[level] < this.minWeight) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      data,
    };

    const line = `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} ${scope} — ${message}`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    data === undefined ? fn(line) : fn(line, data);

    this.emit('log', entry);
  }

  debug(scope: string, message: string, data?: unknown) { this.log('debug', scope, message, data); }
  info(scope: string, message: string, data?: unknown) { this.log('info', scope, message, data); }
  warn(scope: string, message: string, data?: unknown) { this.log('warn', scope, message, data); }
  error(scope: string, message: string, data?: unknown) { this.log('error', scope, message, data); }
}

export const logger = new Logger();
