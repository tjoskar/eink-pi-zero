/**
 * The hardware layer, black box: only the public API, on top of a simulated
 * kernel (`driver/syscalls.fake.ts`) and fake timers. Nothing here knows
 * about the driver's internals, so a rewrite of them can reuse these tests.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { kernel, type Op } from "./driver/syscalls.fake.ts";
import {
  initHardware,
  onButtonPress,
  REFRESH_LOOP_EXIT_CODE,
  renderToDisplay,
  setLed,
  type HardwareHandle,
  type HardwareOptions,
} from "./mod.ts";

vi.mock("./driver/syscalls.ts", () => import("./driver/syscalls.fake.ts"));

const RST = 17;
const PWR = 18;
const BUSY = 24;
const DC = 25;
const LED = 13;
const BUTTON = 21;

const fixture = (name: string) =>
  readFileSync(new URL(`driver/__fixtures__/${name}`, import.meta.url));
const golden = (name: string) =>
  readFileSync(new URL(`driver/__golden__/${name}.txt`, import.meta.url), "utf8");

function solidPng(gray: number): Buffer {
  const png = new PNG({ width: 800, height: 480 });
  png.data.fill(gray);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return PNG.sync.write(png);
}
const WHITE = solidPng(255);
const LIGHT_GRAY = solidPng(170);
const DARK_GRAY = solidPng(85);
const BLACK = solidPng(0);

let hardware: HardwareHandle | null = null;
let exit: ReturnType<typeof vi.spyOn>;
let kill: ReturnType<typeof vi.spyOn>;

async function init(options?: HardwareOptions): Promise<HardwareHandle> {
  hardware = await initHardware(options);
  return hardware;
}

/** Advance fake time until `promise` settles (at most 2 hours). */
async function run<T>(promise: Promise<T>): Promise<T> {
  const state = { settled: false };
  promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  );
  for (let ms = 0; !state.settled; ms += 50) {
    if (ms > 2 * 3_600_000) throw new Error("did not settle within 2 hours");
    await vi.advanceTimersByTimeAsync(50);
  }
  return promise;
}

/** Advance fake time until `done()` is true (at most 2 hours). */
async function runUntil(done: () => boolean): Promise<void> {
  for (let ms = 0; !done(); ms += 50) {
    if (ms > 2 * 3_600_000) throw new Error("condition not met within 2 hours");
    await vi.advanceTimersByTimeAsync(50);
  }
}

/** What the panel saw, in the golden files' format (see python/record_golden.py). */
const hex = (b: number) => b.toString(16).padStart(2, "0");

function panelView(ops: Op[]): string {
  const lines: string[] = [];
  let data: number[] | null = null; // consecutive data bytes, merged
  let delay = 0; // consecutive time without ops, merged
  let last = ops[0]?.t ?? 0;
  const flushData = () => {
    if (!data) return;
    const hash = createHash("sha256").update(Uint8Array.from(data)).digest("hex").slice(0, 16);
    lines.push(
      data.length <= 16 ? `data ${data.map(hex).join(" ")}` : `data[${data.length}] ${hash}`,
    );
    data = null;
  };
  const flushDelay = () => {
    if (delay) lines.push(`delay ${delay}`);
    delay = 0;
  };
  const push = (line: string) => {
    flushData();
    flushDelay();
    lines.push(line);
  };
  for (const op of ops) {
    if (op.t > last) {
      flushData();
      delay += op.t - last;
      last = op.t;
    }
    if (op.op === "set" && (op.line === RST || op.line === PWR)) {
      push(`gpio ${op.line === RST ? "RST" : "PWR"} ${op.value}`);
    } else if (op.op === "spi-open") push("spi open");
    else if (op.op === "spi-close") push("spi close");
    else if (op.op === "get" && op.line === BUSY) push("read BUSY");
    else if (op.op === "spi" && op.dc === 0) {
      for (const b of op.bytes) push(`cmd ${hex(b)}`);
    } else if (op.op === "spi") {
      flushDelay();
      data ??= [];
      data.push(...op.bytes);
    }
  }
  flushData();
  flushDelay();
  return lines.join("\n") + "\n";
}

/** Commands sent (DC low), without the status polls (0x71). */
const commands = (ops: Op[]) =>
  ops.flatMap((op) =>
    op.op === "spi" && op.dc === 0 && op.bytes[0] !== 0x71 ? [op.bytes[0]] : [],
  );

/** Each refresh's first byte of the 0x10 and 0x13 planes. */
function refreshedPlanes(ops: Op[]): [number, number][] {
  const out: [number, number][] = [];
  let next: "p10" | "p13" | null = null;
  let p10 = -1;
  for (const op of ops) {
    if (op.op !== "spi") continue;
    if (op.dc === 0) next = op.bytes[0] === 0x10 ? "p10" : op.bytes[0] === 0x13 ? "p13" : null;
    else if (next === "p10") {
      p10 = op.bytes[0];
      next = null;
    } else if (next === "p13") {
      out.push([p10, op.bytes[0]]);
      next = null;
    }
  }
  return out;
}

const lineTimes = (line: number, value: 0 | 1) =>
  kernel.log.flatMap((op) =>
    op.op === "set" && op.line === line && op.value === value ? [op.t] : [],
  );

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-27T12:00:00Z") });
  kernel.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  kill = vi.spyOn(process, "kill").mockImplementation(() => true);
});

afterEach(async () => {
  if (hardware) await run(hardware.cleanup());
  hardware = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- The sequences the panel sees ---

test.each([
  ["mono-clear", "mono.png", { clear: true }],
  ["mono-normal", "mono.png", { fast: false }],
  ["mono-fast", "mono.png", { fast: true }],
  ["gray4", "gray4.png", { mode: "gray4" }],
] as const)("%s is byte for byte what the Python driver sends", async (name, image, options) => {
  await init();
  kernel.log = [];
  await run(renderToDisplay(fixture(image), options));
  expect(panelView(kernel.log)).toBe(golden(name));
});

test("renders cycle: the first clears, then 5 fast and 1 normal", async () => {
  await init();
  const seen: string[] = [];
  for (let i = 0; i < 7; i++) {
    kernel.log = [];
    await run(renderToDisplay(fixture("mono.png")));
    const view = panelView(kernel.log);
    seen.push(["mono-clear", "mono-normal", "mono-fast"].find((g) => golden(g) === view) ?? "?");
  }
  expect(seen).toEqual(["mono-clear", ...Array(5).fill("mono-fast"), "mono-normal"]);
});

test("SPI runs in mode 0 with 8 bits at 4 MHz, in transfers of at most 4096 bytes", async () => {
  await init();
  await run(renderToDisplay(fixture("mono.png")));
  expect(kernel.spi).toEqual({ mode: 0, bits: 8, speedHz: 4_000_000 });
  const transfers = kernel.log.filter((op) => op.op === "spi");
  expect(transfers.length).toBeGreaterThan(0);
  for (const t of transfers) {
    expect(t.bytes.length).toBeLessThanOrEqual(4096);
    expect([t.speedHz, t.bits]).toEqual([4_000_000, 8]);
  }
});

test("DC is set right before every SPI transfer", async () => {
  await init();
  await run(renderToDisplay(fixture("gray4.png"), { mode: "gray4" }));
  kernel.log.forEach((op, i) => {
    if (op.op !== "spi") return;
    const before = kernel.log[i - 1];
    expect(before).toMatchObject({ op: "set", line: DC, value: op.dc });
  });
});

test("the panel is in deep sleep with its power off after every render", async () => {
  await init();
  for (const options of [{}, { fast: true }, { mode: "gray4" } as const]) {
    kernel.log = [];
    await run(renderToDisplay(WHITE, options));
    expect(panelView(kernel.log)).toMatch(
      /cmd 07\ndata a5\ndelay 2000\nspi close\ngpio RST 0\ngpio PWR 0\n$/,
    );
    expect([kernel.levels.get(PWR), kernel.levels.get(RST), kernel.levels.get(DC)]).toEqual([
      0, 0, 0,
    ]);
  }
});

// --- BUSY ---

test("BUSY is polled every 5 ms, with a status command before each read", async () => {
  await init();
  kernel.busyAfter.set(0x12, 1000);
  await run(renderToDisplay(WHITE, { fast: true }));
  const refresh = kernel.log.findIndex(
    (op) => op.op === "spi" && op.dc === 0 && op.bytes[0] === 0x12,
  );
  const reads = kernel.log.slice(refresh).filter((op) => op.op === "get" && op.line === BUSY);
  const gaps = reads.slice(1, 150).map((op, i) => op.t - reads[i].t);
  expect(new Set(gaps)).toEqual(new Set([5]));
  kernel.log.slice(refresh).forEach((op, i, ops) => {
    if (op.op === "get" && op.line === BUSY) {
      expect(ops[i - 1]).toMatchObject({ op: "spi", dc: 0, bytes: Uint8Array.of(0x71) });
    }
  });
});

test("a panel stuck BUSY fails the render after 30 s and its power still goes off", async () => {
  await init();
  kernel.busyAfter.set(0x12, Infinity);
  const start = Date.now();
  const render = renderToDisplay(WHITE, { fast: true });
  await expect(run(render)).rejects.toThrow(/BUSY after 30 s/);
  const refreshAt = kernel.log.find(
    (op) => op.op === "spi" && op.bytes[0] === 0x12 && op.dc === 0,
  )!.t;
  expect(lineTimes(PWR, 0).at(-1)! - refreshAt).toBeGreaterThanOrEqual(30_000);
  expect([kernel.levels.get(PWR), kernel.levels.get(RST), kernel.levels.get(DC)]).toEqual([
    0, 0, 0,
  ]);
  expect(Date.now() - start).toBeLessThan(5 * 60_000);

  // The next render starts from scratch and works once the panel answers.
  kernel.busyAfter.clear();
  kernel.busyUntil = 0;
  await run(renderToDisplay(WHITE, { fast: true }));
});

// --- Cleanup ---

test("a signal mid-render waits for the current step, then sleeps the panel and releases everything", async () => {
  const appListener = vi.fn();
  process.on("SIGTERM", appListener);
  try {
    const hw = await init();
    await setLed(LED, true);
    kernel.busyAfter.set(0x04, 500); // power on takes a while
    const render = renderToDisplay(WHITE, { clear: true });
    render.catch(() => {});
    await runUntil(() => kernel.log.some((op) => op.op === "get" && op.line === BUSY));

    process.emit("SIGTERM");
    await run(hw.cleanup());

    await expect(render).rejects.toThrow(/render stopped/);
    // Init ran to its end, no refresh started, then deep sleep. Never interleaved.
    expect(commands(kernel.log)).toEqual([
      0x06, 0x01, 0x04, 0x00, 0x61, 0x15, 0x50, 0x60, 0x50, 0x02, 0x07,
    ]);
    expect([kernel.levels.get(PWR), kernel.levels.get(RST), kernel.levels.get(DC)]).toEqual([
      0, 0, 0,
    ]);
    expect(kernel.levels.get(LED)).toBe(0);
    expect(kernel.requested.size).toBe(0);
    expect(kill).not.toHaveBeenCalled(); // the app handles SIGTERM itself
  } finally {
    process.off("SIGTERM", appListener);
  }
});

test("a signal the app does not handle is raised again after cleanup", async () => {
  const others = process.rawListeners("SIGHUP") as (() => void)[];
  process.removeAllListeners("SIGHUP");
  try {
    await init();
    process.emit("SIGHUP");
    await runUntil(() => kill.mock.calls.length > 0);
    expect(kill).toHaveBeenCalledWith(process.pid, "SIGHUP");
    expect(kernel.requested.size).toBe(0);
    expect(process.listenerCount("SIGHUP")).toBe(0);
  } finally {
    for (const listener of others) process.on("SIGHUP", listener);
  }
});

test("on process exit mid-render, power, RST, DC and LEDs go low at once", async () => {
  const before = new Set(process.listeners("exit"));
  await init();
  const onExit = process.listeners("exit").find((l) => !before.has(l))!;
  await setLed(LED, true);
  kernel.busyAfter.set(0x12, 3000);
  renderToDisplay(WHITE, { fast: true }).catch(() => {});
  await runUntil(
    () =>
      kernel.levels.get(PWR) === 1 &&
      kernel.log.some((op) => op.op === "spi" && op.bytes[0] === 0x12),
  );

  onExit(0);

  expect([
    kernel.levels.get(PWR),
    kernel.levels.get(RST),
    kernel.levels.get(DC),
    kernel.levels.get(LED),
  ]).toEqual([0, 0, 0, 0]);
  expect(kernel.requested.size).toBe(0);
});

test("lines held by another app: a clear error, and nothing is left requested", async () => {
  kernel.heldByOthers.add(PWR);
  await expect(initHardware()).rejects.toThrow("GPIO lines busy: another app owns the panel");
  expect(kernel.requested.size).toBe(0);
});

test("the hardware must be initialized first", async () => {
  await expect(renderToDisplay(WHITE)).rejects.toThrow(/initHardware/);
});

// --- Refresh guard ---

test("a render that comes too soon waits, and only the latest waiting frame is drawn", async () => {
  await init();
  const first = renderToDisplay(WHITE, { mode: "gray4" });
  await vi.advanceTimersByTimeAsync(10);
  const replaced = renderToDisplay(BLACK, { mode: "gray4" });
  const latest = renderToDisplay(LIGHT_GRAY, { mode: "gray4" });
  await run(Promise.all([first, replaced, latest]));

  expect(refreshedPlanes(kernel.log)).toEqual([
    [0x00, 0x00], // white
    [0xff, 0x00], // light gray; black was replaced before its turn
  ]);
  const [, secondStart] = lineTimes(PWR, 1);
  const [firstEnd] = lineTimes(PWR, 0);
  expect(secondStart - firstEnd).toBeGreaterThanOrEqual(2000);
});

test("a render every 2 s: at most 3 a minute, then after 20 in an hour the process exits with 75", async () => {
  await init();
  const loop = setInterval(
    () => renderToDisplay(DARK_GRAY, { mode: "gray4" }).catch(() => {}),
    2000,
  );
  try {
    await runUntil(() => exit.mock.calls.length > 0);
  } finally {
    clearInterval(loop);
  }
  expect(exit).toHaveBeenCalledWith(REFRESH_LOOP_EXIT_CODE);
  expect(REFRESH_LOOP_EXIT_CODE).toBe(75);

  const starts = lineTimes(PWR, 1);
  const ends = lineTimes(PWR, 0);
  expect(starts).toHaveLength(20);
  for (const [i, start] of starts.entries()) {
    expect(starts.filter((t) => t > start - 60_000 && t <= start).length).toBeLessThanOrEqual(3);
    if (i > 0) expect(start - ends[i - 1]).toBeGreaterThanOrEqual(2000);
  }
  // Cleaned up before exiting.
  expect(kernel.requested.size).toBe(0);
  expect(kernel.levels.get(PWR)).toBe(0);
});

test("the refresh limits can be overridden", async () => {
  await init({ refreshLimits: { perHour: 2 } });
  await run(renderToDisplay(WHITE));
  await run(renderToDisplay(WHITE));
  await expect(run(renderToDisplay(WHITE))).rejects.toThrow(/cleaned up/);
  expect(exit).toHaveBeenCalledWith(75);
  expect(lineTimes(PWR, 1)).toHaveLength(2);
});

// --- Button and LED ---

test("a button press calls back; edges are read without blocking", async () => {
  await init();
  const pressed = vi.fn();
  await onButtonPress(BUTTON, pressed);
  expect(kernel.log).toContainEqual(
    expect.objectContaining({ op: "request", lines: [BUTTON], debounceUs: 50_000 }),
  );
  expect(kernel.log).toContainEqual(
    expect.objectContaining({ op: "nonblocking", lines: [BUTTON] }),
  );

  kernel.press(BUTTON);
  kernel.press(BUTTON);
  await vi.advanceTimersByTimeAsync(100);
  expect(pressed).toHaveBeenCalledTimes(2);
});

test("the LED switches on, off and blinks, and is off after cleanup", async () => {
  const hw = await init();
  await setLed(LED, true);
  expect(kernel.levels.get(LED)).toBe(1);
  await setLed(LED, false);
  expect(kernel.levels.get(LED)).toBe(0);

  await setLed(LED, "blink");
  const levels: (0 | 1 | undefined)[] = [];
  for (let i = 0; i < 4; i++) {
    levels.push(kernel.levels.get(LED));
    await vi.advanceTimersByTimeAsync(500);
  }
  expect(levels).toEqual([1, 0, 1, 0]);

  await setLed(LED, true);
  await run(hw.cleanup());
  expect(kernel.levels.get(LED)).toBe(0);
  expect(kernel.requested.size).toBe(0);
});

test("the panel's and SPI's pins cannot be used for a button or an LED", async () => {
  await init();
  await expect(setLed(PWR, true)).rejects.toThrow(/cannot be used/);
  await expect(onButtonPress(BUSY, () => {})).rejects.toThrow(/cannot be used/);
  await expect(setLed(8, true)).rejects.toThrow(/cannot be used/);
});
