/**
 * spidev: mode 0, 8 bits, 4 MHz, one SPI_IOC_MESSAGE(1) per transfer.
 */
import * as abi from "./abi.ts";
import * as sys from "./syscalls.ts";

/** spidev's default bufsiz: the largest single transfer. */
export const MAX_TRANSFER = 4096;
const DEVICE = "/dev/spidev0.0";
const MODE = 0;
const BITS = 8;
const SPEED_HZ = 4_000_000;

export class Spi {
  readonly #fd: number;
  readonly #tx: sys.NativeBuffer;
  readonly #xfer = Buffer.alloc(abi.SPI_IOC_TRANSFER_SIZE);

  constructor() {
    this.#fd = sys.open(DEVICE, "r+");
    this.#tx = sys.allocNative(MAX_TRANSFER);
    try {
      sys.ioctl(this.#fd, abi.SPI_IOC_WR_MODE, Buffer.of(MODE));
      sys.ioctl(this.#fd, abi.SPI_IOC_WR_BITS_PER_WORD, Buffer.of(BITS));
      const speed = Buffer.alloc(4);
      speed.writeUInt32LE(SPEED_HZ);
      sys.ioctl(this.#fd, abi.SPI_IOC_WR_MAX_SPEED_HZ, speed);
      this.#assertConfig();
    } catch (err) {
      this.close();
      throw err;
    }
  }

  /** Read back what the driver actually has; refuse to talk to the panel otherwise. */
  #assertConfig(): void {
    const mode = Buffer.alloc(1);
    const bits = Buffer.alloc(1);
    const speed = Buffer.alloc(4);
    sys.ioctl(this.#fd, abi.SPI_IOC_RD_MODE, mode);
    sys.ioctl(this.#fd, abi.SPI_IOC_RD_BITS_PER_WORD, bits);
    sys.ioctl(this.#fd, abi.SPI_IOC_RD_MAX_SPEED_HZ, speed);
    if (mode[0] !== MODE || bits[0] !== BITS || speed.readUInt32LE(0) !== SPEED_HZ) {
      throw new Error(
        `SPI config did not stick: mode ${mode[0]}, ${bits[0]} bits, ${speed.readUInt32LE(0)} Hz`,
      );
    }
  }

  /** One synchronous transfer of at most MAX_TRANSFER bytes. The caller sets DC first. */
  transfer(data: Uint8Array): void {
    if (data.length > MAX_TRANSFER) {
      throw new Error(`SPI transfer of ${data.length} bytes, max is ${MAX_TRANSFER}`);
    }
    this.#tx.bytes.set(data);
    this.#xfer.fill(0);
    this.#xfer.writeBigUInt64LE(this.#tx.address, 0); // tx_buf; rx_buf stays 0
    this.#xfer.writeUInt32LE(data.length, abi.SPI_TRANSFER_LEN_OFFSET);
    this.#xfer.writeUInt32LE(SPEED_HZ, abi.SPI_TRANSFER_SPEED_OFFSET);
    this.#xfer.writeUInt8(BITS, abi.SPI_TRANSFER_BITS_OFFSET);
    sys.ioctl(this.#fd, abi.SPI_IOC_MESSAGE_1, this.#xfer);
  }

  close(): void {
    sys.close(this.#fd);
    this.#tx.free();
  }
}
