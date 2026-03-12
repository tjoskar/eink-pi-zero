/**
 * Home Dashboard — Main entry point.
 *
 * Combines MQTT device status with periodic data refreshes (weather,
 * electricity prices, dishes, garbage schedule) to drive a single
 * e-ink dashboard display.
 */
import { renderApp } from "./app.tsx";
import { connectMqtt, validateMqttEnv } from "./mqtt.ts";
import { devicesState } from "./components/devices/devices.tsx";
import {
  setTheme,
  EINK_BW_THEME,
  registerFont,
  registerIconFont,
  renderToDisplay,
  initHardware,
} from "#lib";
import { once } from "node:events";

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

const RENDER_ONCE = process.env.RENDER_ONCE === "1";

/** Periodic refresh interval for weather/electricity/dishes data (1 hour) */
const REFRESH_INTERVAL_MS = 3_600_000;

let isUpdating = false;

async function updateDisplay(): Promise<void> {
  if (isUpdating) {
    console.log("Skipping update — render already in progress");
    return;
  }

  isUpdating = true;
  try {
    const imageBuffer = await renderApp();
    await renderToDisplay(imageBuffer, { fast: true });
    console.log("Display updated");
  } catch (error) {
    console.error(
      "Failed to update display",
      error instanceof Error ? error : undefined,
    );
  } finally {
    isUpdating = false;
  }
}

async function main(): Promise<void> {
  using _hardware = await initHardware();

  console.log("Rendering initial dashboard...");
  await updateDisplay();

  if (RENDER_ONCE) {
    console.log("Render-once mode — exiting.");
    return;
  }

  validateMqttEnv();

  await using _mqtt = connectMqtt({
    onMessage(topic, value) {
      const devices = devicesState.get();
      const device = devices.get(topic);
      if (!device) return;
      const on = value === "on";
      if (device.on === on) return;
      devicesState.set(new Map(devices).set(topic, { ...device, on }));
      console.log(`${device.label}: ${on ? "ON" : "OFF"}`);
    },
    onUpdate: () =>
      updateDisplay().catch((err) =>
        console.error("Render error", err instanceof Error ? err : undefined),
      ),
  });

  using _refresh = setInterval(() => {
    console.log("Periodic refresh triggered");
    updateDisplay().catch((err) =>
      console.error("Periodic refresh error", err instanceof Error ? err : undefined),
    );
  }, REFRESH_INTERVAL_MS);

  await Promise.race([
    once(process, "SIGINT"),
    once(process, "SIGTERM"),
    once(process, "SIGHUP"),
  ]);

  console.log("Shutting down...");
}

main().catch((error) => {
  console.error("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
