/**
 * Home Dashboard — Root App component.
 *
 * Composes all sections into a 3-column layout for the 800x480 e-ink display:
 *   Left   — device status icons (narrow column)
 *   Center — weather (current + forecast) and dishes
 *   Right  — electricity (price chart + consumption), garbage, last-update
 */

import { jsx, createCanvas, render } from "#jsx/mod.js";
import { DeviceColumn, type DeviceState } from "./components/devices.tsx";
import { WeatherSection } from "./components/weather.tsx";
import { ElectricitySection } from "./components/electricity.tsx";
import { DishesSection } from "./components/dishes.tsx";
import { GarbageSection } from "./components/garbage.tsx";
import { LastUpdate } from "./components/last-update.tsx";
import {
  getWeatherDisplayData,
  type WeatherDisplayData,
} from "../fetch-example-openweather/weather-api.ts";
import {
  getElectricityData,
  type ElectricityData,
} from "./data/electricity-api.ts";
import { getDishes } from "./data/dishes-api.ts";
import { getGarbageData, type GarbageData } from "./data/garbage-data.ts";

// ---------------------------------------------------------------------------
// Data interface
// ---------------------------------------------------------------------------

interface DashboardData {
  devices: DeviceState[];
  weather: WeatherDisplayData | null;
  electricity: ElectricityData | null;
  dishes: string[];
  garbage: GarbageData;
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function App({ data }: { data: DashboardData }) {
  return (
    <view
      width={800}
      height={480}
      padding={16}
      direction="row"
      gap={0}
      background="white"
    >
      {/* Left column — device status icons */}
      <view width={72} direction="column">
        <DeviceColumn devices={data.devices} />
      </view>

      {/* Center column — weather + dishes */}
      <view flex={1} direction="column" gap={12}>
        <WeatherSection data={data.weather} />
        <DishesSection dishes={data.dishes} />
      </view>

      {/* Right column — electricity, garbage, last-update */}
      <view width={260} direction="column" gap={12}>
        <ElectricitySection data={data.electricity} />
        <GarbageSection data={data.garbage} />
        <view flex={1} />
        <LastUpdate />
      </view>
    </view>
  );
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all dashboard data in parallel.
 *
 * Each remote fetch is wrapped in try/catch so a single failure doesn't
 * bring down the whole dashboard — failed sections render fallback UIs.
 */
export async function fetchAllData(
  devices: DeviceState[],
): Promise<DashboardData> {
  const [weather, electricity, dishes] = await Promise.all([
    getWeatherDisplayData().catch((err) => {
      console.error("Weather fetch failed:", err);
      return null;
    }),
    getElectricityData().catch((err) => {
      console.error("Electricity fetch failed:", err);
      return null;
    }),
    getDishes().catch((err) => {
      console.error("Dishes fetch failed:", err);
      return [] as string[];
    }),
  ]);

  // Garbage data is synchronous (static dates)
  let garbage: GarbageData;
  try {
    garbage = getGarbageData();
  } catch (err) {
    console.error("Garbage data failed:", err);
    garbage = { events: [], reminder: null };
  }

  return {
    devices,
    weather,
    electricity,
    dishes,
    garbage,
  };
}

// ---------------------------------------------------------------------------
// Render entry point
// ---------------------------------------------------------------------------

/**
 * Fetch all data and render the full dashboard to a PNG buffer.
 */
export async function renderApp(devices: DeviceState[]): Promise<Buffer> {
  const data = await fetchAllData(devices);
  const canvas = createCanvas(800, 480);
  await render(<App data={data} />, canvas);
  return canvas.toPng();
}
