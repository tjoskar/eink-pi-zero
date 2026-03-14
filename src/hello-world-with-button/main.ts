/**
 * Hello World example - Main entry point.
 *
 * Demonstrates:
 * - JSX rendering to e-ink display
 * - Button handling (real GPIO or mock keyboard)
 */
import { renderApp } from "./app.tsx";
import {
  initHardware,
  onButtonPress,
  setLed,
  renderToDisplay,
  IS_MOCK
} from "#lib";
import { once } from "node:events";

/** GPIO pin for the button */
const BUTTON_PIN = 21;

/** GPIO pin for the LED */
const LED_PIN = 13;

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
      await setLed(LED_PIN, true);
    } else {
      console.log("Turning LED OFF");
      await setLed(LED_PIN, false);
    }
    const imageBuffer = await renderApp({
      buttonPresses,
      lastUpdate: new Date(),
    });

    await renderToDisplay(imageBuffer);
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
  // Start hardware daemon
  using _hardware = await initHardware();

  // Set up button handler
  await onButtonPress(BUTTON_PIN, handleButtonPress);

  // Initial display update
  await updateDisplay();

  console.log("Application started");

  if (IS_MOCK) {
    console.log();
    console.log("Running in mock mode:");
    console.log("  • Press 'b' to simulate button press");
    console.log("  • Press Ctrl+C to exit");
    console.log("  • Images saved to ./preview.png");
    console.log();
  }

  await Promise.race([
    once(process, "SIGINT"),
    once(process, "SIGTERM"),
    once(process, "SIGHUP"),
  ]);
}

// Start the application
main().catch((error) => {
  console.log("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
