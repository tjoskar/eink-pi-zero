/**
 * The driver and the fake kernel share abi.ts, so a wrong constant would
 * pass every other test. These are the values a C program printed from the
 * Pi's own kernel headers (arm64, kernel 6.12).
 */
import { expect, test } from "vitest";
import * as abi from "./abi.ts";

test("struct sizes and offsets match the kernel headers", () => {
  expect({
    chipInfo: abi.GPIOCHIP_INFO_SIZE,
    lineRequest: abi.LINE_REQUEST_SIZE,
    consumer: abi.LINE_REQUEST_CONSUMER_OFFSET,
    config: abi.LINE_REQUEST_CONFIG_OFFSET,
    numLines: abi.LINE_REQUEST_NUM_LINES_OFFSET,
    eventBufferSize: abi.LINE_REQUEST_EVENT_BUFFER_SIZE_OFFSET,
    fd: abi.LINE_REQUEST_FD_OFFSET,
    lineConfig: abi.LINE_CONFIG_SIZE,
    numAttrs: abi.LINE_CONFIG_NUM_ATTRS_OFFSET,
    attrs: abi.LINE_CONFIG_ATTRS_OFFSET,
    configAttribute: abi.LINE_CONFIG_ATTRIBUTE_SIZE,
    attribute: abi.LINE_ATTRIBUTE_SIZE,
    lineValues: abi.LINE_VALUES_SIZE,
    lineEvent: abi.LINE_EVENT_SIZE,
    eventId: abi.LINE_EVENT_ID_OFFSET,
    eventOffset: abi.LINE_EVENT_OFFSET_OFFSET,
    spiTransfer: abi.SPI_IOC_TRANSFER_SIZE,
    spiLen: abi.SPI_TRANSFER_LEN_OFFSET,
    spiSpeed: abi.SPI_TRANSFER_SPEED_OFFSET,
    spiDelay: abi.SPI_TRANSFER_DELAY_OFFSET,
    spiBits: abi.SPI_TRANSFER_BITS_OFFSET,
  }).toEqual({
    chipInfo: 68,
    lineRequest: 592,
    consumer: 256,
    config: 288,
    numLines: 560,
    eventBufferSize: 564,
    fd: 588,
    lineConfig: 272,
    numAttrs: 8,
    attrs: 32,
    configAttribute: 24,
    attribute: 16,
    lineValues: 16,
    lineEvent: 48,
    eventId: 8,
    eventOffset: 12,
    spiTransfer: 32,
    spiLen: 16,
    spiSpeed: 20,
    spiDelay: 24,
    spiBits: 26,
  });
});

test("ioctl numbers and flags match the kernel headers", () => {
  expect(
    [
      abi.GPIO_GET_CHIPINFO_IOCTL,
      abi.GPIO_V2_GET_LINE_IOCTL,
      abi.GPIO_V2_LINE_GET_VALUES_IOCTL,
      abi.GPIO_V2_LINE_SET_VALUES_IOCTL,
      abi.SPI_IOC_MESSAGE_1,
      abi.SPI_IOC_WR_MODE,
      abi.SPI_IOC_WR_BITS_PER_WORD,
      abi.SPI_IOC_WR_MAX_SPEED_HZ,
      abi.SPI_IOC_RD_MODE,
      abi.SPI_IOC_RD_BITS_PER_WORD,
      abi.SPI_IOC_RD_MAX_SPEED_HZ,
    ].map((n) => n.toString(16)),
  ).toEqual([
    "8044b401",
    "c250b407",
    "c010b40e",
    "c010b40f",
    "40206b00",
    "40016b01",
    "40016b03",
    "40046b04",
    "80016b01",
    "80016b03",
    "80046b04",
  ]);
  expect([
    abi.GPIO_V2_LINE_FLAG_INPUT,
    abi.GPIO_V2_LINE_FLAG_OUTPUT,
    abi.GPIO_V2_LINE_FLAG_EDGE_FALLING,
    abi.GPIO_V2_LINE_FLAG_BIAS_PULL_UP,
    abi.GPIO_V2_LINE_FLAG_BIAS_PULL_DOWN,
  ]).toEqual([0x4n, 0x8n, 0x20n, 0x100n, 0x200n]);
  expect([
    abi.GPIO_V2_LINE_ATTR_ID_OUTPUT_VALUES,
    abi.GPIO_V2_LINE_ATTR_ID_DEBOUNCE,
    abi.GPIO_V2_LINE_EVENT_FALLING_EDGE,
  ]).toEqual([2, 3, 2]);
});
