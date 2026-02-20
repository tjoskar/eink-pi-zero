/**
 * Home Dashboard — Main entry point.
 *
 * Combines MQTT device status with periodic data refreshes (weather,
 * electricity prices, dishes, garbage schedule) to drive a single
 * e-ink dashboard display.
 *
 * Required env vars:
 *   MQTT_HOST          — broker hostname
 *   MQTT_PORT          — broker port (default: 1883)
 *   MQTT_USER          — broker username
 *   MQTT_PASS          — broker password
 *   MQTT_TOPIC_PREFIX  — topic prefix to subscribe to (default: statechange)
 *   WEATHER_API_KEY    — OpenWeatherMap API key
 *   TIBBER_TOKEN       — Tibber API token
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
  renderToDisplay, cleanup,
  IS_MOCK,
  setupGlobalErrorHandler,
  logInfo,
  logError,
} from "#lib";

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

const MQTT_HOST = process.env.MQTT_HOST ?? "localhost";
const MQTT_PORT = parseInt(process.env.MQTT_PORT ?? "1883", 10);
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? "statechange";

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
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

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

/**
 * Schedule a debounced display update. Resets the timer on each call
 * so rapid messages (e.g. retained messages on connect) are batched.
 */
function scheduleUpdate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    updateDisplay().catch((err) =>
      logError("Render error", err instanceof Error ? err : undefined),
    );
  }, RENDER_DEBOUNCE_MS);
}

function connectMqtt(): mqtt.MqttClient {
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

    // Find matching device by topic
    const configIndex = DEVICES_CONFIG.findIndex((d) => d.topic === _topic);
    if (configIndex === -1) return;

    const device = devices[configIndex];
    const newState = isOn;

    if (device.on === newState) return; // no change

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

  return client;
}

async function main(): Promise<void> {
  setupGlobalErrorHandler();

  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551       Home Dashboard Display          \u2551");
  console.log("\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d");
  console.log();

  // Initial render with all data
  logInfo("Rendering initial dashboard...");
  await updateDisplay();

  // Connect MQTT for device status updates
  const client = connectMqtt();

  // Periodic refresh for weather/electricity/dishes data
  refreshTimer = setInterval(() => {
    logInfo("Periodic refresh triggered");
    updateDisplay().catch((err) =>
      logError("Periodic refresh error", err instanceof Error ? err : undefined),
    );
  }, REFRESH_INTERVAL_MS);

  if (IS_MOCK) {
    console.log();
    console.log("Running in mock mode:");
    console.log("  \u2022 Images saved to ./preview.png");
    console.log("  \u2022 Press Ctrl+C to exit");
    console.log();
  }
}

function shutdown(): void {
  logInfo("Shutting down...");
  if (debounceTimer) clearTimeout(debounceTimer);
  if (refreshTimer) clearInterval(refreshTimer);
  cleanup();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  logError("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
