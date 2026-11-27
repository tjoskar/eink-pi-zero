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
import { assertAppPin, Epd } from "./driver/epd.ts";
import { assertExpectedChip, LineRequest } from "./driver/gpio.ts";

const ledPins = process.argv.slice(2).map(Number);
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

try {
  // Never drive BUSY (or any other panel or SPI line) as an output.
  for (const pin of ledPins) assertAppPin(pin);
} catch (err) {
  console.error(`[cleanup] usage: cleanup.js [led-pin...]: ${message(err)}`);
  process.exit(2);
}

try {
  assertExpectedChip();
  // Requesting a line as output drives it low; releasing keeps it low.
  new Epd().release();
  console.log("[cleanup] Panel power, RST and DC are low");
} catch (err) {
  // Most likely another app owns the panel: leave it alone.
  console.error(`[cleanup] Panel left alone: ${message(err)}`);
}
for (const pin of ledPins) {
  try {
    new LineRequest([pin], { direction: "output" }).release();
    console.log(`[cleanup] LED GPIO ${pin} is low`);
  } catch (err) {
    console.error(`[cleanup] LED GPIO ${pin} left alone: ${message(err)}`);
  }
}
