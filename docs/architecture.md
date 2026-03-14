# E-Ink Pi Zero - Architecture & Design Decisions

> This document summarizes the design decisions made during development.
> It's intended for future AI agents and developers working on this project.

## Project Overview

This project renders a JSX-based UI to a **Waveshare 7.5" V2 e-ink display** (800x480 pixels) connected to a **Raspberry Pi Zero 2** running **64-bit Raspberry Pi OS**.

### Key Technologies

| Component         | Technology                 | Reason                                   |
| ----------------- | -------------------------- | ---------------------------------------- |
| UI Logic          | TypeScript + JSX           | Type safety, declarative UI              |
| Canvas            | @napi-rs/canvas            | Prebuilt binaries, no native compilation |
| Display Rendering | Python (gpiozero + spidev) | Reliable GPIO/SPI on 64-bit OS           |
| Button/LED        | gpiomon/gpioset CLI        | Works with libgpiod v2.x                 |
| Events            | MQTT                       | External integration, error reporting    |
| Bundler           | esbuild                    | Fast, simple, ESM output                 |

---

## Critical Design Decision: Hybrid TypeScript + Python

### The Problem

We initially attempted a pure TypeScript/Node.js solution for both UI generation AND hardware control. This failed due to **fundamental GPIO issues on 64-bit Raspberry Pi OS**.

#### Failed Approaches

1. **`onoff` npm package**
   - Uses deprecated `/sys/class/gpio` (sysfs) interface
   - Doesn't work on modern 64-bit Pi OS
   - Error: "ENOENT: no such file or directory, open '/sys/class/gpio/export'"

2. **Direct libgpiod via shell commands (`gpioset`/`gpioget`)**
   - libgpiod v2.x on 64-bit OS has different syntax than v1.x
   - v2.x requires `-c gpiochip0` flag
   - **Critical issue**: `gpioset` in v2.x holds the GPIO line until the process exits
   - This breaks the display driver which needs to toggle DC pin between command/data

3. **Daemonized GPIO processes**
   - Tried spawning background processes with `-z` (daemonize) flag
   - Killing and restarting processes causes timing issues
   - E-ink display requires precise DC + SPI synchronization

#### Why It's Fundamentally Broken

The Waveshare e-ink driver requires:

```
1. Set DC pin LOW (command mode)
2. Send command byte via SPI
3. Set DC pin HIGH (data mode)
4. Send data bytes via SPI
```

This must happen **atomically** with microsecond timing. When GPIO is managed by a separate process that must be killed/restarted between each state change, the timing becomes unreliable.

### The Solution: Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TypeScript (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │   JSX    │  │  MQTT    │  │  Button  │  │   Timers     │ │
│  │  Canvas  │  │  Events  │  │ (gpiomon)│  │   Logic      │ │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────────┘ │
│       │                                                      │
│       ▼ PNG file                                             │
│  ┌──────────────────────────────────────────────────────────┤
│  │  spawn("python3", ["render.py", "image.png", "--fast"])  │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Python                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  render.py - "Fire and forget" display renderer       │   │
│  │  • Loads PNG image                                    │   │
│  │  • Initializes display via gpiozero/spidev            │   │
│  │  • Sends image to display                             │   │
│  │  • Puts display to sleep                              │   │
│  │  • Exits                                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: Python's `gpiozero` library handles GPIO correctly on 64-bit OS because it manages the GPIO lifecycle within a single process, maintaining atomic control over the pins.

---

## File Structure

```
eink-pi-zero/
├── lib/                        # TypeScript utilities
│   ├── env.ts                  # IS_PI, IS_MOCK detection
│   ├── display.ts              # Spawns Python render.py
│   ├── gpio.ts                 # Button (gpiomon) + LED (gpioset)
│   └── error-handler.ts        # File logging + MQTT error publishing
│
├── jsx/lib/                    # JSX rendering library
│   ├── mod.ts                  # Main exports
│   ├── runtime/                # JSX factory, render function
│   ├── canvas/                 # @napi-rs/canvas abstraction
│   ├── layout/                 # Simple flexbox-like layout engine
│   ├── components/             # Icon component
│   └── fonts/                  # Font registration
│
├── python/                     # Hardware interaction (Python)
│   ├── render.py               # CLI: python3 render.py image.png [--fast]
│   ├── epd7in5_v2.py           # Waveshare 7.5" V2 driver
│   └── epdconfig.py            # GPIO/SPI configuration (gpiozero)
│
├── src/
│   └── hello-world/            # Example application
│       ├── main.ts             # Entry point with MQTT, button handling
│       └── app.tsx             # JSX UI component
│
├── scripts/
│   ├── deploy.sh               # rsync to Pi
│   ├── setup-pi.sh             # Install deps, enable SPI, systemd
│   ├── eink-panel.service      # Systemd unit file
│   └── eink-panel.logrotate    # Log rotation config
│
├── dist/                       # Built output (esbuild)
├── fonts/                      # Font files (Material Icons, etc.)
├── driver/                     # Original Waveshare drivers (reference)
└── package.json
```

---

## GPIO Configuration

### Button and LED (configurable in `lib/gpio.ts`)

| Function | GPIO Pin | Notes                              |
| -------- | -------- | ---------------------------------- |
| Button   | 21       | Active low, use gpiomon for events |
| LED      | 22       | Active high                        |

### E-Ink Display (fixed in `python/epdconfig.py`)

| Function | GPIO Pin |
| -------- | -------- |
| RST      | 17       |
| DC       | 25       |
| CS       | 8        |
| BUSY     | 24       |
| PWR      | 18       |

---

## Mock Mode

For development on macOS (or any non-Pi system):

```bash
pnpm dev  # Automatically sets MOCK=1
```

In mock mode:

- Press `'b'` key to simulate button press
- Images saved to `/tmp/eink-panel/latest.png`
- No GPIO/SPI calls made
- MQTT connection optional (will continue without it)

---

## Python Dependencies

**Important**: Use `apt` packages, NOT pip!

```bash
sudo apt install python3-pil python3-spidev python3-gpiozero gpiod
```

Using apt ensures compatibility with the system's libgpiod version.

---

## Rendering Flow

1. **TypeScript** generates UI using JSX syntax
2. **JSX library** creates a canvas and runs layout algorithm
3. **Canvas** exports to PNG buffer
4. **display.ts** saves PNG to `/tmp/eink-panel/frame-N.png`
5. **display.ts** spawns `python3 render.py /tmp/eink-panel/frame-N.png --fast`
6. **Python** loads image, initializes display, sends pixels, sleeps display
7. **Python** exits (60 second timeout in TypeScript)

---

## Error Handling

Errors are:

1. Logged to console
2. Written to `~/control-panel/logs/eink-panel.log`
3. Published to MQTT topic `control-panel/error` (if connected)

The error handler is set up in `main.ts` via `setupGlobalErrorHandler()`.

---

## Key Commands

| Command                     | Description                  |
| --------------------------- | ---------------------------- |
| `pnpm dev`                  | Run in mock mode (macOS dev) |
| `pnpm build`                | Bundle with esbuild          |
| `pnpm start`                | Run built bundle             |
| `pnpm typecheck`            | TypeScript type checking     |
| `pnpm deploy user@pi.local` | Deploy to Pi via rsync       |

---

## Subpath Imports

The project uses Node.js subpath imports (defined in `package.json`):

```typescript
import { renderToDisplay } from "#lib/display.js";
import { jsx, render, createCanvas } from "#jsx/mod.js";
```

These are mapped in `tsconfig.json` paths for TypeScript.

---

## Future Considerations

1. **Partial refresh**: The display supports partial updates (`display_Partial`), which could be used for faster updates of specific regions.

2. **4-level grayscale**: The display supports 4 gray levels (white, light gray, dark gray, black) via `init_4Gray()` and `display_4Gray()`.

3. **Multiple examples**: The `src/` directory is designed to hold multiple example apps. Create new folders like `src/dashboard/`, `src/weather/`, etc.

4. **Font loading**: Register custom fonts before rendering:
   ```typescript
   import { registerFont } from "#jsx/mod.js";
   registerFont("./fonts/roboto.ttf", "Roboto");
   ```

---

## Historical Context

This project evolved through several iterations:

1. **Pure Python** (original Waveshare examples) - worked but limited UI capabilities
2. **Pure TypeScript with node-canvas** - canvas worked, GPIO failed
3. **TypeScript with libgpiod CLI** - discovered v2.x timing issues
4. **Hybrid TypeScript + Python** - current working solution

The hybrid approach was chosen because:

- TypeScript excels at logic, UI, and async operations
- Python has reliable, well-tested GPIO libraries
- The display only needs to be updated every few seconds/minutes
- Spawning a Python process is acceptable overhead for e-ink refresh (2-15 seconds anyway)

---

Remember that all files should be in snake_case, inclusive component files.

---

_Last updated: January 2026_
