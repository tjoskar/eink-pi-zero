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

The first implementation was **pure Python with Pillow** — the standard approach from Waveshare's own examples. This worked for driving the display, but building anything beyond a trivial UI in Python/Pillow quickly becomes painful: no type safety, no component model, and no practical way to test visual output.

By moving UI logic to **TypeScript with JSX/TSX**, we get:

- **Full type safety** — component props, state, and layout are all statically typed
- **Snapshot testing** — render output can be captured as PNG snapshots and compared in CI, catching visual regressions automatically
- **Declarative components** — the same mental model as React, with reusable, composable UI pieces

However, a pure TypeScript/Node.js solution for both UI generation AND hardware control failed due to **fundamental GPIO issues on 64-bit Raspberry Pi OS**.

#### Failed Node.js GPIO Approaches

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

#### Why Node.js GPIO Is Fundamentally Broken

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
│       ▼ PNG buffer (stdin)                                   │
│  ┌──────────────────────────────────────────────────────────┤
│  │  spawn("python3", ["hardware_daemon.py"])                 │
│  │  Communicates via JSON messages over stdin/stdout         │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Python                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  hardware_daemon.py - Long-running display daemon     │   │
│  │  • Listens for JSON commands on stdin                 │   │
│  │  • Initializes display via gpiozero/spidev            │   │
│  │  • Sends images to display (fast/full refresh)        │   │
│  │  • Reports status back via stdout JSON                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: Python's `gpiozero` library handles GPIO correctly on 64-bit OS because it manages the GPIO lifecycle within a single process, maintaining atomic control over the pins.

---

## File Structure

```
eink-pi-zero/
├── lib/                        # Core framework
│   └── mod.ts                  # Public API — re-exports everything
├── src/                        # Example applications
├── python/                     # Hardware interaction (Python)
├── scripts/
├── test/
├── fonts/                      # Font files (Noto Sans, Material Icons, etc.)
├── dist/                       # Built output (esbuild)
└── package.json
```

---

## GPIO Configuration

### Button and LED (configurable in `lib/hardware.ts`)

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
pnpm dev src/hello-world/main.tsx  # Automatically sets MOCK=1
```

In mock mode:

- Press `'b'` key to simulate button press
- Images saved to `/tmp/eink-panel/latest.png`
- No GPIO/SPI calls made
- MQTT connection optional (will continue without it)

---

## Python Dependencies

**Important**: Use `apt` packages, NOT pip! Using apt ensures compatibility with the system's libgpiod version.

```bash
sudo apt install python3-pil python3-spidev python3-gpiozero gpiod
```

---

## Rendering Flow

1. **TypeScript** generates UI using JSX syntax
2. **Layout engine** (Yoga) computes flexbox positions
3. **Canvas** (@napi-rs/canvas) draws elements to pixels
4. **Canvas** exports to PNG buffer
5. **hardware.ts** sends PNG buffer to Python daemon via stdin JSON message
6. **Python daemon** receives image, initializes display, sends pixels, sleeps display
7. **Python daemon** reports completion via stdout JSON

---

## Historical Context

This project evolved through several iterations:

1. **Pure Python with Pillow** (original Waveshare examples) — worked for display driving but no type safety, no component model, and no way to test visual output
2. **Pure TypeScript with node-canvas** — canvas worked, GPIO failed on 64-bit Pi OS
3. **TypeScript with libgpiod CLI** — discovered v2.x timing issues
4. **Hybrid TypeScript + Python** — current working solution

The hybrid approach was chosen because:

- TypeScript/TSX gives full type safety, declarative components, and easy snapshot testing
- Python has reliable, well-tested GPIO libraries for the hardware layer
- The display only needs to be updated every few seconds/minutes
- Spawning a Python process is acceptable overhead for e-ink refresh (2-15 seconds anyway)
