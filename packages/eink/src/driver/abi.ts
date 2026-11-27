/**
 * Kernel ABI constants for the GPIO v2 chardev and spidev uAPIs.
 *
 * Values come from <linux/gpio.h> and <linux/spi/spidev.h>. They were checked
 * against the Pi's own headers (arm64, kernel 6.12) by compiling a C program
 * that printed the same sizes, offsets and ioctl numbers.
 */

// --- ioctl encoding (asm-generic, used by arm64 and x86_64) ---
const IOC_WRITE = 1;
const IOC_READ = 2;
const ioc = (dir: number, type: number, nr: number, size: number): number =>
  ((dir << 30) | (size << 16) | (type << 8) | nr) >>> 0;

// --- struct sizes / offsets ---
export const GPIOCHIP_INFO_SIZE = 68; // char name[32]; char label[32]; u32 lines
export const LINE_ATTRIBUTE_SIZE = 16; // u32 id; u32 pad; union { u64 flags|values; u32 debounce }
export const LINE_CONFIG_ATTRIBUTE_SIZE = 24; // attr(16) + u64 mask
export const LINE_CONFIG_SIZE = 272; // u64 flags; u32 num_attrs; u32 pad[5]; attrs[10]
export const LINE_CONFIG_NUM_ATTRS_OFFSET = 8;
export const LINE_CONFIG_ATTRS_OFFSET = 32;
export const LINE_REQUEST_SIZE = 592;
export const LINE_REQUEST_CONSUMER_OFFSET = 256; // after u32 offsets[64]
export const LINE_REQUEST_CONFIG_OFFSET = 288;
export const LINE_REQUEST_NUM_LINES_OFFSET = 560;
export const LINE_REQUEST_EVENT_BUFFER_SIZE_OFFSET = 564;
export const LINE_REQUEST_FD_OFFSET = 588;
export const LINE_VALUES_SIZE = 16; // u64 bits; u64 mask
export const LINE_EVENT_SIZE = 48;
export const LINE_EVENT_ID_OFFSET = 8;
export const LINE_EVENT_OFFSET_OFFSET = 12;
export const SPI_IOC_TRANSFER_SIZE = 32;
export const SPI_TRANSFER_LEN_OFFSET = 16;
export const SPI_TRANSFER_SPEED_OFFSET = 20;
export const SPI_TRANSFER_DELAY_OFFSET = 24;
export const SPI_TRANSFER_BITS_OFFSET = 26;

// --- ioctl numbers ---
const GPIO_MAGIC = 0xb4;
export const GPIO_GET_CHIPINFO_IOCTL = ioc(IOC_READ, GPIO_MAGIC, 0x01, GPIOCHIP_INFO_SIZE);
export const GPIO_V2_GET_LINE_IOCTL = ioc(
  IOC_READ | IOC_WRITE,
  GPIO_MAGIC,
  0x07,
  LINE_REQUEST_SIZE,
);
export const GPIO_V2_LINE_GET_VALUES_IOCTL = ioc(
  IOC_READ | IOC_WRITE,
  GPIO_MAGIC,
  0x0e,
  LINE_VALUES_SIZE,
);
export const GPIO_V2_LINE_SET_VALUES_IOCTL = ioc(
  IOC_READ | IOC_WRITE,
  GPIO_MAGIC,
  0x0f,
  LINE_VALUES_SIZE,
);

const SPI_MAGIC = 0x6b; // 'k'
export const SPI_IOC_MESSAGE_1 = ioc(IOC_WRITE, SPI_MAGIC, 0, SPI_IOC_TRANSFER_SIZE);
export const SPI_IOC_WR_MODE = ioc(IOC_WRITE, SPI_MAGIC, 1, 1);
export const SPI_IOC_WR_BITS_PER_WORD = ioc(IOC_WRITE, SPI_MAGIC, 3, 1);
export const SPI_IOC_WR_MAX_SPEED_HZ = ioc(IOC_WRITE, SPI_MAGIC, 4, 4);
export const SPI_IOC_RD_MODE = ioc(IOC_READ, SPI_MAGIC, 1, 1);
export const SPI_IOC_RD_BITS_PER_WORD = ioc(IOC_READ, SPI_MAGIC, 3, 1);
export const SPI_IOC_RD_MAX_SPEED_HZ = ioc(IOC_READ, SPI_MAGIC, 4, 4);

// --- flags / attribute ids ---
export const GPIO_V2_LINE_FLAG_INPUT = 1n << 2n;
export const GPIO_V2_LINE_FLAG_OUTPUT = 1n << 3n;
export const GPIO_V2_LINE_FLAG_EDGE_FALLING = 1n << 5n;
export const GPIO_V2_LINE_FLAG_BIAS_PULL_UP = 1n << 8n;
export const GPIO_V2_LINE_FLAG_BIAS_PULL_DOWN = 1n << 9n;
export const GPIO_V2_LINE_ATTR_ID_OUTPUT_VALUES = 2;
export const GPIO_V2_LINE_ATTR_ID_DEBOUNCE = 3;
export const GPIO_V2_LINE_EVENT_FALLING_EDGE = 2;

// --- errno / fcntl (asm-generic) ---
export const EBUSY = 16;
export const F_GETFL = 3;
export const F_SETFL = 4;
export const O_NONBLOCK = 0o4000;
