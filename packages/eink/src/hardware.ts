/**
 * The panel, buttons and LEDs: what an app calls. On a Pi it drives the
 * hardware directly (`driver/`); in mock mode (MOCK=1) a render writes
 * preview.png and the 'b' key presses every button.
 *
 * Every render is a full refresh that ends with the panel in deep sleep and
 * its power off. Renders never overlap, and a refresh guard keeps a buggy
 * app from wearing out the panel (see `RefreshLimits`).
 */
import { writeFile } from "node:fs/promises";
import { clock } from "./clock.ts";
import { IS_MOCK } from "./env.ts";
import type { Frame, Panel } from "./driver/panel.ts";

/** Button press callback type */
export type ButtonCallback = () => void;

/** Render options */
export interface RenderOptions {
  /** `mono` (default): 1-bit. `gray4`: four gray levels, always a full init; `fast` and `clear` are ignored. */
  mode?: "mono" | "gray4";
  /** Use fast init mode (faster refresh, less clean) */
  fast?: boolean;
  /** Clear display before rendering */
  clear?: boolean;
}

/**
 * How often the panel may refresh. A render that comes too soon waits; if
 * several wait, only the latest frame is drawn. Reaching `perHour` means the
 * app is stuck in a render loop: the process logs an error, cleans up and
 * exits with `REFRESH_LOOP_EXIT_CODE`, which the systemd unit does not restart.
 */
export interface RefreshLimits {
  /** From the end of one render to the start of the next (ms). */
  minGapMs: number;
  perMinute: number;
  perHour: number;
}

export const DEFAULT_REFRESH_LIMITS: RefreshLimits = { minGapMs: 2000, perMinute: 3, perHour: 20 };

/** Exit code after a render loop (EX_TEMPFAIL). The unit sets RestartPreventExitStatus=75. */
export const REFRESH_LOOP_EXIT_CODE = 75;

export interface HardwareOptions {
  /** Override some of `DEFAULT_REFRESH_LIMITS`. */
  refreshLimits?: Partial<RefreshLimits>;
}

/** Returned by `initHardware`. Use with `await using`. */
export interface HardwareHandle extends AsyncDisposable {
  /** Same as disposing: waits for a running render's deep sleep, then releases everything. */
  cleanup(): Promise<void>;
}

type PanelApi = Pick<Panel, "render" | "setLed" | "watchButton" | "release">;

/** How often to use normal init instead of fast, counted in renders. */
const NORMAL_INIT_INTERVAL = 6;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

interface Waiter {
  resolve(): void;
  reject(err: unknown): void;
}

class Hardware {
  readonly #panel: PanelApi;
  readonly #limits: RefreshLimits;
  readonly #stopping = new AbortController();
  #stopped: Promise<void> | null = null;

  /** The latest frame not drawn yet, and everyone waiting for a frame. */
  #pending: { png: Uint8Array; options: RenderOptions; waiters: Waiter[] } | null = null;
  /** True while the draw loop runs; cleared synchronously when it ends. */
  #isDrawing = false;
  #drawing: Promise<void> = Promise.resolve();
  #renderCount = 0;
  #renderStarts: number[] = [];
  #lastRenderEnd = -Infinity;

  readonly #buttonCallbacks = new Map<number, ButtonCallback[]>();
  readonly #signalHandlers = new Map<NodeJS.Signals, () => void>();
  readonly #onExit = () => this.#panel.release();

  constructor(panel: PanelApi, limits: RefreshLimits) {
    this.#panel = panel;
    this.#limits = limits;
    // Last resort on any exit (also an uncaught error): drop power, no deep sleep.
    process.on("exit", this.#onExit);
    for (const signal of SIGNALS) {
      const handler = () => {
        // Prepended, so app listeners have not run yet and are still counted.
        const appHandlesSignal = process.listenerCount(signal) > 1;
        void this.stop().then(() => {
          // Nobody else handles it: re-raise now that our handler is gone.
          if (!appHandlesSignal) process.kill(process.pid, signal);
        });
      };
      this.#signalHandlers.set(signal, handler);
      process.prependListener(signal, handler);
    }
  }

  render(png: Uint8Array, options: RenderOptions): Promise<void> {
    if (this.#stopping.signal.aborted) {
      return Promise.reject(new Error("[hardware] already cleaned up"));
    }
    return new Promise((resolve, reject) => {
      const waiters = [...(this.#pending?.waiters ?? []), { resolve, reject }];
      this.#pending = { png, options, waiters };
      if (!this.#isDrawing) this.#drawing = this.#drawLoop();
    });
  }

  /** The one place renders start, so they never overlap. */
  async #drawLoop(): Promise<void> {
    this.#isDrawing = true;
    try {
      const { signal } = this.#stopping;
      while (this.#pending && !signal.aborted) {
        const wait = this.#msUntilAllowed();
        if (wait === "loop") return this.#stopRenderLoop();
        if (wait > 0) {
          await clock.sleep(wait, signal);
          continue; // a newer frame may have arrived meanwhile
        }

        const { png, options, waiters } = this.#pending;
        this.#pending = null;
        const frame = this.#frame(png, options);
        this.#renderStarts.push(clock.now());
        try {
          await this.#panel.render(frame, () => {
            if (signal.aborted) throw new Error("[hardware] render stopped: cleaning up");
          });
          console.log(`[hardware] Render #${this.#renderCount} complete (${describe(frame)})`);
          this.#renderCount++;
          for (const w of waiters) w.resolve();
        } catch (err) {
          for (const w of waiters) w.reject(err);
        } finally {
          this.#lastRenderEnd = clock.now();
        }
      }
    } finally {
      // In the same tick as the loop's last check for a pending frame (not
      // after an await), so a frame asked for right after always starts a new loop.
      this.#isDrawing = false;
    }
  }

  #msUntilAllowed(): number | "loop" {
    const now = clock.now();
    this.#renderStarts = this.#renderStarts.filter((t) => t > now - HOUR_MS);
    const { minGapMs, perMinute, perHour } = this.#limits;
    if (this.#renderStarts.length >= perHour) return "loop";
    let at = this.#lastRenderEnd + minGapMs;
    const lastMinute = this.#renderStarts.filter((t) => t > now - MINUTE_MS);
    if (lastMinute.length >= perMinute) {
      at = Math.max(at, lastMinute[lastMinute.length - perMinute] + MINUTE_MS);
    }
    return Math.max(0, at - now);
  }

  #stopRenderLoop(): void {
    const { perHour } = this.#limits;
    console.error(
      `[hardware] ${perHour} renders within an hour: the app looks stuck in a render loop. ` +
        `Exiting with code ${REFRESH_LOOP_EXIT_CODE}; restart it by hand once fixed.`,
    );
    // Not awaited: stop() waits for this draw loop to finish.
    void this.stop().finally(() => process.exit(REFRESH_LOOP_EXIT_CODE));
  }

  /** First render clears, then 5 fast and 1 normal, unless `options` says otherwise. */
  #frame(png: Uint8Array, options: RenderOptions): Frame {
    const mode = options.mode ?? "mono";
    if (options.fast !== undefined || options.clear !== undefined) {
      return { png, mode, fast: options.fast ?? false, clear: options.clear ?? false };
    }
    if (this.#renderCount === 0) return { png, mode, fast: false, clear: true };
    return { png, mode, fast: this.#renderCount % NORMAL_INIT_INTERVAL !== 0, clear: false };
  }

  setLed(pin: number, state: boolean | "blink"): void {
    this.#panel.setLed(pin, state);
  }

  onButtonPress(pin: number, callback: ButtonCallback): void {
    const callbacks = this.#buttonCallbacks.get(pin);
    if (callbacks) {
      callbacks.push(callback);
      return;
    }
    this.#panel.watchButton(pin, () => {
      console.log(`[hardware] Button event on pin ${pin}`);
      for (const cb of this.#buttonCallbacks.get(pin) ?? []) {
        try {
          cb();
        } catch (err) {
          console.error("[hardware] Button callback error:", err);
        }
      }
    });
    // Only once watching works, so a failed subscription can be retried.
    this.#buttonCallbacks.set(pin, [callback]);
    console.log(`[hardware] Subscribed to button on pin ${pin}`);
  }

  /**
   * Stop rendering and release everything. A running render finishes its
   * current step, then its own deep sleep, before anything is released.
   */
  stop(): Promise<void> {
    this.#stopped ??= (async () => {
      console.log("[hardware] Cleaning up...");
      this.#stopping.abort();
      const notDrawn = this.#pending?.waiters ?? [];
      this.#pending = null;
      for (const w of notDrawn)
        w.reject(new Error("[hardware] cleaned up before the frame was drawn"));
      await this.#drawing;
      this.#panel.release();
      process.off("exit", this.#onExit);
      for (const [signal, handler] of this.#signalHandlers) process.off(signal, handler);
      if (hardware === this) hardware = null;
    })();
    return this.#stopped;
  }
}

function describe(frame: Frame): string {
  if (frame.mode === "gray4") return "gray4";
  if (frame.clear) return "clear + normal";
  return frame.fast ? "fast" : "normal";
}

let hardware: Hardware | null = null;

function current(): Hardware {
  if (!hardware) throw new Error("[hardware] call initHardware() first");
  return hardware;
}

/**
 * Take the panel, buttons and LEDs. Fails if another process holds the GPIO
 * lines. Cleans up on SIGINT, SIGTERM and SIGHUP too (and re-raises the
 * signal if the app does not handle it).
 *
 * ```ts
 * await using hardware = await initHardware();
 * ```
 */
export async function initHardware(options: HardwareOptions = {}): Promise<HardwareHandle> {
  if (hardware) throw new Error("[hardware] initHardware() was already called");
  const limits = { ...DEFAULT_REFRESH_LIMITS, ...options.refreshLimits };
  let panel: PanelApi;
  if (IS_MOCK) {
    panel = createMockPanel();
  } else {
    // Imported lazily, so mock mode never loads the FFI bridge.
    const { Panel } = await import("./driver/panel.ts");
    panel = new Panel();
  }
  const hw = new Hardware(panel, limits);
  hardware = hw;
  console.log("[hardware] Ready");
  return { cleanup: () => hw.stop(), [Symbol.asyncDispose]: () => hw.stop() };
}

/**
 * Render a PNG (800x480) to the panel. Resolves once this frame, or a newer
 * one that replaced it while waiting, has been drawn.
 */
export function renderToDisplay(
  imageBuffer: Uint8Array,
  options: RenderOptions = {},
): Promise<void> {
  try {
    return current().render(imageBuffer, options);
  } catch (err) {
    return Promise.reject(err);
  }
}

/** Call `callback` on every press of the button on `pin` (to ground; pull-up and debounce built in). */
export async function onButtonPress(pin: number, callback: ButtonCallback): Promise<void> {
  current().onButtonPress(pin, callback);
}

/** Set the LED on `pin`: on, off, or blink until the next call. */
export async function setLed(pin: number, state: boolean | "blink"): Promise<void> {
  current().setLed(pin, state);
}

function createMockPanel(): PanelApi {
  const buttons: (() => void)[] = [];
  const onKey = (key: string) => {
    // Ctrl+C: restore the terminal and emit SIGINT locally, so the normal
    // signal handling runs full cleanup (process.emit, not process.kill(0),
    // so a parent like tsx --watch is not signalled before cleanup is done).
    if (key === "\u0003") {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.emit("SIGINT");
      return;
    }
    if (key.toLowerCase() === "b") {
      console.log("[hardware] Mock button pressed (keyboard 'b')");
      for (const press of buttons) press();
    }
  };
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", onKey);
  process.stdin.resume();
  console.log("[hardware] Mock mode - press 'b' to simulate a button press");

  return {
    async render(frame) {
      await writeFile("preview.png", frame.png);
      console.log(`[hardware] Mock render (${frame.mode}): preview.png`);
    },
    setLed(pin, state) {
      console.log(
        `[hardware] Mock LED pin ${pin}: ${state === "blink" ? "BLINK" : state ? "ON" : "OFF"}`,
      );
    },
    watchButton(_pin, onPress) {
      buttons.push(onPress);
    },
    release() {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.off("data", onKey);
      process.stdin.pause();
    },
  };
}
