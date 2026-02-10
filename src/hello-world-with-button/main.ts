/**
 * Hello World example - Main entry point.
 *
 * Demonstrates:
 * - JSX rendering to e-ink display
 * - Button handling (real GPIO or mock keyboard)
 */
import { renderApp } from "./app.tsx";
import { renderToDisplay } from "#lib/display.ts";
import { onButtonPress, cleanup, setLed } from "#lib/gpio.ts";
import { IS_MOCK } from "#lib/env.ts";

// Application state
let buttonPresses = 0;
let isUpdating = false;

/**
 * Update the display with current state.
 */
async function updateDisplay(): Promise<void> {
  if (isUpdating) {
    console.log("Skipping update - render already in progress");
    return;
  }

  isUpdating = true;
  console.log("Updating display...");

  try {
    if (buttonPresses % 2 === 0) {
      console.log("Turning LED ON");
      await setLed(true);
    } else {
      console.log("Turning LED OFF");
      await setLed(false);
    }
    const imageBuffer = await renderApp({
      buttonPresses,
      lastUpdate: new Date(),
    });

    await renderToDisplay(imageBuffer, { fast: true });
    console.log("Display updated successfully");
  } catch (error) {
    console.log(
      "Failed to update display",
      error instanceof Error ? error : undefined,
    );
  } finally {
    isUpdating = false;
  }
}

/**
 * Handle button press.
 */
function handleButtonPress(): void {
  buttonPresses++;
  console.log(`Button pressed (total: ${buttonPresses})`);

  // Update display immediately
  updateDisplay().catch(console.error);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════╗");
  console.log("║       E-Ink Hello World Example        ║");
  console.log("╚════════════════════════════════════════╝");
  console.log();

  // Set up button handler
  onButtonPress(handleButtonPress);

  // Initial display update
  await updateDisplay();

  console.log("Application started");

  if (IS_MOCK) {
    console.log();
    console.log("Running in mock mode:");
    console.log("  • Press 'b' to simulate button press");
    console.log("  • Press Ctrl+C to exit");
    console.log("  • Images saved to /tmp/eink-panel/latest.png");
    console.log();
  }
}

// Handle clean shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  cleanup();
  process.exit(0);
});

// Start the application
main().catch((error) => {
  console.log("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
