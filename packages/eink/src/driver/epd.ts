/**
 * Waveshare 7.5" V2. The same command/data sequences as Waveshare's Python
 * driver (epd7in5_v2.py: init, init_fast, init_4Gray, display, display_4Gray,
 * Clear, sleep) and the same pins as its epdconfig.py. Tests compare every
 * sequence with recordings of the Python driver (`__golden__/`).
 *
 * Differences from the Python driver, none visible to the panel:
 * - bulk data goes out in transfers of at most 4096 bytes, with DC set
 *   before each one (Python sends 4-gray planes one byte at a time);
 * - BUSY is polled every 5 ms instead of in a tight loop, with a timeout.
 */
import { clock } from "../clock.ts";
import { LineRequest, LinesBusyError } from "./gpio.ts";
import { MAX_TRANSFER, Spi } from "./spi.ts";

export const WIDTH = 800;
export const HEIGHT = 480;
/** One bit per pixel: a 1-bit frame, or one 4-gray plane. */
export const PLANE_SIZE = (WIDTH / 8) * HEIGHT;

const RST = 17;
const DC = 25;
const PWR = 18;
const BUSY = 24;
/** Lines the panel and the SPI bus use. An app must never request them. */
const PANEL_PINS: ReadonlySet<number> = new Set([RST, DC, PWR, BUSY, 7, 8, 9, 10, 11]);

/** For an LED or button: a header GPIO (0–27) that is not the panel's or SPI's. */
export function assertAppPin(pin: number): void {
  if (!Number.isInteger(pin) || pin < 0 || pin > 27 || PANEL_PINS.has(pin)) {
    throw new Error(`GPIO ${pin} cannot be used: the panel and SPI use ${[...PANEL_PINS]}`);
  }
}

const BUSY_POLL_MS = 5;
const BUSY_TIMEOUT_MS = 30_000;

function panelBusy(err: unknown): unknown {
  return err instanceof LinesBusyError
    ? new Error("GPIO lines busy: another app owns the panel", { cause: err })
    : err;
}

export type InitMode = "normal" | "fast" | "gray4";

export class Epd {
  readonly #out: LineRequest;
  readonly #busy: LineRequest;
  #spi: Spi | null = null;

  constructor() {
    try {
      // BUSY is driven by the panel: input only, never output.
      this.#busy = new LineRequest([BUSY], { direction: "input", bias: "pull-down" });
    } catch (err) {
      throw panelBusy(err);
    }
    try {
      this.#out = new LineRequest([RST, DC, PWR], { direction: "output" });
    } catch (err) {
      this.#busy.release();
      throw panelBusy(err);
    }
  }

  /** Power on, reset and send one of the three init sequences. */
  async init(mode: InitMode): Promise<void> {
    this.#out.set(PWR, 1);
    this.#spi = new Spi();
    await this.#reset();
    if (mode === "normal") {
      this.#command(0x06, 0x17, 0x17, 0x28, 0x17); // booster soft start
      this.#command(0x01, 0x07, 0x07, 0x28, 0x17); // power setting
      await this.#powerOn();
      this.#command(0x00, 0x1f); // panel setting
      this.#command(0x61, 0x03, 0x20, 0x01, 0xe0); // resolution 800x480
      this.#command(0x15, 0x00);
      this.#command(0x50, 0x10, 0x07);
      this.#command(0x60, 0x22); // TCON
    } else {
      this.#command(0x00, 0x1f); // panel setting
      this.#command(0x50, 0x10, 0x07);
      await this.#powerOn();
      this.#command(0x06, 0x27, 0x27, 0x18, 0x17); // booster soft start
      this.#command(0xe0, 0x02);
      this.#command(0xe5, mode === "fast" ? 0x5a : 0x5f);
    }
  }

  /** A 1-bit frame: PLANE_SIZE bytes, bit set = black. */
  async display(frame: Uint8Array): Promise<void> {
    await this.#refresh(
      frame.map((b) => ~b & 0xff),
      frame,
    );
  }

  /** A 4-gray frame: the two planes sent after commands 0x10 and 0x13. */
  async display4Gray(plane10: Uint8Array, plane13: Uint8Array): Promise<void> {
    await this.#refresh(plane10, plane13);
  }

  /** A full white refresh. */
  async clear(): Promise<void> {
    await this.#refresh(new Uint8Array(PLANE_SIZE).fill(0xff), new Uint8Array(PLANE_SIZE));
  }

  /**
   * Deep sleep, then SPI closed and RST/DC/PWR low. The lines go low even if
   * the panel does not answer.
   */
  async sleep(): Promise<void> {
    try {
      if (this.#spi) {
        this.#command(0x50, 0xf7);
        this.#command(0x02); // power off
        await this.#waitUntilIdle();
        this.#command(0x07, 0xa5); // deep sleep
        await clock.sleep(2000);
      }
    } finally {
      this.powerOff();
    }
  }

  /** Synchronous: SPI closed and RST/DC/PWR low, without the sleep commands. */
  powerOff(): void {
    if (this.#spi) {
      try {
        this.#spi.close();
      } catch {}
      this.#spi = null;
    }
    for (const pin of [RST, DC, PWR]) {
      try {
        this.#out.set(pin, 0);
      } catch {}
    }
  }

  /** Power off and give the lines back to the kernel. */
  release(): void {
    this.powerOff();
    this.#out.release();
    this.#busy.release();
  }

  async #reset(): Promise<void> {
    this.#out.set(RST, 1);
    await clock.sleep(20);
    this.#out.set(RST, 0);
    await clock.sleep(2);
    this.#out.set(RST, 1);
    await clock.sleep(20);
  }

  async #powerOn(): Promise<void> {
    this.#command(0x04);
    await clock.sleep(100);
    await this.#waitUntilIdle();
  }

  async #refresh(plane10: Uint8Array, plane13: Uint8Array): Promise<void> {
    if (plane10.length !== PLANE_SIZE || plane13.length !== PLANE_SIZE) {
      throw new Error(`a plane is ${PLANE_SIZE} bytes`);
    }
    this.#command(0x10);
    this.#data(plane10);
    this.#command(0x13);
    this.#data(plane13);
    this.#command(0x12); // refresh
    await clock.sleep(100);
    await this.#waitUntilIdle();
  }

  /** A command byte, then its data bytes one at a time, as the Python driver sends them. */
  #command(command: number, ...data: number[]): void {
    this.#send(0, Uint8Array.of(command));
    for (const byte of data) this.#send(1, Uint8Array.of(byte));
  }

  #data(bytes: Uint8Array): void {
    for (let at = 0; at < bytes.length; at += MAX_TRANSFER) {
      this.#send(1, bytes.subarray(at, at + MAX_TRANSFER));
    }
  }

  /** DC is set right before every transfer, so it can never be out of step. */
  #send(dc: 0 | 1, bytes: Uint8Array): void {
    if (!this.#spi) throw new Error("panel is not powered on");
    this.#out.set(DC, dc);
    this.#spi.transfer(bytes);
  }

  /** Poll BUSY (low = busy) every 5 ms, asking for status (0x71) each time. */
  async #waitUntilIdle(): Promise<void> {
    const start = clock.now();
    this.#command(0x71);
    while (this.#busy.get(BUSY) === 0) {
      if (clock.now() - start >= BUSY_TIMEOUT_MS) {
        throw new Error(`panel still BUSY after ${BUSY_TIMEOUT_MS / 1000} s`);
      }
      await clock.sleep(BUSY_POLL_MS);
      this.#command(0x71);
    }
    await clock.sleep(20);
  }
}
