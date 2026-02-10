/**
 * Simple Layout Engine
 *
 * A lightweight flexbox-inspired layout engine with no external dependencies.
 * Supports the most common layout patterns needed for e-ink dashboards.
 *
 * Features:
 * - Row and column direction
 * - Flex-based sizing
 * - Gap between children
 * - Padding
 * - Cross-axis alignment (align)
 * - Main-axis distribution (justify)
 *
 * Limitations (compared to full flexbox):
 * - No flex-wrap
 * - No flex-shrink or flex-basis
 * - No min/max width/height
 * - No absolute positioning
 *
 * If you need these features, consider swapping to yoga-layout.
 */

import type {
  LayoutEngine,
  LayoutNode,
  LayoutBox,
  LayoutResult,
} from "./types.ts";

export class SimpleLayoutEngine implements LayoutEngine {
  /**
   * Calculate layout for a node tree.
   *
   * The algorithm works in two passes:
   *
   * Pass 1 - Measure fixed sizes:
   *   - Sum up widths/heights of children with explicit dimensions
   *   - Count total flex value of flexible children
   *   - Calculate remaining space after fixed children and gaps
   *
   * Pass 2 - Position children:
   *   - Distribute remaining space to flex children proportionally
   *   - Position each child based on direction, alignment, and justify
   *   - Recursively calculate layout for each child's subtree
   *
   * @example
   * ```typescript
   * const engine = new SimpleLayoutEngine();
   * const node: LayoutNode = {
   *   style: { direction: "row", gap: 10, padding: 20 },
   *   children: [
   *     { style: { width: 100 }, children: [] },
   *     { style: { flex: 1 }, children: [] },
   *     { style: { flex: 2 }, children: [] },
   *   ],
   * };
   * const result = engine.calculate(node, { x: 0, y: 0, width: 800, height: 480 });
   * // Child 0: x=20, width=100 (fixed)
   * // Child 1: x=130, width=216.67 (1/3 of remaining)
   * // Child 2: x=356.67, width=433.33 (2/3 of remaining)
   * ```
   */
  calculate(node: LayoutNode, container: LayoutBox): LayoutResult {
    const { style, children } = node;
    const {
      direction = "column",
      gap = 0,
      padding = 0,
      justify = "start",
      align = "start",
    } = style;

    const isRow = direction === "row";

    // Calculate inner dimensions (after padding)
    const innerWidth = container.width - padding * 2;
    const innerHeight = container.height - padding * 2;

    // If no children, just return the container box
    if (children.length === 0) {
      return { box: container, children: [] };
    }

    // =========================================================================
    // Pass 1: Calculate sizes
    // =========================================================================

    // Calculate total gaps between children
    const totalGaps = Math.max(0, children.length - 1) * gap;

    // Available space on the main axis
    const mainAxisSize = isRow ? innerWidth : innerHeight;
    const crossAxisSize = isRow ? innerHeight : innerWidth;

    // Sum fixed sizes and count flex
    let fixedSize = 0;
    let totalFlex = 0;

    for (const child of children) {
      if (child.style.flex) {
        totalFlex += child.style.flex;
      } else {
        // Get fixed size on main axis
        const size = isRow
          ? (child.style.width ?? 0)
          : (child.style.height ?? 0);
        fixedSize += size;
      }
    }

    // Remaining space for flex children
    const flexSpace = Math.max(0, mainAxisSize - fixedSize - totalGaps);

    // =========================================================================
    // Pass 2: Position children
    // =========================================================================

    // Calculate extra space for justify distribution
    const usedSpace = fixedSize + (totalFlex > 0 ? flexSpace : 0) + totalGaps;
    const extraSpace = Math.max(0, mainAxisSize - usedSpace);

    // Starting offset on main axis
    let mainOffset = padding;

    // Adjust starting offset based on justify
    if (justify === "center") {
      mainOffset += extraSpace / 2;
    } else if (justify === "end") {
      mainOffset += extraSpace;
    }

    // Space between items for justify="between"
    const spaceBetween =
      justify === "between" && children.length > 1
        ? extraSpace / (children.length - 1)
        : 0;

    // Calculate layout for each child
    const childResults: LayoutResult[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childStyle = child.style;

      // Calculate child size on main axis
      let childMainSize: number;
      if (childStyle.flex && totalFlex > 0) {
        // Flex child: distribute proportionally
        childMainSize = (flexSpace * childStyle.flex) / totalFlex;
      } else {
        // Fixed child: use specified size or default
        childMainSize = isRow
          ? (childStyle.width ?? 100)
          : (childStyle.height ?? 50);
      }

      // Calculate child size on cross axis
      const childCrossSize = isRow
        ? (childStyle.height ?? crossAxisSize)
        : (childStyle.width ?? crossAxisSize);

      // Calculate cross-axis offset based on alignment
      let crossOffset = padding;
      if (align === "center") {
        crossOffset += (crossAxisSize - childCrossSize) / 2;
      } else if (align === "end") {
        crossOffset += crossAxisSize - childCrossSize;
      }

      // Build child box
      const childBox: LayoutBox = isRow
        ? {
            x: container.x + mainOffset,
            y: container.y + crossOffset,
            width: childMainSize,
            height: childCrossSize,
          }
        : {
            x: container.x + crossOffset,
            y: container.y + mainOffset,
            width: childCrossSize,
            height: childMainSize,
          };

      // Recursively calculate child layout
      const childResult = this.calculate(child, childBox);
      childResults.push(childResult);

      // Advance offset for next child
      mainOffset += childMainSize + gap + spaceBetween;
    }

    return {
      box: container,
      children: childResults,
    };
  }
}
