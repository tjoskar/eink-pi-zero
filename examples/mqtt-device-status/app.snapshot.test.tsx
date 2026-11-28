import { beforeAll, test } from "vitest";
import { registerFont, registerIconFont, setTheme, EINK_BW_THEME, fontPath } from "@tjoskar/eink";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSnapshot } from "../../test/snapshot-utils.ts";
import { renderApp, type DeviceState } from "./app.tsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = join(__dirname, "__snapshots__");

const DEVICES: DeviceState[] = [
  { label: "Washing Machine", icon: "local_laundry_service", on: true },
  { label: "Dryer", icon: "laundry", on: false },
  { label: "Engine Heater", icon: "directions_car", on: true },
  { label: "Bike Charger", icon: "electric_bike", on: false },
];

beforeAll(() => {
  setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
  registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");
  registerIconFont();
});

test("device status renders with mixed on/off states", async () => {
  const actualPng = await renderApp(DEVICES);

  assertSnapshot(actualPng, {
    snapshotsDir: SNAPSHOTS_DIR,
    name: "device-status",
  });
});

test("device status renders all devices off", async () => {
  const allOff = DEVICES.map((d) => ({ ...d, on: false }));
  const actualPng = await renderApp(allOff);

  assertSnapshot(actualPng, {
    snapshotsDir: SNAPSHOTS_DIR,
    name: "device-status-all-off",
  });
});
