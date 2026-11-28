#!/usr/bin/env npx tsx
/**
 * Hardware Debug CLI
 *
 * Interactive tool for testing the hardware (panel, button, LED) by hand.
 *
 * Usage:
 *   pnpm --filter @tjoskar/eink hardware-debug
 *
 * Commands:
 *   led <pin> on|off|blink - Set LED state (e.g., "led 13 on")
 *   subscribe <pin>      - Subscribe to button events (e.g., "subscribe 21")
 *   render <path> [fast|gray4] - Render a PNG to the panel (e.g., "render /tmp/img.png gray4")
 *   exit                 - Exit the CLI
 */

import * as readline from "node:readline";
import { initHardware, onButtonPress, setLed, renderToDisplay } from "../src/hardware.ts";
import { readFile } from "node:fs/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printHelp(): void {
  console.log(`
Hardware Debug CLI - Commands:
  led <pin> on|off|blink - Set LED state (e.g., "led 13 on")
  subscribe <pin>      - Subscribe to button events (e.g., "subscribe 21")
  render <path> [fast|gray4] - Render a PNG (e.g., "render /tmp/img.png gray4")
  help                 - Show this help
  exit                 - Exit the CLI
`);
}

async function handleCommand(line: string): Promise<boolean> {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (!cmd) return true;

  try {
    switch (cmd) {
      case "led": {
        const pin = parseInt(parts[1], 10);
        const state = parts[2]?.toLowerCase();
        if (isNaN(pin) || (state !== "on" && state !== "off" && state !== "blink")) {
          console.log("Usage: led <pin> on|off|blink");
          break;
        }
        await setLed(pin, state === "blink" ? "blink" : state === "on");
        console.log(`✓ LED ${pin} ${state}`);
        break;
      }

      case "subscribe": {
        const pin = parseInt(parts[1], 10);
        if (isNaN(pin)) {
          console.log("Usage: subscribe <pin>");
          break;
        }
        await onButtonPress(pin, () => {
          console.log(`[event] Button pressed on pin ${pin}`);
          rl.prompt();
        });
        console.log(`✓ Subscribed to button on pin ${pin}`);
        break;
      }

      case "render": {
        const path = parts[1];
        const variant = parts[2]?.toLowerCase();
        if (!path || (variant && variant !== "fast" && variant !== "gray4")) {
          console.log("Usage: render <path> [fast|gray4]");
          break;
        }
        console.log(`Rendering ${path}${variant ? ` (${variant})` : ""}...`);
        const imageBuffer = await readFile(path);
        await renderToDisplay(
          imageBuffer,
          variant === "gray4" ? { mode: "gray4" } : { fast: variant === "fast" },
        );
        console.log(`✓ Rendered ${path}`);
        break;
      }

      case "help":
        printHelp();
        break;

      case "exit":
      case "quit":
        return false;

      default:
        console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return true;
}

async function main(): Promise<void> {
  console.log("Hardware Debug CLI");
  console.log("==================");
  console.log('Type "help" for available commands.\n');

  // Check if running in mock mode
  if (process.env.MOCK === "1") {
    console.log("Running in MOCK mode - hardware commands will be simulated.\n");
  }

  const hardware = await initHardware();
  console.log();

  rl.setPrompt("hw> ");
  rl.prompt();

  rl.on("line", async (line) => {
    const shouldContinue = await handleCommand(line);
    if (shouldContinue) {
      rl.prompt();
    } else {
      rl.close();
    }
  });

  // Ctrl+C or Ctrl+D: wait for cleanup (a running render ends in deep sleep).
  rl.on("SIGINT", () => rl.close());
  rl.on("close", async () => {
    console.log("\nCleaning up...");
    await hardware.cleanup();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
