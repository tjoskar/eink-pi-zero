/**
 * Error handling with file logging and MQTT publishing.
 *
 * Logs errors to both console and a log file,
 * and optionally publishes to MQTT topic.
 */
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import EventEmitter from 'node:events';
import { join } from "node:path";

export const logEmitter = new EventEmitter<Record<'log' | 'warn' | 'error', [message: string]>>();

/**
 * Ensure log directory exists.
 */
function ensureLogDir(): void {
  const logDir = process.env.LOG_PATH || "./logs";
  if (!existsSync(logDir)) {
    try {
      mkdirSync(logDir, { recursive: true });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Format a log message with timestamp.
 */
function formatLogMessage(
  level: string,
  message: string,
  error?: Error,
): string {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${level}] ${message}`;
  if (error?.stack) {
    logLine += `\n${error.stack}`;
  }
  return logLine;
}

/**
 * Write to log file.
 */
function writeToLog(message: string): void {
  ensureLogDir();
  const logFile = join(process.env.LOG_PATH || "./logs", "eink-panel.log");
  try {
    appendFileSync(logFile, message + "\n");
  } catch (err) {
    // Can't log to file, just console
    console.error("[error-handler] Failed to write to log file:", err);
  }
}

/**
 * Log an info message.
 */
export function logInfo(message: string): void {
  const formatted = formatLogMessage("INFO", message);
  console.log(formatted);
  writeToLog(formatted);
  logEmitter.emit('log', message);
}

/**
 * Log a warning message.
 */
export function logWarn(message: string): void {
  const formatted = formatLogMessage("WARN", message);
  console.warn(formatted);
  writeToLog(formatted);
  logEmitter.emit('warn', message);
}

/**
 * Log an error and optionally publish to MQTT.
 *
 * @param message - Error message
 * @param error - Optional Error object with stack trace
 * @param publishToMqtt - Whether to publish to MQTT (default true)
 */
export function logError(
  message: string,
  error?: Error,
  publishToMqtt = true,
): void {
  const formatted = formatLogMessage("ERROR", message, error);
  console.error(formatted);
  writeToLog(formatted);
  logEmitter.emit('error', message);
}

/**
 * Create a global error handler for uncaught exceptions.
 */
export function setupGlobalErrorHandler(): void {
  process.on("uncaughtException", (error) => {
    logError("Uncaught exception", error);
    // Give time for MQTT to publish before exiting
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logError("Unhandled rejection", error);
  });

  logInfo("Global error handler initialized");
}
