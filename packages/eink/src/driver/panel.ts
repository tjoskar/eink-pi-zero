/**
 * The panel, LEDs and buttons on a real Pi, through the GPIO and SPI
 * chardevs. `hardware.ts` decides when to render; this only knows how.
 */
import { assertExpectedChip, LineRequest } from "./gpio.ts";
import { assertAppPin, Epd } from "./epd.ts";
import { toGray4Planes, toMonoFrame } from "./image.ts";

export interface Frame {
  png: Uint8Array;
  mode: "mono" | "gray4";
  fast: boolean;
  clear: boolean;
}

const LED_BLINK_MS = 500;
const BUTTON_POLL_MS = 20;
const BUTTON_DEBOUNCE_US = 50_000;

function tryRelease(line: LineRequest): void {
  try {
    line.release();
  } catch (err) {
    console.error("[hardware] Could not release a GPIO line:", err);
  }
}

export class Panel {
  readonly #epd: Epd;
  readonly #leds = new Map<number, { line: LineRequest; blink?: NodeJS.Timeout }>();
  readonly #buttons = new Map<number, { line: LineRequest; poll: NodeJS.Timeout }>();

  constructor() {
    assertExpectedChip();
    this.#epd = new Epd();
  }

  /**
   * One full refresh, always ending in deep sleep with the panel's power off.
   * `step` is called between steps; it throws to stop a render early.
   */
  async render(frame: Frame, step: () => void): Promise<void> {
    // Convert before powering on, so a bad image never wakes the panel.
    const gray4 = frame.mode === "gray4" ? toGray4Planes(frame.png) : null;
    const mono = gray4 ? null : toMonoFrame(frame.png);
    try {
      step();
      await this.#epd.init(gray4 ? "gray4" : frame.fast ? "fast" : "normal");
      if (gray4) {
        step();
        await this.#epd.display4Gray(gray4.plane10, gray4.plane13);
      } else {
        if (frame.clear) {
          step();
          await this.#epd.clear();
        }
        step();
        await this.#epd.display(mono!);
      }
    } finally {
      await this.#epd.sleep();
    }
  }

  setLed(pin: number, state: boolean | "blink"): void {
    let led = this.#leds.get(pin);
    if (!led) {
      assertAppPin(pin);
      led = { line: new LineRequest([pin], { direction: "output" }) };
      this.#leds.set(pin, led);
    }
    clearInterval(led.blink);
    led.blink = undefined;
    if (state === "blink") {
      let on = true;
      const { line } = led;
      line.set(pin, 1);
      led.blink = setInterval(() => {
        on = !on;
        line.set(pin, on ? 1 : 0);
      }, LED_BLINK_MS).unref();
    } else {
      led.line.set(pin, state ? 1 : 0);
    }
  }

  /** Call `onPress` on every falling edge (button to ground, internal pull-up). */
  watchButton(pin: number, onPress: () => void): void {
    if (this.#buttons.has(pin)) throw new Error(`GPIO ${pin} is already watched`);
    assertAppPin(pin);
    const line = new LineRequest([pin], {
      direction: "input",
      bias: "pull-up",
      fallingEdge: { debounceUs: BUTTON_DEBOUNCE_US },
    });
    // Polled, never a blocking read: that would keep the process from exiting.
    const poll = setInterval(() => {
      for (let n = line.readFallingEdges(); n > 0; n--) onPress();
    }, BUTTON_POLL_MS).unref();
    this.#buttons.set(pin, { line, poll });
  }

  /**
   * Synchronous and safe to call at any time, also mid-render (for the
   * process's `exit` event): panel power, RST, DC and LEDs low, lines released.
   */
  release(): void {
    // Panel power first, so nothing below can keep it on.
    this.#epd.powerOff();
    for (const [pin, led] of this.#leds) {
      clearInterval(led.blink);
      try {
        led.line.set(pin, 0);
      } catch {}
      tryRelease(led.line);
    }
    this.#leds.clear();
    for (const button of this.#buttons.values()) {
      clearInterval(button.poll);
      tryRelease(button.line);
    }
    this.#buttons.clear();
    this.#epd.release();
  }
}
