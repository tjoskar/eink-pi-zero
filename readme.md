# E-Ink Dashboard Framework

A TSX framework for rendering e-ink dashboards on Raspberry Pi Zero 2 W.

Build declarative UI components with JSX, get type safety and snapshot testing, and render them to a Waveshare 7.5" e-ink display. No headless browser needed, rendering takes milliseconds.

<img src="eink-dashboard.jpg" alt="E-ink dashboard in an IKEA frame showing weather, electricity prices, weekly menu, and device status" width="600" />

## Hardware Guide

Want to build your own? You can find a pdf version of my book here: https://github.com/tjoskar/eink-pi-zero/tree/main/ebook If the book or code is useful to you, feel free to send a small donation my way, thanks: https://buymeacoffee.com/tjoskar

## Quick Start

```bash
pnpm install

# Copy environment config
cp .env.example .env

# Run hello-world in mock mode
pnpm --filter hello-world dev
```

This renders `preview.png` in `examples/hello-world/`. Open it to see the output.

## Repository layout

```
packages/eink/      the Framework, @tjoskar/eink (with its fonts/ and python/)
examples/<name>/    one package per Example
dashboard/          my own Dashboard
```

Examples and the Dashboard depend on `"@tjoskar/eink": "workspace:*"` and import only its public API, never each other.

## Examples

The repo includes several examples to get you started:

- `examples/hello-world/` — Minimal example, renders text to the display
- `examples/fancy-hello-world/` — A more fancy hello world with an image
- `examples/hello-world-with-button/` — Adds a physical button interaction
- `examples/fetch-example-openweather/` — Fetches weather data and renders it
- `examples/mqtt-device-status/` — Listens for MQTT events and updates the display
- `dashboard/` — A complete personal dashboard with weather, electricity prices, meal plans, garbage collection, and device status. See it as a reference for how to build a complete app, but you'll want to create your own to match your setup.

## Hello World

```tsx
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

## Creating Your Own App

`@tjoskar/eink` is not on npm yet. Until it is, clone the repo and copy an Example folder, e.g. `examples/hello-world/` to `examples/my-app/`, and rename it in its `package.json`. JSX works through the automatic runtime; the repo's `tsconfig.json` sets

```json
"jsx": "react-jsx",
"jsxImportSource": "@tjoskar/eink"
```

```tsx
// examples/my-app/main.tsx
import {
  Canvas,
  render,
  registerFont,
  fontPath,
  setTheme,
  EINK_BW_THEME,
  renderToDisplay,
  initHardware,
} from "@tjoskar/eink";

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
registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");

const canvas = Canvas.create(800, 480);
await render(<App />, canvas);

using _hardware = await initHardware();
await renderToDisplay(canvas.toPng());
```

Run it:

```bash
pnpm install
pnpm --filter my-app dev
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

The `setup-pi.sh` script installs system dependencies, enables SPI, sets up the systemd service, and configures log rotation.

## Prerequisites

- **Node.js** >= 24
- **pnpm**
- **Raspberry Pi Zero 2 W** with 64-bit Raspberry Pi OS
- **Waveshare 7.5" V2 e-ink display** (800x480), or another Waveshare display with minor adjustments

For local development, you only need Node.js and pnpm.

## Why TSX?

I started this project in Python (the original code is on the `v1-python` branch). Python works well for this kind of project, but I found the imperative drawing style hard to maintain:

```python
draw.text((100, 100), "Hello World", font=font, fill=0)
```

With TSX, components are declarative and composable. You don't think about absolute coordinates, you get full type safety, and you can write snapshot tests to catch visual regressions.

The tradeoff: Python has much better GPIO and SPI support on the Pi. So the architecture is a hybrid — TypeScript handles all UI rendering, while a small Python daemon handles hardware (GPIO, buttons, LED, display) via JSON IPC. See [docs/architecture.md](./docs/architecture.md) for the full design rationale.

## License

MIT
