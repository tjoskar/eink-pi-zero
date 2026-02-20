/**
 * Layout Engine Factory
 *
 * Provides access to the layout engine powered by yoga-layout.
 * Yoga provides full CSS flexbox support including:
 * - Flex grow/shrink
 * - Flex wrap
 * - Min/max dimensions
 * - Automatic content sizing
 *
 * @example Using the layout engine
 * ```typescript
 * import { getLayoutEngine } from "./index.ts";
 *
 * const engine = getLayoutEngine();
 * const result = engine.calculate(node, container);
 * ```
 */

import { YogaLayoutEngine } from "./yoga-engine.ts";
import type { LayoutEngine } from "./types.ts";

export type {
  LayoutEngine,
  LayoutNode,
  LayoutBox,
  LayoutResult,
  LayoutStyle,
} from "./types.ts";
export { YogaLayoutEngine } from "./yoga-engine.ts";

let currentEngine: LayoutEngine | null = null;

/**
 * Get the current layout engine.
 * Returns YogaLayoutEngine by default.
 */
export function getLayoutEngine(): LayoutEngine {
  if (!currentEngine) {
    currentEngine = new YogaLayoutEngine();
  }
  return currentEngine;
}

/**
 * Set a custom layout engine.
 *
 * @param engine - The layout engine to use for all subsequent renders
 */
export function setLayoutEngine(engine: LayoutEngine): void {
  currentEngine = engine;
}
