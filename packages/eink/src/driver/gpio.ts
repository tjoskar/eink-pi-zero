/**
 * GPIO v2 chardev: request lines, set/get values, read edge events.
 */
import * as abi from "./abi.ts";
import * as sys from "./syscalls.ts";

const CHIP = "/dev/gpiochip0";
/** The Pi Zero 2 W's GPIO controller. Anything else is refused. */
const EXPECTED_LABEL = "pinctrl-bcm2835";

export function assertExpectedChip(): void {
  const fd = sys.open(CHIP, "r");
  try {
    const buf = Buffer.alloc(abi.GPIOCHIP_INFO_SIZE);
    sys.ioctl(fd, abi.GPIO_GET_CHIPINFO_IOCTL, buf);
    const label = buf.toString("latin1", 32, 64).replace(/\0.*$/s, "");
    if (label !== EXPECTED_LABEL) {
      throw new Error(`${CHIP} is "${label}", expected "${EXPECTED_LABEL}". Refusing to continue.`);
    }
  } finally {
    sys.close(fd);
  }
}

/** Another process (or this one, elsewhere) already holds one of the lines. */
export class LinesBusyError extends Error {
  constructor(offsets: number[], options: ErrorOptions) {
    super(
      `GPIO ${offsets.join(", ")} busy: already in use by another process or this one`,
      options,
    );
  }
}

export type LineConfig =
  | { direction: "output" }
  | { direction: "input"; bias: "pull-up" | "pull-down"; fallingEdge?: { debounceUs: number } };

/**
 * One kernel line request (one fd) for one or more lines with the same
 * config. Outputs always start low.
 */
export class LineRequest {
  readonly #fd: number;
  readonly #offsets: readonly number[];
  #released = false;

  constructor(offsets: number[], config: LineConfig) {
    this.#offsets = offsets;
    const req = Buffer.alloc(abi.LINE_REQUEST_SIZE);
    offsets.forEach((o, i) => req.writeUInt32LE(o, i * 4));
    req.write("eink", abi.LINE_REQUEST_CONSUMER_OFFSET, "latin1");

    const allLines = (1n << BigInt(offsets.length)) - 1n;
    const attrs: { id: number; write: (at: number) => void }[] = [];
    let flags: bigint;
    if (config.direction === "output") {
      flags = abi.GPIO_V2_LINE_FLAG_OUTPUT;
      // Explicitly low, so a line is never driven high before we say so.
      attrs.push({
        id: abi.GPIO_V2_LINE_ATTR_ID_OUTPUT_VALUES,
        write: (at) => req.writeBigUInt64LE(0n, at),
      });
    } else {
      flags =
        abi.GPIO_V2_LINE_FLAG_INPUT |
        (config.bias === "pull-up"
          ? abi.GPIO_V2_LINE_FLAG_BIAS_PULL_UP
          : abi.GPIO_V2_LINE_FLAG_BIAS_PULL_DOWN);
      if (config.fallingEdge) {
        flags |= abi.GPIO_V2_LINE_FLAG_EDGE_FALLING;
        const { debounceUs } = config.fallingEdge;
        attrs.push({
          id: abi.GPIO_V2_LINE_ATTR_ID_DEBOUNCE,
          write: (at) => req.writeUInt32LE(debounceUs, at),
        });
      }
    }

    const cfg = abi.LINE_REQUEST_CONFIG_OFFSET;
    req.writeBigUInt64LE(flags, cfg);
    req.writeUInt32LE(attrs.length, cfg + abi.LINE_CONFIG_NUM_ATTRS_OFFSET);
    attrs.forEach((attr, i) => {
      const at = cfg + abi.LINE_CONFIG_ATTRS_OFFSET + i * abi.LINE_CONFIG_ATTRIBUTE_SIZE;
      req.writeUInt32LE(attr.id, at);
      attr.write(at + 8); // the attribute's value union
      req.writeBigUInt64LE(allLines, at + 16); // which lines it applies to
    });
    req.writeUInt32LE(offsets.length, abi.LINE_REQUEST_NUM_LINES_OFFSET);

    const chip = sys.open(CHIP, "r");
    try {
      sys.ioctl(chip, abi.GPIO_V2_GET_LINE_IOCTL, req);
    } catch (err) {
      if (err instanceof sys.SyscallError && err.errno === abi.EBUSY) {
        throw new LinesBusyError(offsets, { cause: err });
      }
      throw err;
    } finally {
      sys.close(chip);
    }
    this.#fd = req.readInt32LE(abi.LINE_REQUEST_FD_OFFSET);
    if (config.direction === "input" && config.fallingEdge) {
      try {
        sys.setNonBlocking(this.#fd);
      } catch (err) {
        sys.close(this.#fd);
        throw err;
      }
    }
  }

  #bit(offset: number): bigint {
    const i = this.#offsets.indexOf(offset);
    if (i < 0) throw new Error(`GPIO ${offset} is not part of this request`);
    return 1n << BigInt(i);
  }

  set(offset: number, value: 0 | 1): void {
    if (this.#released) throw new Error("GPIO lines already released");
    const bit = this.#bit(offset);
    const buf = Buffer.alloc(abi.LINE_VALUES_SIZE);
    buf.writeBigUInt64LE(value ? bit : 0n, 0);
    buf.writeBigUInt64LE(bit, 8);
    sys.ioctl(this.#fd, abi.GPIO_V2_LINE_SET_VALUES_IOCTL, buf);
  }

  get(offset: number): 0 | 1 {
    if (this.#released) throw new Error("GPIO lines already released");
    const bit = this.#bit(offset);
    const buf = Buffer.alloc(abi.LINE_VALUES_SIZE);
    buf.writeBigUInt64LE(bit, 8);
    sys.ioctl(this.#fd, abi.GPIO_V2_LINE_GET_VALUES_IOCTL, buf);
    return buf.readBigUInt64LE(0) & bit ? 1 : 0;
  }

  /** Falling edges since the last call, without waiting (the fd is non-blocking). */
  readFallingEdges(): number {
    if (this.#released) return 0;
    const buf = Buffer.alloc(abi.LINE_EVENT_SIZE * 16);
    let edges = 0;
    for (let n = sys.read(this.#fd, buf); n > 0; n = sys.read(this.#fd, buf)) {
      for (let at = 0; at + abi.LINE_EVENT_SIZE <= n; at += abi.LINE_EVENT_SIZE) {
        if (
          buf.readUInt32LE(at + abi.LINE_EVENT_ID_OFFSET) === abi.GPIO_V2_LINE_EVENT_FALLING_EDGE
        ) {
          edges++;
        }
      }
    }
    return edges;
  }

  /** Close the fd. Outputs keep their last level, so drive them low first. */
  release(): void {
    if (this.#released) return;
    this.#released = true;
    sys.close(this.#fd);
  }
}
