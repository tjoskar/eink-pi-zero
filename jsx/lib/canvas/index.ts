/**
 *
 * @example
 * ```typescript
 * import { createCanvas } from "./index.ts";
 *
 * const canvas = createCanvas(800, 480);
 * canvas.fillText("Hello", 100, 100);
 * ```
 */

import { NapiCanvas, DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./napi-canvas.ts";
import type { Canvas } from "./types.ts";

export type { Canvas, ImageData } from "./types.ts";
export { NapiCanvas, DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./napi-canvas.ts";

/**
 * Create a new canvas instance.
 *
 * @param width - Canvas width in pixels (default: 800)
 * @param height - Canvas height in pixels (default: 480)
 * @returns A new canvas instance
 */
export function createCanvas(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): Canvas {
  return new NapiCanvas(width, height);
}
