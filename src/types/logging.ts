import type { LogLevel } from "@/types/env";

export type LogData = Record<string, unknown>;

export type LogOptions = {
  context?: string;
  data?: LogData;
};

export type LogMetadata = {
  timestamp: string;
  level: LogLevel;
  context?: string;
};

export type LogEntry = {
  message: string;
  metadata: LogMetadata;
  data?: LogData;
};

export type LoggerConfig = {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  enableSentry?: boolean;
  remoteUrl?: string;
};

export type Logger = {
  debug: (message: string, options?: LogOptions) => void;
  info: (message: string, options?: LogOptions) => void;
  warn: (message: string, options?: LogOptions) => void;
  error: (message: string, options?: LogOptions) => void;
  fatal: (message: string, options?: LogOptions) => void;
  child: (context: string) => Logger;
};
