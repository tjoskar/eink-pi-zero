/**
 * Fetch Example — OpenWeatherMap
 *
 * Fetches weather data from OpenWeatherMap 3.0 API and renders
 * current conditions + 5-day forecast to the e-ink display.
 *
 * Required env vars:
 *   WEATHER_API_KEY — your OpenWeatherMap API key
 *
 * Optional env vars:
 *   WEATHER_LAT, WEATHER_LON — coordinates (default: Stockholm)
 *   WEATHER_UNITS — metric | imperial | standard (default: metric)
 *   WEATHER_LANG — language code (default: en)
 *   CACHE_DURATION — cache TTL in seconds (default: 3600)
 *
 * Run in dev/mock mode:
 *   MOCK=1 WEATHER_API_KEY=xxx tsx src/fetch-example-openweather/main.tsx
 */

import { renderApp } from "./app.tsx";
import { renderToDisplay, registerFont, registerIconFont, setTheme, EINK_BW_THEME } from "#lib";

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

async function main(): Promise<void> {
  console.log("Fetching weather data and rendering...");
  const imageBuffer = await renderApp();

  console.log("Sending to display...");
  await renderToDisplay(imageBuffer);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
