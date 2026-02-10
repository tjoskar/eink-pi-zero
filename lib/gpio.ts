/**
 * GPIO utilities for buttons and LED.
 *
 * Uses:
 * - gpiomon for button events (long-running process)
 * - gpioset for LED control
 * - Keyboard 'b' key in mock mode for button simulation
 */

import { spawn, ChildProcess } from "node:child_process";
import { IS_MOCK } from "./env.js";

/** GPIO chip (gpiochip0 on Pi) */
const GPIO_CHIP = "gpiochip0";

/** Button GPIO pin (placeholder - update for your setup) */
const BUTTON_PIN = 21;

/** LED GPIO pin (placeholder - update for your setup) */
const LED_PIN = 13;

/** Button press callback type */
export type ButtonCallback = () => void;

/** Timeout for LED operations (matches display timeout) */
const LED_TIMEOUT_MS = 30_000;

/** Active gpiomon process */
let gpiomonProcess: ChildProcess | null = null;

/** Active gpioset process for LED (must be kept alive to hold GPIO state) */
let ledProcess: ChildProcess | null = null;

/** Mutex for serializing LED operations */
let ledMutex: Promise<void> = Promise.resolve();

/** Button callback */
let buttonCallback: ButtonCallback | null = null;

/**
 * Set up button listener.
 *
 * In mock mode: listens for 'b' key press on stdin.
 * On Pi: uses gpiomon to watch for GPIO falling edge.
 *
 * @param callback - Function to call when button is pressed
 */
export function onButtonPress(callback: ButtonCallback): void {
  buttonCallback = callback;

  if (IS_MOCK) {
    setupMockButton();
  } else {
    setupGpioButton();
  }
}

/**
 * Set up keyboard listener for mock button.
 */
function setupMockButton(): void {
  // Enable raw mode for single keypress detection
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

    // 'b' for button
    if (key.toLowerCase() === "b") {
      console.log("[gpio] Mock button pressed (keyboard 'b')");
      buttonCallback?.();
    }
  });

  console.log("[gpio] Mock button ready - press 'b' to simulate button press");
}

/**
 * Set up gpiomon for real button on Pi.
 */
function setupGpioButton(): void {
  // gpiomon watches for GPIO events (libgpiod v2.x syntax)
  // -c = chip
  // -e = edge type (falling = button press connects to ground)
  // -b = bias (pull-up keeps pin high when button not pressed)
  // -p = debounce period (filters mechanical button bounce)
  const args = [
    "-c",
    GPIO_CHIP,
    "-e",
    "falling",
    "-b",
    "pull-up",
    "-p",
    "50ms",
    String(BUTTON_PIN),
  ];

  console.log(`[gpio] Starting gpiomon: gpiomon ${args.join(" ")}`);

  gpiomonProcess = spawn("gpiomon", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  gpiomonProcess.stdout?.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    if (line) {
      console.log(`[gpio] Button event: ${line}`);
      buttonCallback?.();
    }
  });

  gpiomonProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[gpio] gpiomon stderr: ${data.toString().trim()}`);
  });

  gpiomonProcess.on("error", (err) => {
    console.error(`[gpio] Failed to start gpiomon: ${err.message}`);
    console.error(
      "[gpio] Make sure libgpiod-utils is installed: sudo apt install gpiod",
    );
  });

  gpiomonProcess.on("close", (code) => {
    console.log(`[gpio] gpiomon exited with code ${code}`);
    gpiomonProcess = null;
  });
}

/**
 * Set LED state.
 *
 * Uses a mutex to ensure only one LED operation runs at a time.
 *
 * @param on - true to turn LED on, false to turn off
 */
export async function setLed(on: boolean): Promise<void> {
  if (IS_MOCK) {
    console.log(`[gpio] Mock LED: ${on ? "ON" : "OFF"}`);
    return;
  }

  // Queue this operation behind any pending LED operations
  const previousMutex = ledMutex;
  let releaseMutex: () => void;
  ledMutex = new Promise((resolve) => {
    releaseMutex = resolve;
  });

  // Wait for previous operation to complete (with timeout)
  await Promise.race([
    previousMutex,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("LED mutex timeout")), LED_TIMEOUT_MS),
    ),
  ]);

  try {
    // Kill previous LED process and wait for it to fully exit (releases the GPIO line)
    if (ledProcess) {
      const oldProcess = ledProcess;
      ledProcess = null;
      await new Promise<void>((resolve) => {
        oldProcess.on("close", () => resolve());
        oldProcess.kill("SIGTERM");
      });
      // Small delay to ensure GPIO line is fully released
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    await new Promise<void>((resolve, reject) => {
      // gpioset -c <chip> <pin>=<value>
      // Note: gpioset runs until terminated to hold the GPIO state
      const value = on ? "1" : "0";
      const args = ["-c", GPIO_CHIP, `${LED_PIN}=${value}`];

      ledProcess = spawn("gpioset", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // gpioset doesn't exit by default (holds the line), so resolve immediately
      // after a short delay to ensure it started successfully
      const startupTimeout = setTimeout(() => {
        resolve();
      }, 50);

      ledProcess.on("error", (err) => {
        clearTimeout(startupTimeout);
        ledProcess = null;
        reject(new Error(`Failed to run gpioset: ${err.message}`));
      });

      ledProcess.on("close", (code) => {
        clearTimeout(startupTimeout);
        // Only reject if it exited unexpectedly (not killed by us)
        if (ledProcess !== null && code !== 0) {
          ledProcess = null;
          reject(new Error(`gpioset exited with code ${code}`));
        }
        ledProcess = null;
      });
    });
  } finally {
    releaseMutex!();
  }
}

/**
 * Flash LED (on briefly, then off).
 *
 * @param durationMs - How long to keep LED on (default 100ms)
 */
export async function flashLed(durationMs = 100): Promise<void> {
  await setLed(true);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  await setLed(false);
}

/**
 * Clean up GPIO resources.
 */
export function cleanup(): void {
  if (gpiomonProcess) {
    console.log("[gpio] Stopping gpiomon");
    gpiomonProcess.kill("SIGTERM");
    gpiomonProcess = null;
  }

  if (ledProcess) {
    console.log("[gpio] Stopping LED process");
    ledProcess.kill("SIGTERM");
    ledProcess = null;
  }

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
