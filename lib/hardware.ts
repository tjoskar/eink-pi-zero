/**
 * Hardware utilities for buttons, LED, and e-ink display via Python daemon.
 *
 * Uses a persistent Python process (hardware_daemon.py) for all hardware I/O
 * via stdin/stdout JSON IPC. This provides:
 * - Unified hardware control (GPIO + display)
 * - No process spawn/kill per operation
 * - Lazy e-ink initialization
 *
 * In mock mode: simulates button presses via keyboard 'b' key, logs display renders.
 */

import { spawn, ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface, Interface } from "node:readline";
import { IS_MOCK } from "./env.js";

/** Timeout for GPIO commands (ms) */
const GPIO_COMMAND_TIMEOUT_MS = 5_000;

/** Timeout for render commands (ms) */
const RENDER_COMMAND_TIMEOUT_MS = 30_000;

/** Path to the Python hardware daemon script */
const HARDWARE_DAEMON_SCRIPT = join(
  import.meta.dirname,
  "..",
  "..",
  "python",
  "hardware_daemon.py",
);

/** Button press callback type */
export type ButtonCallback = () => void;

/** Render options */
export interface RenderOptions {
  /** Use fast init mode (faster refresh, less clean) */
  fast?: boolean;
  /** Clear display before rendering */
  clear?: boolean;
}

/** Hardware daemon process */
let daemonProcess: ChildProcess | null = null;

/** Readline interface for reading daemon stdout */
let daemonReader: Interface | null = null;

/** Registered button callbacks by pin */
const buttonCallbacks = new Map<number, ButtonCallback[]>();

/** Pending command responses */
const pendingCommands = new Map<
  string,
  {
    resolve: () => void;
    reject: (err: Error) => void;
    timeoutId: NodeJS.Timeout;
  }
>();

/** Whether daemon is ready */
let daemonReady = false;

/** Promise that resolves when daemon is ready */
let daemonReadyPromise: Promise<void> | null = null;
let daemonReadyResolve: (() => void) | null = null;

// =============================================================================
// Internal IPC
// =============================================================================

/**
 * Send a command to the daemon.
 */
function sendCommand(cmd: Record<string, unknown>): void {
  if (!daemonProcess?.stdin) {
    throw new Error("Hardware daemon not running");
  }
  const line = JSON.stringify(cmd) + "\n";
  daemonProcess.stdin.write(line);
}

/**
 * Send a command and wait for response.
 */
async function sendCommandWithResponse(
  cmd: Record<string, unknown>,
  timeoutMs: number = GPIO_COMMAND_TIMEOUT_MS,
): Promise<void> {
  const cmdType = cmd.cmd as string;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingCommands.delete(cmdType);
      reject(new Error(`Hardware command timeout: ${cmdType}`));
    }, timeoutMs);

    pendingCommands.set(cmdType, {
      resolve: () => {
        clearTimeout(timeoutId);
        resolve();
      },
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      },
      timeoutId,
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
      console.log("[hardware] Daemon ready");
      daemonReady = true;
      daemonReadyResolve?.();
      return;
    }

    // Handle button event
    if (msg.event === "button") {
      const pin = msg.pin as number;
      const callbacks = buttonCallbacks.get(pin);
      if (callbacks) {
        console.log(`[hardware] Button event on pin ${pin}`);
        for (const cb of callbacks) {
          try {
            cb();
          } catch (err) {
            console.error("[hardware] Button callback error:", err);
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
      console.error("[hardware] Daemon error:", msg.error);
      // Reject any pending command (we don't know which one failed)
      for (const [cmd, pending] of pendingCommands) {
        pendingCommands.delete(cmd);
        pending.reject(new Error(msg.error));
      }
      return;
    }
  } catch (err) {
    console.error("[hardware] Failed to parse daemon message:", line, err);
  }
}

// =============================================================================
// Daemon Lifecycle
// =============================================================================

/**
 * Start the hardware daemon process.
 *
 * Must be called before using any hardware functions (except in mock mode).
 */
export async function startHardwareDaemon(): Promise<void> {
  if (IS_MOCK) {
    console.log("[hardware] Mock mode - daemon not started");
    setupMockButton();
    return;
  }

  if (daemonProcess) {
    console.log("[hardware] Daemon already running");
    return;
  }

  // Create ready promise
  daemonReadyPromise = new Promise((resolve) => {
    daemonReadyResolve = resolve;
  });

  console.log(`[hardware] Starting daemon: python3 ${HARDWARE_DAEMON_SCRIPT}`);

  daemonProcess = spawn("python3", [HARDWARE_DAEMON_SCRIPT], {
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
    console.error(`[hardware] Daemon stderr: ${data.toString().trim()}`);
  });

  daemonProcess.on("error", (err) => {
    console.error(`[hardware] Failed to start daemon: ${err.message}`);
    daemonProcess = null;
  });

  daemonProcess.on("close", (code) => {
    console.log(`[hardware] Daemon exited with code ${code}`);
    daemonProcess = null;
    daemonReader = null;
    daemonReady = false;
  });

  // Wait for ready event
  await Promise.race([
    daemonReadyPromise,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("Hardware daemon startup timeout")),
        5000,
      ),
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
      console.log("\n[hardware] Exiting...");
      cleanup();
      process.exit();
    }

    // 'b' for button - trigger all registered callbacks
    if (key.toLowerCase() === "b") {
      console.log("[hardware] Mock button pressed (keyboard 'b')");
      for (const callbacks of buttonCallbacks.values()) {
        for (const cb of callbacks) {
          try {
            cb();
          } catch (err) {
            console.error("[hardware] Button callback error:", err);
          }
        }
      }
    }
  });

  console.log(
    "[hardware] Mock button ready - press 'b' to simulate button press",
  );
}

/**
 * Clean up hardware resources.
 */
export function cleanup(): void {
  if (daemonProcess) {
    console.log("[hardware] Stopping daemon");
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

  // Clear pending commands
  for (const [, pending] of pendingCommands) {
    clearTimeout(pending.timeoutId);
  }
  pendingCommands.clear();

  // Restore terminal if in mock mode
  if (IS_MOCK && process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

// =============================================================================
// GPIO: Buttons
// =============================================================================

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

  // In mock mode, we're done (mock setup happens in startHardwareDaemon)
  if (IS_MOCK) {
    return;
  }

  // Subscribe to pin if this is the first callback for it
  if (existing.length === 1) {
    await sendCommandWithResponse({ cmd: "button_subscribe", pin });
    console.log(`[hardware] Subscribed to button on pin ${pin}`);
  }
}

// =============================================================================
// GPIO: LED
// =============================================================================

/**
 * Set LED state.
 *
 * @param pin - GPIO pin number
 * @param on - true to turn LED on, false to turn off
 */
export async function setLed(pin: number, on: boolean): Promise<void> {
  if (IS_MOCK) {
    console.log(`[hardware] Mock LED pin ${pin}: ${on ? "ON" : "OFF"}`);
    return;
  }

  await sendCommandWithResponse({ cmd: "led", pin, on });
}

// =============================================================================
// Display: E-ink Rendering
// =============================================================================

/**
 * Render a PNG buffer to the e-ink display.
 *
 * @param imageBuffer - PNG image data as a Buffer
 * @param options - Render options (fast, clear)
 * @returns Promise that resolves when rendering is complete
 * @throws Error if rendering fails
 */
export async function renderToDisplay(
  imageBuffer: Buffer,
  options: RenderOptions = {},
): Promise<void> {
  // Write image to temp file
  const imagePath = join(tmpdir(), "eink-latest.png");
  await writeFile(imagePath, imageBuffer);

  if (IS_MOCK) {
    console.log(`[hardware] Mock render: ${imagePath}`);
    return;
  }

  // Send render command to daemon
  await sendCommandWithResponse(
    {
      cmd: "render",
      path: imagePath,
      fast: options.fast ?? false,
      clear: options.clear ?? false,
    },
    RENDER_COMMAND_TIMEOUT_MS,
  );

  console.log("[hardware] Render complete");
}

// =============================================================================
// Process Cleanup
// =============================================================================

// Clean up on process exit
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
