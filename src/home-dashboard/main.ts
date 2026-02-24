/**
 * Home Dashboard — Main entry point.
 *
 * Combines MQTT device status with periodic data refreshes (weather,
 * electricity prices, dishes, garbage schedule) to drive a single
 * e-ink dashboard display.
 */
import mqtt from "mqtt";
import { renderApp } from "./app.tsx";
import { DEVICES_CONFIG } from "../mqtt-device-status/devices.ts";
import type { DeviceState } from "./components/devices.tsx";
import {
  setTheme,
  EINK_BW_THEME,
  registerFont,
  registerIconFont,
  renderToDisplay,
  setupGlobalErrorHandler,
  logInfo,
  logError,
  initHardware,
} from "#lib";
import { once } from "node:events";

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = Number(process.env.MQTT_PORT);
const MQTT_USER = process.env.MQTT_USERNAME;
const MQTT_PASS = process.env.MQTT_PASSWORD;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX;
if (!MQTT_USER || !MQTT_PASS || !MQTT_TOPIC_PREFIX || !MQTT_HOST || !MQTT_PORT) {
  throw new Error("Missing required MQTT environment variables");
}

/** Debounce delay in ms to batch rapid MQTT messages before rendering */
const RENDER_DEBOUNCE_MS = 3000;

/** Periodic refresh interval for weather/electricity/dishes data (1 hour) */
const REFRESH_INTERVAL_MS = 3_600_000;

const devices: DeviceState[] = DEVICES_CONFIG.map((d) => ({
  label: d.label,
  icon: d.icon,
  on: false,
}));

let isUpdating = false;

/** Disposable wrapper around a debounced update timer. */
function createDebouncedUpdater(): {
  schedule: () => void;
  [Symbol.dispose]: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      timer?.[Symbol.dispose]();
      timer = setTimeout(() => {
        timer = null;
        updateDisplay().catch((err) =>
          logError("Render error", err instanceof Error ? err : undefined),
        );
      }, RENDER_DEBOUNCE_MS);
    },
    [Symbol.dispose]() {
      timer?.[Symbol.dispose]();
      timer = null;
    },
  };
}

/** Disposable wrapper around an MQTT client with async disconnect. */
function connectMqtt(
  scheduleUpdate: () => void,
): { client: mqtt.MqttClient } & AsyncDisposable {
  const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
  logInfo(`Connecting to MQTT broker at ${url}...`);

  const client = mqtt.connect(url, {
    username: MQTT_USER,
    password: MQTT_PASS,
  });

  client.on("connect", () => {
    const topic = `${MQTT_TOPIC_PREFIX}/#`;
    logInfo(`Connected to MQTT broker. Subscribing to ${topic}`);
    client.subscribe(topic);
  });

  client.on("message", (_topic: string, payload: Buffer) => {
    const value = payload.toString().toLowerCase();
    const isOn = value === "on";
    const isOff = value === "off";

    if (!isOn && !isOff) return;

    const configIndex = DEVICES_CONFIG.findIndex((d) => d.topic === _topic);
    if (configIndex === -1) return;

    const device = devices[configIndex];
    const newState = isOn;

    if (device.on === newState) return;

    device.on = newState;
    logInfo(`${device.label}: ${newState ? "ON" : "OFF"}`);
    scheduleUpdate();
  });

  client.on("error", (err) => {
    logError("MQTT error", err);
  });

  client.on("offline", () => {
    logInfo("MQTT client offline");
  });

  client.on("reconnect", () => {
    logInfo("MQTT reconnecting...");
  });

  return {
    client,
    async [Symbol.asyncDispose]() {
      logInfo("Disconnecting MQTT...");
      await client.endAsync();
    },
  };
}

async function updateDisplay(): Promise<void> {
  if (isUpdating) {
    logInfo("Skipping update — render already in progress");
    return;
  }

  isUpdating = true;
  try {
    const imageBuffer = await renderApp(devices);
    await renderToDisplay(imageBuffer, { fast: true });
    logInfo("Display updated");
  } catch (error) {
    logError(
      "Failed to update display",
      error instanceof Error ? error : undefined,
    );
  } finally {
    isUpdating = false;
  }
}

async function main(): Promise<void> {
  // Resources are disposed in reverse order when main() returns or throws
  using _hardware = await initHardware();

  logInfo("Rendering initial dashboard...");
  await updateDisplay();

  using debouncer = createDebouncedUpdater();

  await using _mqtt = connectMqtt(debouncer.schedule);

  using _refresh = setInterval(() => {
    logInfo("Periodic refresh triggered");
    updateDisplay().catch((err) =>
      logError("Periodic refresh error", err instanceof Error ? err : undefined),
    );
  }, REFRESH_INTERVAL_MS);

  await Promise.race([
    once(process, "SIGINT"),
    once(process, "SIGTERM"),
    once(process, "SIGHUP"),
  ]);

  logInfo("Shutting down...");
}

main().catch((error) => {
  logError("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
