/**
 * PNG (800x480) to the bytes the panel takes, the same as the Python
 * driver's getbuffer() and getbuffer_4Gray() + display_4Gray() produce
 * (checked byte for byte by the golden tests).
 */
import { PNG } from "pngjs";
import { HEIGHT, PLANE_SIZE, WIDTH } from "./epd.ts";

function decode(png: Uint8Array): Uint8Array {
  const image = PNG.sync.read(Buffer.from(png.buffer, png.byteOffset, png.byteLength));
  if (image.width !== WIDTH || image.height !== HEIGHT) {
    throw new Error(`image is ${image.width}x${image.height}, the panel is ${WIDTH}x${HEIGHT}`);
  }
  return image.data; // RGBA
}

const clip8 = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : v);

/**
 * A 1-bit frame, bit set = black. Pillow's convert("1"): luminance
 * 299/587/114, then Floyd–Steinberg as in Convert.c's tobilevel.
 */
export function toMonoFrame(png: Uint8Array): Uint8Array {
  const rgba = decode(png);
  const out = new Uint8Array(PLANE_SIZE);
  const errors = new Int32Array(WIDTH + 1);
  for (let y = 0; y < HEIGHT; y++) {
    let l = 0;
    let l0 = 0;
    let l1 = 0;
    for (let x = 0; x < WIDTH; x++) {
      const p = (y * WIDTH + x) * 4;
      const lum = Math.trunc((rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000);
      l = clip8(lum + Math.trunc((l + errors[x + 1]) / 16));
      const white = l > 128;
      if (!white) out[y * (WIDTH / 8) + (x >> 3)] |= 0x80 >> (x & 7);
      // Spread the error: 7/16 right, 3/16, 5/16 and 1/16 to the next row.
      l -= white ? 255 : 0;
      const l2 = l;
      const d2 = l + l;
      l += d2;
      errors[x] = l + l0;
      l += d2;
      l0 = l + l1;
      l1 = l2;
      l += d2;
    }
    errors[WIDTH] = l0;
  }
  return out;
}

/** Pillow's RGB to L (Convert.c L24, rounded). */
const toL = (r: number, g: number, b: number) => (r * 19595 + g * 38470 + b * 7471 + 0x8000) >>> 16;

/** Nearest of the four levels: 0 black, 1 dark gray, 2 light gray, 3 white. */
const LEVEL = new Uint8Array(256).map((_, l) => (l < 43 ? 0 : l < 128 ? 1 : l < 213 ? 2 : 3));
/** Each level's bit in the two planes, as display_4Gray sends them. */
const PLANE10_BIT = [1, 0, 1, 0];
const PLANE13_BIT = [1, 1, 0, 0];

/** The two 4-gray planes. Every pixel becomes its nearest level (no dithering). */
export function toGray4Planes(png: Uint8Array): { plane10: Uint8Array; plane13: Uint8Array } {
  const rgba = decode(png);
  const plane10 = new Uint8Array(PLANE_SIZE);
  const plane13 = new Uint8Array(PLANE_SIZE);
  for (let byte = 0; byte < PLANE_SIZE; byte++) {
    let a = 0;
    let b = 0;
    for (let bit = 0; bit < 8; bit++) {
      const p = (byte * 8 + bit) * 4;
      const level = LEVEL[toL(rgba[p], rgba[p + 1], rgba[p + 2])];
      a = (a << 1) | PLANE10_BIT[level];
      b = (b << 1) | PLANE13_BIT[level];
    }
    plane10[byte] = a;
    plane13[byte] = b;
  }
  return { plane10, plane13 };
}
