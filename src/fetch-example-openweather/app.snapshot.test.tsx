import { beforeAll, expect, test, vi } from "vitest";
import { jsx, registerFont, registerIconFont, setTheme, EINK_BW_THEME } from "#jsx/mod.js";
import { MOCK_WEATHER } from "./__fixtures__/mock-weather-data.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

vi.mock("./weather-api.ts", () => ({
  getWeatherDisplayData: vi.fn(() => Promise.resolve(MOCK_WEATHER)),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = join(__dirname, "__snapshots__");
const REF_PATH = join(SNAPSHOTS_DIR, "weather-app.png");
const ACTUAL_PATH = join(SNAPSHOTS_DIR, "weather-app.actual.png");
const DIFF_PATH = join(SNAPSHOTS_DIR, "weather-app.diff.png");
const THRESHOLD = 0.1;
const MAX_DIFF_PIXELS = 0;

beforeAll(() => {
  setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
  registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
  registerIconFont();
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
});

test("weather app renders consistently", async () => {
  const { renderApp } = await import("./app.tsx");
  const actualPng = await renderApp();

  if (process.env.UPDATE_SNAPSHOTS) {
    writeFileSync(REF_PATH, actualPng);
    return;
  }

  if (!existsSync(REF_PATH)) {
    writeFileSync(REF_PATH, actualPng);
    return;
  }

  const actual = PNG.sync.read(actualPng);
  const reference = PNG.sync.read(readFileSync(REF_PATH));
  const { width, height } = actual;
  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    reference.data, actual.data, diff.data,
    width, height,
    { threshold: THRESHOLD },
  );

  if (numDiffPixels > MAX_DIFF_PIXELS) {
    writeFileSync(ACTUAL_PATH, actualPng);
    writeFileSync(DIFF_PATH, PNG.sync.write(diff));
    throw new Error(
      `Image mismatch: ${numDiffPixels} pixels differ (max ${MAX_DIFF_PIXELS}).\n` +
      `  Reference: ${REF_PATH}\n` +
      `  Actual:    ${ACTUAL_PATH}\n` +
      `  Diff:      ${DIFF_PATH}`
    );
  }

  for (const f of [ACTUAL_PATH, DIFF_PATH]) {
    if (existsSync(f)) unlinkSync(f);
  }
});
