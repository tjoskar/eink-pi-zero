import { afterAll, beforeAll, test, vi } from "vitest";
import {
  registerFont,
  registerIconFont,
  setTheme,
  EINK_BW_THEME,
  setRequest,
  fontPath,
} from "@tjoskar/eink";
import type { RequestFn } from "@tjoskar/eink";
import {
  MOCK_SMHI_RESPONSE,
  MOCK_OPEN_METEO_UV_RESPONSE,
  MOCK_TIBBER_RESPONSE,
  MOCK_DISHES_RESPONSE,
} from "./__fixtures__/mock-api-responses.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSnapshot } from "../test/snapshot-utils.ts";
import { overrideConfig } from "./config.ts";
import { renderApp } from "./app.tsx";
import { setConfirmedState, setEndTime } from "./components/devices/devices.tsx";
import { OUTDOOR_TEMPERATURE_TOPIC, setReading } from "./readings.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = join(__dirname, "__snapshots__");

vi.useFakeTimers();
vi.spyOn(console, "log").mockImplementation(() => {});
vi.setSystemTime(new Date(2026, 2, 7, 14, 30, 0));

// Mock node:fs selectively — block cache files but allow font loading
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: (path: string) => {
      if (typeof path === "string" && path.includes(".cache/")) return false;
      return actual.existsSync(path);
    },
    writeFileSync: (path: string, ...args: any[]) => {
      if (typeof path === "string" && path.includes(".cache/")) return;
      (actual.writeFileSync as any)(path, ...args);
    },
    mkdirSync: (path: string, ...args: any[]) => {
      if (typeof path === "string" && path.includes(".cache")) return;
      (actual.mkdirSync as any)(path, ...args);
    },
  };
});

let restoreRequest: () => void;

const mockFetch: RequestFn = async (input, _init) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("smhi.se")) {
    return Response.json(MOCK_SMHI_RESPONSE);
  }
  if (url.includes("open-meteo.com")) {
    return Response.json(MOCK_OPEN_METEO_UV_RESPONSE);
  }
  if (url.includes("tibber.com")) {
    return Response.json(MOCK_TIBBER_RESPONSE);
  }
  if (url.includes("matsedel")) {
    return Response.json(MOCK_DISHES_RESPONSE);
  }

  throw new Error(`Unexpected network request: ${url}`);
};

beforeAll(() => {
  overrideConfig({
    tibberToken: "test-token",
    weatherLat: "59.3293",
    weatherLon: "18.0686",
    dishesApiUrl: "https://matsedel.example.com/api",
  });
  setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
  registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");
  registerIconFont();

  restoreRequest = setRequest(mockFetch);
});

afterAll(() => {
  restoreRequest();
  vi.useRealTimers();
});

test("home dashboard renders consistently", async () => {
  // Every End time slot in use: the column at its tallest.
  for (const device of ["washing_machine", "dryer", "dishwasher", "printer", "engine_heater"]) {
    setConfirmedState(`controlpanel/statechange/${device}`, true);
  }
  setEndTime("controlpanel/end_time/dryer", "2026-03-07T14:50:00Z");
  setEndTime("controlpanel/end_time/dishwasher", "2026-03-07T15:05:00Z");
  setEndTime("controlpanel/end_time/printer", "2026-03-07T17:20:00Z");

  setReading(OUTDOOR_TEMPERATURE_TOPIC, "4.2");

  const actualPng = await renderApp();

  assertSnapshot(actualPng, {
    snapshotsDir: SNAPSHOTS_DIR,
    name: "home-dashboard",
  });
});
