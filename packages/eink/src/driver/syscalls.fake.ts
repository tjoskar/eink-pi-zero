/**
 * A simulated kernel with the same exports as `syscalls.ts`, for tests:
 *
 *   vi.mock("./driver/syscalls.ts", () => import("./driver/syscalls.fake.ts"));
 *
 * It understands the GPIO v2 chardev and spidev ioctls the driver uses,
 * behaves like the kernel where it matters for safety (EBUSY, no writes to
 * inputs, outputs keep their level after release) and records every call in
 * `kernel.log` with the (fake) time it happened.
 */
import * as abi from "./abi.ts";
import { EBUSY } from "./abi.ts";

export class SyscallError extends Error {
  constructor(
    message: string,
    readonly errno: number,
  ) {
    super(`${message}: errno ${errno}`);
  }
}

export type Op =
  | { t: number; op: "request"; lines: number[]; flags: bigint; debounceUs?: number }
  | { t: number; op: "release"; lines: number[] }
  | { t: number; op: "set"; line: number; value: 0 | 1 }
  | { t: number; op: "get"; line: number }
  | { t: number; op: "spi-open" }
  | { t: number; op: "spi-close" }
  | { t: number; op: "spi-config"; mode: number; bits: number; speedHz: number }
  | { t: number; op: "spi"; bytes: Uint8Array; dc: 0 | 1; speedHz: number; bits: number }
  | { t: number; op: "nonblocking"; lines: number[] }
  | { t: number; op: "read"; lines: number[] };

export const BUSY_LINE = 24;
export const DC_LINE = 25;

type File =
  | { kind: "chip" }
  | { kind: "spi" }
  | { kind: "line"; lines: number[]; output: boolean; nonBlocking: boolean; edges: number };

export const kernel = {
  log: [] as Op[],
  /** Output levels. Like the real chip, a line keeps its level after release. */
  levels: new Map<number, 0 | 1>(),
  /** Lines requested by this process. */
  requested: new Set<number>(),
  /** Lines another process holds: requesting them fails with EBUSY. */
  heldByOthers: new Set<number>(),
  /** How long the panel keeps BUSY low after a command, in ms (Infinity: forever). */
  busyAfter: new Map<number, number>(),
  busyUntil: 0,
  spi: { mode: 0, bits: 0, speedHz: 0 },
  files: new Map<number, File>(),
  memory: new Map<bigint, Uint8Array>(),
  nextFd: 10,

  reset(): void {
    this.log = [];
    this.levels.clear();
    this.requested.clear();
    this.heldByOthers.clear();
    this.busyAfter.clear();
    this.busyUntil = 0;
    this.spi = { mode: 0, bits: 0, speedHz: 0 };
    this.files.clear();
    this.memory.clear();
  },

  /** A button press on `line`: one falling edge, queued for the next read. */
  press(line: number): void {
    for (const file of this.files.values()) {
      if (file.kind === "line" && file.lines.includes(line)) file.edges++;
    }
  },
};

const now = () => Date.now();

export function open(path: string, _flags: "r" | "r+"): number {
  const fd = kernel.nextFd++;
  if (path === "/dev/gpiochip0") kernel.files.set(fd, { kind: "chip" });
  else if (path === "/dev/spidev0.0") {
    kernel.files.set(fd, { kind: "spi" });
    kernel.log.push({ t: now(), op: "spi-open" });
  } else throw new Error(`fake: no such device ${path}`);
  return fd;
}

export function close(fd: number): void {
  const file = kernel.files.get(fd);
  if (!file) throw new Error(`fake: close of unknown fd ${fd}`);
  kernel.files.delete(fd);
  if (file.kind === "spi") kernel.log.push({ t: now(), op: "spi-close" });
  if (file.kind === "line") {
    for (const line of file.lines) kernel.requested.delete(line);
    kernel.log.push({ t: now(), op: "release", lines: file.lines });
  }
}

export function ioctl(fd: number, request: number, arg: Buffer): void {
  const file = kernel.files.get(fd);
  if (!file) throw new Error(`fake: ioctl on unknown fd ${fd}`);
  if (file.kind === "chip") return chipIoctl(request, arg);
  if (file.kind === "spi") return spiIoctl(request, arg);
  return lineIoctl(file, request, arg);
}

function chipIoctl(request: number, arg: Buffer): void {
  if (request === abi.GPIO_GET_CHIPINFO_IOCTL) {
    arg.write("gpiochip0", 0, "latin1");
    arg.write("pinctrl-bcm2835", 32, "latin1");
    arg.writeUInt32LE(54, 64);
    return;
  }
  if (request !== abi.GPIO_V2_GET_LINE_IOCTL)
    throw new Error(`fake: chip ioctl 0x${request.toString(16)}`);

  const n = arg.readUInt32LE(abi.LINE_REQUEST_NUM_LINES_OFFSET);
  const lines = Array.from({ length: n }, (_, i) => arg.readUInt32LE(i * 4));
  if (lines.some((l) => kernel.heldByOthers.has(l) || kernel.requested.has(l))) {
    throw new SyscallError("fake GPIO_V2_GET_LINE_IOCTL", EBUSY);
  }
  const cfg = abi.LINE_REQUEST_CONFIG_OFFSET;
  const flags = arg.readBigUInt64LE(cfg);
  const output = (flags & abi.GPIO_V2_LINE_FLAG_OUTPUT) !== 0n;
  let debounceUs: number | undefined;
  let initial = 0n;
  const numAttrs = arg.readUInt32LE(cfg + abi.LINE_CONFIG_NUM_ATTRS_OFFSET);
  for (let i = 0; i < numAttrs; i++) {
    const at = cfg + abi.LINE_CONFIG_ATTRS_OFFSET + i * abi.LINE_CONFIG_ATTRIBUTE_SIZE;
    const id = arg.readUInt32LE(at);
    if (id === abi.GPIO_V2_LINE_ATTR_ID_OUTPUT_VALUES) initial = arg.readBigUInt64LE(at + 8);
    if (id === abi.GPIO_V2_LINE_ATTR_ID_DEBOUNCE) debounceUs = arg.readUInt32LE(at + 8);
  }

  const fd = kernel.nextFd++;
  kernel.files.set(fd, { kind: "line", lines, output, nonBlocking: false, edges: 0 });
  for (const line of lines) kernel.requested.add(line);
  if (output) {
    // Without an OUTPUT_VALUES attribute the kernel would keep the old level.
    lines.forEach((l, i) => kernel.levels.set(l, (initial >> BigInt(i)) & 1n ? 1 : 0));
  }
  kernel.log.push({ t: now(), op: "request", lines, flags, debounceUs });
  arg.writeInt32LE(fd, abi.LINE_REQUEST_FD_OFFSET);
}

function lineIoctl(file: Extract<File, { kind: "line" }>, request: number, arg: Buffer): void {
  const bits = arg.readBigUInt64LE(0);
  const mask = arg.readBigUInt64LE(8);
  const masked = file.lines.filter((_, i) => (mask >> BigInt(i)) & 1n);
  if (request === abi.GPIO_V2_LINE_SET_VALUES_IOCTL) {
    if (!file.output) throw new SyscallError("fake SET_VALUES on an input", 1);
    file.lines.forEach((line, i) => {
      if (!((mask >> BigInt(i)) & 1n)) return;
      const value = (bits >> BigInt(i)) & 1n ? 1 : 0;
      kernel.levels.set(line, value);
      kernel.log.push({ t: now(), op: "set", line, value });
    });
    return;
  }
  if (request === abi.GPIO_V2_LINE_GET_VALUES_IOCTL) {
    let out = 0n;
    file.lines.forEach((line, i) => {
      if (!((mask >> BigInt(i)) & 1n)) return;
      // BUSY is low (0) while the panel works; a button idles high (pull-up).
      const value =
        line === BUSY_LINE ? (now() >= kernel.busyUntil ? 1 : 0) : (kernel.levels.get(line) ?? 1);
      if (value) out |= 1n << BigInt(i);
      kernel.log.push({ t: now(), op: "get", line });
    });
    arg.writeBigUInt64LE(out, 0);
    return;
  }
  throw new Error(`fake: line ioctl 0x${request.toString(16)} on ${masked}`);
}

function spiIoctl(request: number, arg: Buffer): void {
  switch (request) {
    case abi.SPI_IOC_WR_MODE:
      kernel.spi.mode = arg[0];
      break;
    case abi.SPI_IOC_WR_BITS_PER_WORD:
      kernel.spi.bits = arg[0];
      break;
    case abi.SPI_IOC_WR_MAX_SPEED_HZ:
      kernel.spi.speedHz = arg.readUInt32LE(0);
      kernel.log.push({ t: now(), op: "spi-config", ...kernel.spi });
      break;
    case abi.SPI_IOC_RD_MODE:
      arg[0] = kernel.spi.mode;
      break;
    case abi.SPI_IOC_RD_BITS_PER_WORD:
      arg[0] = kernel.spi.bits;
      break;
    case abi.SPI_IOC_RD_MAX_SPEED_HZ:
      arg.writeUInt32LE(kernel.spi.speedHz, 0);
      break;
    case abi.SPI_IOC_MESSAGE_1: {
      const memory = kernel.memory.get(arg.readBigUInt64LE(0));
      if (!memory) throw new Error("fake: SPI tx_buf is not native memory");
      const len = arg.readUInt32LE(abi.SPI_TRANSFER_LEN_OFFSET);
      if (len > memory.length) throw new Error("fake: SPI transfer longer than tx_buf");
      const bytes = memory.slice(0, len);
      const dc = kernel.levels.get(DC_LINE) ?? 0;
      kernel.log.push({
        t: now(),
        op: "spi",
        bytes,
        dc,
        speedHz: arg.readUInt32LE(abi.SPI_TRANSFER_SPEED_OFFSET),
        bits: arg.readUInt8(abi.SPI_TRANSFER_BITS_OFFSET),
      });
      const busyMs = dc === 0 && len === 1 ? kernel.busyAfter.get(bytes[0]) : undefined;
      if (busyMs !== undefined) kernel.busyUntil = now() + busyMs;
      break;
    }
    default:
      throw new Error(`fake: spi ioctl 0x${request.toString(16)}`);
  }
}

export function setNonBlocking(fd: number): void {
  const file = kernel.files.get(fd);
  if (file?.kind !== "line") throw new Error(`fake: fcntl on fd ${fd}`);
  file.nonBlocking = true;
  kernel.log.push({ t: now(), op: "nonblocking", lines: file.lines });
}

export function read(fd: number, buf: Buffer): number {
  const file = kernel.files.get(fd);
  if (file?.kind !== "line") throw new Error(`fake: read on fd ${fd}`);
  if (!file.nonBlocking) throw new Error("fake: blocking read on a line fd would hang the process");
  kernel.log.push({ t: now(), op: "read", lines: file.lines });
  let n = 0;
  while (file.edges > 0 && n + abi.LINE_EVENT_SIZE <= buf.length) {
    buf.fill(0, n, n + abi.LINE_EVENT_SIZE);
    buf.writeUInt32LE(abi.GPIO_V2_LINE_EVENT_FALLING_EDGE, n + abi.LINE_EVENT_ID_OFFSET);
    buf.writeUInt32LE(file.lines[0], n + abi.LINE_EVENT_OFFSET_OFFSET);
    file.edges--;
    n += abi.LINE_EVENT_SIZE;
  }
  return n;
}

export interface NativeBuffer {
  address: bigint;
  bytes: Uint8Array;
  free(): void;
}

let nextAddress = 0x1000n;

export function allocNative(size: number): NativeBuffer {
  const address = (nextAddress += 0x10000n);
  const bytes = new Uint8Array(size);
  kernel.memory.set(address, bytes);
  return { address, bytes, free: () => kernel.memory.delete(address) };
}
