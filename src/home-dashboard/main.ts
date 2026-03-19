/**
 * Home Dashboard — Main entry point.
 *
 * Combines MQTT device status with periodic data refreshes (weather,
 * electricity prices, dishes, garbage schedule) to drive a single
 * e-ink dashboard display.
 */
import { renderApp } from "./app.tsx";
import { connectMqtt } from "./mqtt.ts";
import { config } from "./config.ts";
import {
  devicesState,
  ENGINE_HEATER_TOPIC,
  ENGINE_HEATER_REQUEST_TOPIC,
} from "./components/devices/devices.tsx";
import {
  setTheme,
  EINK_BW_THEME,
  registerFont,
  registerIconFont,
  renderToDisplay,
  initHardware,
  onButtonPress,
  setLed,
} from "#lib";
import { once } from "node:events";

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

const ENGINE_HEATER_BUTTON_PIN = 21;
const ENGINE_HEATER_LED_PIN = 13;

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
    await renderToDisplay(imageBuffer);
    console.log("Display updated");
  } catch (error) {
    console.error("Failed to update display", error instanceof Error ? error : undefined);
  } finally {
    isUpdating = false;
  }
}

async function main(): Promise<void> {
  using _hardware = await initHardware();

  console.log("Rendering initial dashboard...");
  await updateDisplay();

  if (config.renderOnce) {
    console.log("Render-once mode — exiting.");
    return;
  }

  await using mqtt = connectMqtt({
    onMessage(topic, value) {
      const devices = devicesState.get();
      const device = devices.get(topic);
      if (!device) return;
      const on = value === "on";
      if (device.on === on) return;
      devicesState.set(new Map(devices).set(topic, { ...device, on }));
      console.log(`${device.label}: ${on ? "ON" : "OFF"}`);

      if (topic === ENGINE_HEATER_TOPIC) {
        setLed(ENGINE_HEATER_LED_PIN, on).catch((err) =>
          console.error("LED error", err instanceof Error ? err : undefined),
        );
      }
    },
    onUpdate: () =>
      updateDisplay().catch((err) =>
        console.error("Render error", err instanceof Error ? err : undefined),
      ),
  });

  await onButtonPress(ENGINE_HEATER_BUTTON_PIN, () => {
    const devices = devicesState.get();
    const device = devices.get(ENGINE_HEATER_TOPIC);
    if (!device) return;

    const newOn = !device.on;

    mqtt.publish(ENGINE_HEATER_REQUEST_TOPIC, newOn ? "on" : "off");
    devicesState.set(new Map(devices).set(ENGINE_HEATER_TOPIC, { ...device, on: newOn }));
    console.log(`Button: Engine Heater → ${newOn ? "ON" : "OFF"}`);

    setLed(ENGINE_HEATER_LED_PIN, newOn).catch((err) =>
      console.error("LED error", err instanceof Error ? err : undefined),
    );

    updateDisplay().catch((err) =>
      console.error("Render error", err instanceof Error ? err : undefined),
    );
  });

  using _refresh = setInterval(() => {
    const hour = new Date().getHours();
    if (hour < 5) {
      console.log("Skipping refresh — nighttime (00:00-05:00)");
      return;
    }
    console.log("Periodic refresh triggered");
    updateDisplay().catch((err) =>
      console.error("Periodic refresh error", err instanceof Error ? err : undefined),
    );
  }, REFRESH_INTERVAL_MS);

  await Promise.race([once(process, "SIGINT"), once(process, "SIGTERM"), once(process, "SIGHUP")]);

  console.log("Shutting down...");
}

main().catch((error) => {
  console.error("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
