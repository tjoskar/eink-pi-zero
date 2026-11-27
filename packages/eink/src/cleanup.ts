/**
 * Drives the panel's power, RST and DC low, plus any LED pins given as
 * arguments, then releases them. For a systemd unit's ExecStopPost=, which
 * runs after the app has stopped in any way, also SIGKILL, OOM or a crash,
 * when the app's own cleanup could not run:
 *
 *   ExecStopPost=/usr/bin/node node_modules/@tjoskar/eink/dist/cleanup.js 13
 *
 * It sends no sleep commands: after a normal exit the panel already sleeps,
 * and after a crash mid-render its state is unknown, so cutting the power is
 * the safe choice. If another process holds the lines it does nothing.
 */
import { Epd, PANEL_PINS } from "./driver/epd.ts";
import { assertExpectedChip, LineRequest } from "./driver/gpio.ts";

const ledPins = process.argv.slice(2).map(Number);
// Never drive BUSY (or any other panel or SPI line) as an output.
if (ledPins.some((pin) => !Number.isInteger(pin) || PANEL_PINS.has(pin))) {
  console.error("usage: cleanup.js [led-pin...] (not a panel or SPI pin)");
  process.exit(2);
}

try {
  assertExpectedChip();
  // Requesting a line as output drives it low; releasing keeps it low.
  new Epd().release();
  for (const pin of ledPins) new LineRequest([pin], { direction: "output" }).release();
  console.log("[cleanup] Panel power, RST, DC and LEDs are low");
} catch (err) {
  // Most likely another app owns the panel: leave it alone.
  console.error(`[cleanup] Nothing done: ${err instanceof Error ? err.message : err}`);
}
