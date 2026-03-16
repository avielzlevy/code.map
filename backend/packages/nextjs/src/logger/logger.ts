type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`;
  return entry.meta ? `${base} ${JSON.stringify(entry.meta)}` : base;
}

function emit(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    meta,
  };
  const formatted = formatEntry(entry);
  if (level === 'error') {
    process.stderr.write(`${formatted}\n`);
  } else {
    process.stdout.write(`${formatted}\n`);
  }
}

export const FlowLogger = {
  info(context: string, message: string, meta?: Record<string, unknown>): void {
    emit('info', context, message, meta);
  },
  warn(context: string, message: string, meta?: Record<string, unknown>): void {
    emit('warn', context, message, meta);
  },
  error(context: string, message: string, meta?: Record<string, unknown>): void {
    emit('error', context, message, meta);
  },
  debug(context: string, message: string, meta?: Record<string, unknown>): void {
    emit('debug', context, message, meta);
  },
};
