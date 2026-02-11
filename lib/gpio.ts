/**
 * GPIO utilities for buttons and LED via Python daemon.
 *
 * Uses a persistent Python process (gpio_daemon.py) for GPIO control
 * via stdin/stdout JSON IPC. This avoids spawning/killing processes
 * for each operation and provides better reliability.
 *
 * In mock mode: simulates button presses via keyboard 'b' key.
 */

import { spawn, ChildProcess } from "node:child_process";
import { join } from "node:path";
import { createInterface, Interface } from "node:readline";
import { IS_MOCK } from "./env.js";

/** Timeout for GPIO commands (ms) */
const COMMAND_TIMEOUT_MS = 5_000;

/** Path to the Python GPIO daemon script */
const GPIO_DAEMON_SCRIPT = join(
  import.meta.dirname,
  "..",
  "..",
  "python",
  "gpio_daemon.py",
);

/** Button press callback type */
export type ButtonCallback = () => void;

/** GPIO daemon process */
let daemonProcess: ChildProcess | null = null;

/** Readline interface for reading daemon stdout */
let daemonReader: Interface | null = null;

/** Registered button callbacks by pin */
const buttonCallbacks = new Map<number, ButtonCallback[]>();

/** Pending command responses */
const pendingCommands = new Map<
  string,
  { resolve: () => void; reject: (err: Error) => void }
>();

/** Whether daemon is ready */
let daemonReady = false;

/** Promise that resolves when daemon is ready */
let daemonReadyPromise: Promise<void> | null = null;
let daemonReadyResolve: (() => void) | null = null;

/**
 * Send a command to the daemon.
 */
function sendCommand(cmd: Record<string, unknown>): void {
  if (!daemonProcess?.stdin) {
    throw new Error("GPIO daemon not running");
  }
  const line = JSON.stringify(cmd) + "\n";
  daemonProcess.stdin.write(line);
}

/**
 * Send a command and wait for response.
 */
async function sendCommandWithResponse(
  cmd: Record<string, unknown>,
): Promise<void> {
  const cmdType = cmd.cmd as string;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingCommands.delete(cmdType);
      reject(new Error(`GPIO command timeout: ${cmdType}`));
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(cmdType, {
      resolve: () => {
        clearTimeout(timeoutId);
        resolve();
      },
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    });

    sendCommand(cmd);
  });
}

/**
 * Handle a message from the daemon.
 */
function handleDaemonMessage(line: string): void {
  try {
    const msg = JSON.parse(line);

    // Handle ready event
    if (msg.event === "ready") {
      console.log("[gpio] Daemon ready");
      daemonReady = true;
      daemonReadyResolve?.();
      return;
    }

    // Handle button event
    if (msg.event === "button") {
      const pin = msg.pin as number;
      const callbacks = buttonCallbacks.get(pin);
      if (callbacks) {
        console.log(`[gpio] Button event on pin ${pin}`);
        for (const cb of callbacks) {
          try {
            cb();
          } catch (err) {
            console.error("[gpio] Button callback error:", err);
          }
        }
      }
      return;
    }

    // Handle command response
    if (msg.response === "ok") {
      const cmd = msg.cmd as string;
      const pending = pendingCommands.get(cmd);
      if (pending) {
        pendingCommands.delete(cmd);
        pending.resolve();
      }
      return;
    }

    // Handle error
    if (msg.error) {
      console.error("[gpio] Daemon error:", msg.error);
      // Reject any pending command (we don't know which one failed)
      for (const [cmd, pending] of pendingCommands) {
        pendingCommands.delete(cmd);
        pending.reject(new Error(msg.error));
      }
      return;
    }
  } catch (err) {
    console.error("[gpio] Failed to parse daemon message:", line, err);
  }
}

/**
 * Start the GPIO daemon process.
 *
 * Must be called before using any GPIO functions (except in mock mode).
 */
export async function startGpioDaemon(): Promise<void> {
  if (IS_MOCK) {
    console.log("[gpio] Mock mode - daemon not started");
    setupMockButton();
    return;
  }

  if (daemonProcess) {
    console.log("[gpio] Daemon already running");
    return;
  }

  // Create ready promise
  daemonReadyPromise = new Promise((resolve) => {
    daemonReadyResolve = resolve;
  });

  console.log(`[gpio] Starting daemon: python3 ${GPIO_DAEMON_SCRIPT}`);

  daemonProcess = spawn("python3", [GPIO_DAEMON_SCRIPT], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Set up readline for stdout
  daemonReader = createInterface({
    input: daemonProcess.stdout!,
    crlfDelay: Infinity,
  });

  daemonReader.on("line", handleDaemonMessage);

  // Log stderr
  daemonProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[gpio] Daemon stderr: ${data.toString().trim()}`);
  });

  daemonProcess.on("error", (err) => {
    console.error(`[gpio] Failed to start daemon: ${err.message}`);
    daemonProcess = null;
  });

  daemonProcess.on("close", (code) => {
    console.log(`[gpio] Daemon exited with code ${code}`);
    daemonProcess = null;
    daemonReader = null;
    daemonReady = false;
  });

  // Wait for ready event
  await Promise.race([
    daemonReadyPromise,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("GPIO daemon startup timeout")), 5000),
    ),
  ]);
}

/**
 * Set up keyboard listener for mock button.
 */
function setupMockButton(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (key: string) => {
    // Ctrl+C to exit
    if (key === "\u0003") {
      console.log("\n[gpio] Exiting...");
      cleanup();
      process.exit();
    }

    // 'b' for button - trigger all registered callbacks
    if (key.toLowerCase() === "b") {
      console.log("[gpio] Mock button pressed (keyboard 'b')");
      for (const callbacks of buttonCallbacks.values()) {
        for (const cb of callbacks) {
          try {
            cb();
          } catch (err) {
            console.error("[gpio] Button callback error:", err);
          }
        }
      }
    }
  });

  console.log("[gpio] Mock button ready - press 'b' to simulate button press");
}

/**
 * Subscribe to button press events on a pin.
 *
 * @param pin - GPIO pin number
 * @param callback - Function to call when button is pressed
 */
export async function onButtonPress(
  pin: number,
  callback: ButtonCallback,
): Promise<void> {
  // Register callback
  const existing = buttonCallbacks.get(pin) || [];
  existing.push(callback);
  buttonCallbacks.set(pin, existing);

  // In mock mode, we're done (mock setup happens in startGpioDaemon)
  if (IS_MOCK) {
    return;
  }

  // Subscribe to pin if this is the first callback for it
  if (existing.length === 1) {
    await sendCommandWithResponse({ cmd: "button_subscribe", pin });
    console.log(`[gpio] Subscribed to button on pin ${pin}`);
  }
}

/**
 * Set LED state.
 *
 * @param pin - GPIO pin number
 * @param on - true to turn LED on, false to turn off
 */
export async function setLed(pin: number, on: boolean): Promise<void> {
  if (IS_MOCK) {
    console.log(`[gpio] Mock LED pin ${pin}: ${on ? "ON" : "OFF"}`);
    return;
  }

  await sendCommandWithResponse({ cmd: "led", pin, on });
}

/**
 * Clean up GPIO resources.
 */
export function cleanup(): void {
  if (daemonProcess) {
    console.log("[gpio] Stopping daemon");
    try {
      sendCommand({ cmd: "shutdown" });
    } catch {
      // Ignore errors when sending shutdown
    }
    // Give it a moment to clean up, then kill
    setTimeout(() => {
      if (daemonProcess) {
        daemonProcess.kill("SIGTERM");
        daemonProcess = null;
      }
    }, 100);
  }

  daemonReader = null;
  daemonReady = false;
  buttonCallbacks.clear();
  pendingCommands.clear();

  // Restore terminal if in mock mode
  if (IS_MOCK && process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

// Clean up on process exit
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
