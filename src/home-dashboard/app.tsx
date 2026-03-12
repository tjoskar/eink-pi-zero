/**
 * Home Dashboard — Root App component.
 *
 * Composes all sections into a 3-column layout for the 800x480 e-ink display:
 *   Left   — device status icons (narrow column)
 *   Center — weather (current + forecast) and dishes
 *   Right  — electricity (price chart + consumption), garbage, last-update
 *
 * Each section fetches its own data (async components run in parallel).
 */

import { jsx, Canvas, render } from "#lib";
import { DeviceColumn } from "./components/devices/devices.tsx";
import { WeatherSection } from "./components/weather/weather.tsx";
import { ElectricitySection } from "./components/electricity/electricity.tsx";
import { DishesSection } from "./components/dishes/dishes.tsx";
import { GarbageSection } from "./components/garbage/garbage.tsx";
import { LastUpdate } from "./components/last-update.tsx";

function App() {
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
        <DeviceColumn />
      </view>

      {/* Center column — weather + dishes */}
      <view flex={1} direction="column" gap={12}>
        <WeatherSection />
        <DishesSection />
      </view>

      {/* Right column — electricity, garbage, last-update */}
      <view width={260} direction="column" gap={12}>
        <ElectricitySection />
        <GarbageSection />
        <view flex={1} />
        <LastUpdate />
      </view>
    </view>
  );
}

/**
 * Render the full dashboard to a PNG buffer.
 */
export async function renderApp(): Promise<Buffer> {
  const canvas = new Canvas(800, 480);
  await render(<App />, canvas);
  return canvas.toPng();
}
