/**
 * Yoga Layout Engine
 *
 * A flexbox layout engine powered by yoga-layout (WebAssembly).
 * Provides full flexbox support including:
 * - Row and column direction
 * - Flex grow/shrink
 * - Flex wrap
 * - Gap between children
 * - Padding
 * - Min/max dimensions
 * - Cross-axis alignment (align)
 * - Main-axis distribution (justify)
 *
 * @see https://yogalayout.dev/
 */

import Yoga, {
  Align,
  FlexDirection,
  Wrap,
  Justify,
  Edge,
  Gutter,
  type Node as YogaNode,
} from "yoga-layout";

import type {
  LayoutEngine,
  LayoutNode,
  LayoutBox,
  LayoutResult,
  LayoutStyle,
} from "./types.ts";

/**
 * Map our align values to Yoga's Align enum.
 */
function mapAlign(align: LayoutStyle["align"]): Align {
  switch (align) {
    case "start":
      return Align.FlexStart;
    case "center":
      return Align.Center;
    case "end":
      return Align.FlexEnd;
    case "stretch":
      return Align.Stretch;
    default:
      return Align.Stretch;
  }
}

/**
 * Map our justify values to Yoga's Justify enum.
 */
function mapJustify(justify: LayoutStyle["justify"]): Justify {
  switch (justify) {
    case "start":
      return Justify.FlexStart;
    case "center":
      return Justify.Center;
    case "end":
      return Justify.FlexEnd;
    case "between":
      return Justify.SpaceBetween;
    default:
      return Justify.FlexStart;
  }
}

/**
 * Map our direction values to Yoga's FlexDirection enum.
 */
function mapDirection(direction: LayoutStyle["direction"]): FlexDirection {
  switch (direction) {
    case "row":
      return FlexDirection.Row;
    case "column":
    default:
      return FlexDirection.Column;
  }
}

/**
 * Map our flexWrap values to Yoga's Wrap enum.
 */
function mapFlexWrap(wrap: LayoutStyle["flexWrap"]): Wrap {
  switch (wrap) {
    case "wrap":
      return Wrap.Wrap;
    case "nowrap":
    default:
      return Wrap.NoWrap;
  }
}

export class YogaLayoutEngine implements LayoutEngine {
  /**
   * Calculate layout for a node tree.
   *
   * Uses yoga-layout to compute flexbox positions for all nodes.
   * Automatically frees yoga nodes after calculation to prevent memory leaks.
   *
   * @example
   * ```typescript
   * const engine = new YogaLayoutEngine();
   * const node: LayoutNode = {
   *   style: { direction: "row", gap: 10, padding: 20 },
   *   children: [
   *     { style: { width: 100 }, children: [] },
   *     { style: { flex: 1 }, children: [] },
   *     { style: { flex: 2 }, children: [] },
   *   ],
   * };
   * const result = engine.calculate(node, { x: 0, y: 0, width: 800, height: 480 });
   * ```
   */
  calculate(node: LayoutNode, container: LayoutBox): LayoutResult {
    // Build yoga tree from our layout nodes
    const yogaRoot = this.buildYogaTree(node);

    // Set root constraints from container
    yogaRoot.setWidth(container.width);
    yogaRoot.setHeight(container.height);

    // Calculate layout
    yogaRoot.calculateLayout(container.width, container.height);

    // Extract results into our format
    const result = this.extractResults(yogaRoot, container.x, container.y);

    // Free yoga nodes to prevent memory leaks
    yogaRoot.freeRecursive();

    return result;
  }

  /**
   * Build a yoga node tree from our layout node tree.
   */
  private buildYogaTree(node: LayoutNode): YogaNode {
    const yogaNode = Yoga.Node.create();
    const { style } = node;

    // Direction
    yogaNode.setFlexDirection(mapDirection(style.direction));

    // Alignment
    yogaNode.setAlignItems(mapAlign(style.align));
    yogaNode.setJustifyContent(mapJustify(style.justify));

    // Flex wrap
    if (style.flexWrap) {
      yogaNode.setFlexWrap(mapFlexWrap(style.flexWrap));
    }

    // Dimensions
    if (style.width !== undefined) {
      yogaNode.setWidth(style.width);
    }
    if (style.height !== undefined) {
      yogaNode.setHeight(style.height);
    }

    // Min/max dimensions
    if (style.minWidth !== undefined) {
      yogaNode.setMinWidth(style.minWidth);
    }
    if (style.maxWidth !== undefined) {
      yogaNode.setMaxWidth(style.maxWidth);
    }
    if (style.minHeight !== undefined) {
      yogaNode.setMinHeight(style.minHeight);
    }
    if (style.maxHeight !== undefined) {
      yogaNode.setMaxHeight(style.maxHeight);
    }

    // Padding
    if (style.padding !== undefined) {
      yogaNode.setPadding(Edge.All, style.padding);
    }

    // Gap
    if (style.gap !== undefined) {
      yogaNode.setGap(Gutter.All, style.gap);
    }

    // Flex grow (support both flex and flexGrow)
    const flexGrow = style.flexGrow ?? style.flex;
    if (flexGrow !== undefined) {
      yogaNode.setFlexGrow(flexGrow);
    }

    // Flex shrink
    if (style.flexShrink !== undefined) {
      yogaNode.setFlexShrink(style.flexShrink);
    }

    // Recursively add children
    for (let i = 0; i < node.children.length; i++) {
      const childYogaNode = this.buildYogaTree(node.children[i]);
      yogaNode.insertChild(childYogaNode, i);
    }

    return yogaNode;
  }

  /**
   * Extract layout results from yoga nodes into our format.
   */
  private extractResults(
    yogaNode: YogaNode,
    offsetX: number,
    offsetY: number,
  ): LayoutResult {
    const box: LayoutBox = {
      x: offsetX + yogaNode.getComputedLeft(),
      y: offsetY + yogaNode.getComputedTop(),
      width: yogaNode.getComputedWidth(),
      height: yogaNode.getComputedHeight(),
    };

    const children: LayoutResult[] = [];
    for (let i = 0; i < yogaNode.getChildCount(); i++) {
      const childYogaNode = yogaNode.getChild(i);
      children.push(this.extractResults(childYogaNode, box.x, box.y));
    }

    return { box, children };
  }
}
