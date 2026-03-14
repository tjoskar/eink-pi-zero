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
import { IS_MOCK } from "./env.ts";

/** Timeout for GPIO commands (ms) */
const GPIO_COMMAND_TIMEOUT_MS = 5_000;

/** Timeout for render commands (ms) */
const RENDER_COMMAND_TIMEOUT_MS = 30_000;

/** How often (in render count) to use normal init instead of fast */
const NORMAL_INIT_INTERVAL = 6;

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

/** Promise that resolves when daemon is ready */
let daemonReadyPromise: Promise<void> | null = null;
let daemonReadyResolve: (() => void) | null = null;

/** Render counter for automatic init-mode cycling */
let renderCount = 0;

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

/**
 * Start the hardware daemon process.
 *
 * Must be called before using any hardware functions (except in mock mode).
 */
async function startHardwareDaemon(): Promise<void> {
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
    // Ctrl+C — restore terminal and emit SIGINT locally so the normal
    // signal handling (Promise.race + using) takes over and runs full
    // cleanup. We use process.emit() instead of process.kill(0, ...) to
    // avoid signaling the parent (tsx --watch) before cleanup completes.
    // After cleanup, raw mode is off so a second Ctrl+C exits tsx normally.
    if (key === "\u0003") {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.emit("SIGINT");
      return;
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
function cleanup(): void {
  console.log("[hardware] Cleaning up resources...");
  if (daemonProcess) {
    console.log("[hardware] Stopping daemon");
    try {
      sendCommand({ cmd: "shutdown" });
    } catch {
      // Ignore errors when sending shutdown
    }
    // No need to force-kill: when this process exits, the daemon's
    // stdin pipe closes → it sees EOF → breaks its loop → runs cleanup.
    daemonProcess = null;
  }

  daemonReader?.close();
  daemonReader = null;
  buttonCallbacks.clear();

  // Clear pending commands
  for (const [, pending] of pendingCommands) {
    clearTimeout(pending.timeoutId);
  }
  pendingCommands.clear();

  // Reset render counter so next startup does a full clear
  renderCount = 0;

  // Restore terminal and release stdin in mock mode
  if (IS_MOCK) {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    process.stdin.removeAllListeners("data");
  }
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
  // Resolve render mode: first render clears, then cycle 5 fast / 1 normal
  const { fast, clear } = resolveRenderOptions(options);
  const mode =
    clear ? "clear + normal" : fast ? "fast" : "normal";

  if (IS_MOCK) {
    const imagePath = "preview.png";
    await writeFile(imagePath, imageBuffer);
    console.log(`[hardware] Mock render #${renderCount} (${mode}): ${imagePath}`);
    renderCount++;
    return;
  }

  // Write image to temp file for daemon
  const imagePath = join(tmpdir(), "eink-latest.png");
  await writeFile(imagePath, imageBuffer);

  // Send render command to daemon
  await sendCommandWithResponse(
    {
      cmd: "render",
      path: imagePath,
      fast,
      clear,
    },
    RENDER_COMMAND_TIMEOUT_MS,
  );

  console.log(`[hardware] Render #${renderCount} complete (${mode})`);
  renderCount++;
}

/**
 * Determine effective render options based on the render counter.
 *
 * - Render 0: clear + normal init (startup)
 * - Every (FAST_RENDERS_BEFORE_NORMAL + 1)th render after that: normal init
 * - Otherwise: fast init
 *
 * Explicit values in `options` override the automatic behaviour.
 */
function resolveRenderOptions(options: RenderOptions): {
  fast: boolean;
  clear: boolean;
} {
  if (options.fast !== undefined || options.clear !== undefined) {
    return { fast: options.fast ?? false, clear: options.clear ?? false };
  }

  if (renderCount === 0) {
    return { fast: false, clear: true };
  }

  // After startup, cycle: 5 fast, 1 normal, 5 fast, 1 normal, ...
  if (renderCount % NORMAL_INIT_INTERVAL === 0) {
    return { fast: false, clear: false };
  }

  return { fast: true, clear: false };
}

/** Hardware daemon handle for use with `using` keyword */
export interface HardwareHandle extends Disposable {
  /** Manually clean up resources (same as letting handle go out of scope) */
  cleanup: typeof cleanup;
}

/**
 * Start the hardware daemon and return a disposable handle.
 *
 * Use with `using` for automatic cleanup on scope exit:
 * ```ts
 * async function main() {
 *   using hardware = await initHardware();
 *   // ... app code ...
 * } // cleanup() called automatically when scope exits
 * ```
 *
 * Note: `using` does NOT handle SIGINT/SIGTERM - add signal handlers in entry point:
 * ```ts
 * async function main() {
 *   using hardware = await initHardware();
 *   await Promise.race([
 *     once(process, "SIGINT"),
 *     once(process, "SIGTERM"),
 *     once(process, "SIGHUP"),
 *   ]);
 * }
 * ```
 */
export async function initHardware(): Promise<HardwareHandle> {
  await startHardwareDaemon();
  return {
    cleanup,
    [Symbol.dispose]: cleanup,
  };
}
