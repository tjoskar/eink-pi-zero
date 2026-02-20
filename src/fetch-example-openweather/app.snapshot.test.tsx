import { beforeAll, test, vi } from "vitest";
import { registerFont, registerIconFont, setTheme, EINK_BW_THEME } from "#lib";
import { MOCK_WEATHER } from "./__fixtures__/mock-weather-data.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSnapshot } from "../../test/snapshot-utils.ts";

vi.mock("./weather-api.ts", () => ({
  getWeatherDisplayData: vi.fn(() => Promise.resolve(MOCK_WEATHER)),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = join(__dirname, "__snapshots__");

beforeAll(() => {
  setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
  registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
  registerIconFont();
});

test("weather app renders consistently", async () => {
  const { renderApp } = await import("./app.tsx");
  const actualPng = await renderApp();

  assertSnapshot(actualPng, {
    snapshotsDir: SNAPSHOTS_DIR,
    name: "weather-app",
  });
});
