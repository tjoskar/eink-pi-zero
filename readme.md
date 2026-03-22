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

## Why tsx and node?

That is a really good question. First off, why not python? Python has really good tools for this type of project and the thing is that I started off with python and you can see all my code that I used under the v1-python branch. It was stable and worked fine. However, I had a few issues with it (all on my side and my preferences):

I could never get the code readable. The code I ended up with was `draw.text((100, 100), "Hello World", font=font, fill=0)` compare with

```tsx
<view paddingTop={100} paddingLeft={100}>
  <text>Hello World</text>
</view>
```

More code for sure but now could I start to compose components and build complete views without needing to think about absolute coordinates and I could write the code more declarative.

Other nice gains are that I can get the code fully typed and easy testable with snapshot tests and better support from the ide.

However, there is a big downside, namely that python has much better support for SPI and GPIO than what exist in the node community. I tried to create my own but never succeeded.

If your question is more towards why not Bun or Deno, they support tsx out of the box and should be great tools. They do however fail on that they don't support ARM Cortex-A53 (pi zero).

See more here if you are interested: [architecture.md](./docs/architecture.md)

## About the examples

The `src/home-dashboard/` example is a personal dashboard — it pulls weather, electricity prices, meal plans, and garbage collection schedules from specific APIs. See it as a referecne for how to build a complete app, but you'll want to create your own to match you setup.

The simpler examples (`hello-world`, `hello-world-with-button`, `fetch-example-openweather`) are better starting points.

## Prerequisites

- **Node.js** >= 24
- **pnpm**
- **Raspberry Pi Zero 2** with 64-bit Raspberry Pi OS
- **Waveshare 7.5" V2 e-ink display** (800x480) Or some other Waveshare display.

For local development, you only need Node.js and pnpm.

## Quick start

```bash
pnpm install

# Copy environment config
cp .env.example .env

# Run hello-world in mock mode
pnpm dev src/hello-world/main.tsx
```

This renders to an image to a temp dir. Open the path that is printed out in the terminal to see the output.

## Creating your own app

I can publish this as an npm package if there is an intrest for it but right now can you just install it from github `pnpm add tjoskar/eink-pi-zero#main` or clone the repo and create a new folder under `src/`:

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
