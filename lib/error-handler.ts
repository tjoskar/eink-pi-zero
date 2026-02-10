/**
 * Error handling with file logging and MQTT publishing.
 *
 * Logs errors to both console and a log file,
 * and optionally publishes to MQTT topic.
 */

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MqttClient } from "mqtt";

/** MQTT error topic */
const ERROR_TOPIC = "control-panel/error";

/** Log file path */
const LOG_DIR = join(process.env.HOME ?? "/tmp", "control-panel", "logs");
const LOG_FILE = join(LOG_DIR, "eink-panel.log");

/** MQTT client reference (set by application) */
let mqttClient: MqttClient | null = null;

/**
 * Ensure log directory exists.
 */
function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
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
  try {
    appendFileSync(LOG_FILE, message + "\n");
  } catch (err) {
    // Can't log to file, just console
    console.error("[error-handler] Failed to write to log file:", err);
  }
}

/**
 * Set the MQTT client for error publishing.
 *
 * @param client - MQTT client instance
 */
export function setMqttClient(client: MqttClient): void {
  mqttClient = client;
}

/**
 * Log an info message.
 */
export function logInfo(message: string): void {
  const formatted = formatLogMessage("INFO", message);
  console.log(formatted);
  writeToLog(formatted);
}

/**
 * Log a warning message.
 */
export function logWarn(message: string): void {
  const formatted = formatLogMessage("WARN", message);
  console.warn(formatted);
  writeToLog(formatted);
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

  // Publish to MQTT if connected
  if (publishToMqtt && mqttClient?.connected) {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      source: "eink-panel",
      message,
      stack: error?.stack,
    });

    mqttClient.publish(
      ERROR_TOPIC,
      payload,
      { qos: 1 },
      (err: Error | undefined) => {
        if (err) {
          console.error("[error-handler] Failed to publish to MQTT:", err);
        }
      },
    );
  }
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

/**
 * Get the log file path.
 */
export function getLogFilePath(): string {
  return LOG_FILE;
}
