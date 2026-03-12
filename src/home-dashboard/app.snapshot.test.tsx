import { afterAll, beforeAll, test, vi } from "vitest";
import { registerFont, registerIconFont, setTheme, EINK_BW_THEME, setRequest } from "#lib";
import type { RequestFn } from "#lib";
import {
  MOCK_OPENWEATHER_RESPONSE,
  MOCK_TIBBER_RESPONSE,
  MOCK_DISHES_RESPONSE,
} from "./__fixtures__/mock-api-responses.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSnapshot } from "../../test/snapshot-utils.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = join(__dirname, "__snapshots__");

vi.useFakeTimers();
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
      return (actual.writeFileSync as any)(path, ...args);
    },
    mkdirSync: (path: string, ...args: any[]) => {
      if (typeof path === "string" && path.includes(".cache")) return;
      return (actual.mkdirSync as any)(path, ...args);
    },
  };
});

let restoreRequest: () => void;

beforeAll(() => {
  // Set env vars so API clients don't bail before calling request()
  process.env.TIBBER_TOKEN = "test-token";
  process.env.WEATHER_API_KEY = "test-key";
  process.env.DISHES_API_URL = "https://matsedel.example.com/api";
  setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
  registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
  registerIconFont();

  const mockFetch: RequestFn = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("openweathermap.org")) {
      return Response.json(MOCK_OPENWEATHER_RESPONSE);
    }
    if (url.includes("tibber.com")) {
      return Response.json(MOCK_TIBBER_RESPONSE);
    }
    if (url.includes("matsedel")) {
      return Response.json(MOCK_DISHES_RESPONSE);
    }

    throw new Error(`Unexpected network request: ${url}`);
  };

  restoreRequest = setRequest(mockFetch);
});

afterAll(() => {
  restoreRequest();
  vi.useRealTimers();
  delete process.env.TIBBER_TOKEN;
  delete process.env.WEATHER_API_KEY;
  delete process.env.DISHES_API_URL;
});

test("home dashboard renders consistently", async () => {
  const { renderApp } = await import("./app.tsx");
  const { devicesState } = await import("./components/devices/devices.tsx");

  devicesState.set(new Map([
    ["test/washing_machine", { label: "Washing Machine", icon: "local_laundry_service", on: true }],
    ["test/dryer", { label: "Dryer", icon: "dry_cleaning", on: false }],
    ["test/engine_heater", { label: "Engine Heater", icon: "local_fire_department", on: true }],
    ["test/bike_charger", { label: "Bike Charger", icon: "electric_bike", on: false }],
  ]));

  const actualPng = await renderApp();

  assertSnapshot(actualPng, {
    snapshotsDir: SNAPSHOTS_DIR,
    name: "home-dashboard",
  });
});
