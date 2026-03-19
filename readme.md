# Eink TSX

An TSX e-ink display framework.

Built for Raspberry Pi Zero 2 that renders JSX/TSX components to a Waveshare 7.5" V2 display (800x480). But could easily support other displays.

## Example

```tsx
import { jsx } from "#lib";

export function App() {
  return (
    <view width={800} height={480} padding={40} direction="column" gap={20} background="white">
      <view direction="column" gap={8}>
        <text size={48} weight="bold" color="black">
          Hello World!
        </text>
      </view>
    </view>
  );
}
```

## About the examples

The `src/home-dashboard/` example is a personal dashboard — it pulls weather, electricity prices, meal plans, and garbage collection schedules from specific APIs. It's here as a reference for how to build a complete app, but you'll want to create your own.

The simpler examples (`hello-world`, `hello-world-with-button`, `fetch-example-openweather`) are better starting points.

## Prerequisites

- **Node.js** >= 24 (for `--env-file` flag)
- **pnpm**
- **Raspberry Pi Zero 2** with 64-bit Raspberry Pi OS (for deployment)
- **Waveshare 7.5" V2 e-ink display** (800x480)

For local development, you only need Node.js and pnpm.

## Quick start

```bash
pnpm install

# Copy environment config
cp .env.example .env

# Run hello-world in mock mode
pnpm dev src/hello-world/main.tsx
```

This renders to `/tmp/eink-panel/latest.png`. Open it to see the output.

## Creating your own app

At this point can you just create a new folder under `src/`:

```tsx
// src/my-app/main.tsx
import {
  jsx,
  Canvas,
  render,
  registerFont,
  setTheme,
  EINK_BW_THEME,
  renderToDisplay,
  initHardware,
} from "#lib";

function App() {
  return (
    <view width={800} height={480} padding={40} background="white">
      <text size={48} weight="bold">
        Hello from e-ink!
      </text>
    </view>
  );
}

setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");

const canvas = Canvas.create(800, 480);
await render(<App />, canvas);

using _hardware = await initHardware();
await renderToDisplay(canvas.toPng());
```

Run it:

```bash
pnpm dev src/my-app/main.tsx
```

## Deploy to Raspberry Pi

```bash
# Deploy to Pi with rsync
pnpm deploy pi@raspberrypi.local

# On the Pi (first time only):
sudo ./scripts/setup-pi.sh

# Start the service:
sudo systemctl start eink-panel
sudo systemctl enable eink-panel
```

The `setup-pi.sh` script installs system dependencies, enables SPI, sets up the systemd service, and configures log rotation. It auto-detects the current user.
