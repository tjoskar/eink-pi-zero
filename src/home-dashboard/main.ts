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
import { createEngineHeater } from "./components/devices/engine-heater.ts";
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
let renderQueued = false;

/**
 * Render the dashboard to the panel. A call during a render queues one more
 * render afterwards (calls coalesce), so state changed mid-render still shows.
 */
async function updateDisplay(): Promise<void> {
  if (isUpdating) {
    console.log("Render in progress — queueing another");
    renderQueued = true;
    return;
  }

  isUpdating = true;
  try {
    do {
      renderQueued = false;
      try {
        const imageBuffer = await renderApp();
        await renderToDisplay(imageBuffer);
        console.log("Display updated");
      } catch (error) {
        console.error("Failed to update display", error instanceof Error ? error : undefined);
      }
    } while (renderQueued);
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

  // Declared before `mqtt` so it is disposed after it: no Confirmed state can
  // reach a disposed heater. It only publishes on a button press, and the
  // button is subscribed after `mqtt` exists.
  using heater = createEngineHeater({
    publish(payload) {
      console.log(`Button: Engine Heater Request → ${payload.toUpperCase()}`);
      mqtt.publish(ENGINE_HEATER_REQUEST_TOPIC, payload);
    },
    setLed: (state) =>
      setLed(ENGINE_HEATER_LED_PIN, state).catch((err) =>
        console.error("LED error", err instanceof Error ? err : undefined),
      ),
    show(shown) {
      const devices = devicesState.get();
      const device = devices.get(ENGINE_HEATER_TOPIC);
      if (device)
        devicesState.set(new Map(devices).set(ENGINE_HEATER_TOPIC, { ...device, ...shown }));
    },
    render: () =>
      updateDisplay().catch((err) =>
        console.error("Render error", err instanceof Error ? err : undefined),
      ),
  });

  await using mqtt = connectMqtt({
    extraTopics: [ENGINE_HEATER_TOPIC],
    onMessage(topic, value) {
      const on = value === "on";

      if (topic === ENGINE_HEATER_TOPIC) {
        console.log(`Engine Heater Confirmed state: ${on ? "ON" : "OFF"}`);
        return heater.confirmed(on);
      }

      const devices = devicesState.get();
      const device = devices.get(topic);
      if (!device) return false;
      if (device.on === on) return false;
      devicesState.set(new Map(devices).set(topic, { ...device, on }));
      console.log(`${device.label}: ${on ? "ON" : "OFF"}`);
      return true;
    },
    onUpdate: () =>
      updateDisplay().catch((err) =>
        console.error("Render error", err instanceof Error ? err : undefined),
      ),
  });

  await onButtonPress(ENGINE_HEATER_BUTTON_PIN, () => heater.press());

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
