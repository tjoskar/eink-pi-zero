/**
 * Layout Engine Factory
 *
 * Provides access to the current layout engine and allows swapping engines.
 *
 * @example Using the default engine
 * ```typescript
 * import { getLayoutEngine } from "./index.ts";
 *
 * const engine = getLayoutEngine();
 * const result = engine.calculate(node, container);
 * ```
 *
 * @example Swapping to a custom engine
 * ```typescript
 * import { setLayoutEngine } from "./index.ts";
 * import { YogaLayoutEngine } from "./yoga-engine.ts";
 *
 * // Yoga provides full flexbox support
 * const yoga = await YogaLayoutEngine.create();
 * setLayoutEngine(yoga);
 *
 * // All subsequent renders will use yoga
 * ```
 */

import { SimpleLayoutEngine } from "./simple-engine.ts";
import type { LayoutEngine } from "./types.ts";

export type {
  LayoutEngine,
  LayoutNode,
  LayoutBox,
  LayoutResult,
  LayoutStyle,
} from "./types.ts";
export { SimpleLayoutEngine } from "./simple-engine.ts";

// Default engine instance
let currentEngine: LayoutEngine = new SimpleLayoutEngine();

/**
 * Get the current layout engine.
 * Returns SimpleLayoutEngine by default.
 */
export function getLayoutEngine(): LayoutEngine {
  return currentEngine;
}

/**
 * Set a custom layout engine.
 * Use this to swap to yoga-layout or another implementation.
 *
 * @param engine - The layout engine to use for all subsequent renders
 */
export function setLayoutEngine(engine: LayoutEngine): void {
  currentEngine = engine;
}
