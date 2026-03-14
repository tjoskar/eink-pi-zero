#!/usr/bin/env npx tsx
/**
 * Hardware Debug CLI
 *
 * Interactive tool for testing hardware daemon (GPIO + e-ink display).
 *
 * Usage:
 *   npx tsx scripts/hardware-debug.ts
 *
 * Commands:
 *   led <pin> on|off     - Set LED state (e.g., "led 13 on")
 *   subscribe <pin>      - Subscribe to button events (e.g., "subscribe 21")
 *   render <path> [fast] - Render image to e-ink (e.g., "render /tmp/img.png fast")
 *   exit                 - Exit the CLI
 */

import * as readline from "node:readline";
import {
  startHardwareDaemon,
  onButtonPress,
  setLed,
  renderToDisplay,
  cleanup,
} from "../lib/hardware.ts";
import { readFile } from "node:fs/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function printHelp(): void {
  console.log(`
Hardware Debug CLI - Commands:
  led <pin> on|off     - Set LED state (e.g., "led 13 on")
  subscribe <pin>      - Subscribe to button events (e.g., "subscribe 21")
  render <path> [fast] - Render image to e-ink (e.g., "render /tmp/img.png fast")
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
        if (isNaN(pin) || (state !== "on" && state !== "off")) {
          console.log("Usage: led <pin> on|off");
          break;
        }
        await setLed(pin, state === "on");
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
        const fast = parts[2]?.toLowerCase() === "fast";
        if (!path) {
          console.log("Usage: render <path> [fast]");
          break;
        }
        console.log(`Rendering ${path}${fast ? " (fast mode)" : ""}...`);
        const imageBuffer = await readFile(path);
        await renderToDisplay(imageBuffer, { fast });
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
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
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

  // Start the daemon
  console.log("Starting hardware daemon...");
  await startHardwareDaemon();
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

  rl.on("close", () => {
    console.log("\nCleaning up...");
    cleanup();
    process.exit(0);
  });
}

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\nCleaning up...");
  cleanup();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  cleanup();
  process.exit(1);
});
