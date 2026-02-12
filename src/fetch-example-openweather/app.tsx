/**
 * Weather App — JSX component for e-ink display.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │ [icon]  15°   💨 5 m/s              │
 *   │                🌅 06:18 / 21:05     │
 *   │                💧 0.5 mm            │
 *   │                ☀️  2 (3, 10 - 14)   │
 *   │                                     │
 *   │  Mon    Tue    Wed    Thu    Fri     │
 *   │  [ic]   [ic]   [ic]   [ic]   [ic]   │
 *   │ 10°/20 11°/19 8°/15  9°/17  12°/22 │
 *   └─────────────────────────────────────┘
 */

import { jsx, Icon, createCanvas, render } from "#jsx/mod.js";
import {
  getWeatherDisplayData,
  type WeatherDisplayData,
  type ForecastDay,
} from "./weather-api.ts";

// ---------------------------------------------------------------------------
// Detail row icons (Material Icon names)
// ---------------------------------------------------------------------------

const DETAIL_ICONS = {
  wind: "wind_power",
  sun: "wb_twilight",
  rain: "water_drop",
  uv: "wb_iridescent",
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ icon, text }: { icon: string; text: string }) {
  return (
    <view direction="row" gap={8} align="center" height={36}>
      <Icon name={icon} size={36} color="black" />
      <text size={16} color="black">
        {text}
      </text>
    </view>
  );
}

function CurrentWeather({ data }: { data: WeatherDisplayData["current"] }) {
  return (
    <view direction="row" gap={32} align="center">
      {/* Big icon + temp */}
      <view direction="row" gap={16} align="center">
        <Icon name={data.icon} size={108} color="black" />
        <view width={80}>
          <text size={64} color="black">
            {data.temp}
          </text>
        </view>
      </view>

      {/* Detail column */}
      <view direction="column" gap={0}>
        <DetailRow icon={DETAIL_ICONS.wind} text={data.windSpeed} />
        <DetailRow icon={DETAIL_ICONS.sun} text={data.sunTimes} />
        <DetailRow icon={DETAIL_ICONS.rain} text={data.rain} />
        <DetailRow icon={DETAIL_ICONS.uv} text={data.uvInfo} />
      </view>
    </view>
  );
}

function ForecastItem({ item }: { item: ForecastDay }) {
  return (
    <view direction="column" gap={8} width={56}>
      <text size={16} color="black" textAlign="center">
        {item.day}
      </text>
      <Icon name={item.icon} size={36} color="black" alignSelf="center" />
      <text size={16} color="black" textAlign="center">
        {item.temp}
      </text>
    </view>
  );
}

function Forecast({ days }: { days: ForecastDay[] }) {
  return (
    <view direction="row" gap={16}>
      {days.map((day) => (
        <ForecastItem item={day} />
      ))}
    </view>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function App({ data }: { data: WeatherDisplayData }) {
  return (
    <view
      width={800}
      height={480}
      padding={16}
      direction="column"
      gap={12}
      background="white"
    >
      <CurrentWeather data={data.current} />
      <Forecast days={data.forecast} />
    </view>
  );
}

// ---------------------------------------------------------------------------
// Render entry point
// ---------------------------------------------------------------------------

export async function renderApp(): Promise<Buffer> {
  const data = await getWeatherDisplayData();
  const canvas = createCanvas(800, 480);
  await render(<App data={data} />, canvas);
  return canvas.toPng();
}
