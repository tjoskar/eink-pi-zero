/**
 * A positioned box with x, y coordinates and dimensions.
 * All values are in pixels.
 */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Style properties that affect layout calculation.
 *
 * These properties are inspired by CSS Flexbox but simplified for e-ink use cases.
 * Not all CSS flexbox properties are supported - only the most commonly needed ones.
 */
export interface LayoutStyle {
  /** Fixed width in pixels. If not set, width is calculated from flex or defaults to container width. */
  width?: number;

  /** Fixed height in pixels. If not set, height is calculated from flex or defaults to content height. */
  height?: number;

  /** Padding on all sides in pixels. Applied inside the element's box. */
  padding?: number;

  /** Gap between children in pixels. Similar to CSS gap property. */
  gap?: number;

  /**
   * Flex grow factor. Elements with flex will share remaining space proportionally.
   * @example Two children with flex={1} each get 50% of remaining space
   * @example Child with flex={2} gets twice as much space as child with flex={1}
   */
  flex?: number;

  /**
   * Direction of child layout.
   * - "row": Children are laid out horizontally (left to right)
   * - "column": Children are laid out vertically (top to bottom)
   * @default "column"
   */
  direction?: "row" | "column";

  /**
   * Alignment of children on the cross axis.
   * For direction="row", this is vertical alignment.
   * For direction="column", this is horizontal alignment.
   * - "start": Align to start (top or left)
   * - "center": Center children
   * - "end": Align to end (bottom or right)
   * @default "start"
   */
  align?: "start" | "center" | "end";

  /**
   * Distribution of children on the main axis.
   * For direction="row", this is horizontal distribution.
   * For direction="column", this is vertical distribution.
   * - "start": Pack children at the start
   * - "center": Center children
   * - "end": Pack children at the end
   * - "between": Distribute with space between (first and last touch edges)
   * @default "start"
   */
  justify?: "start" | "center" | "end" | "between";
}

/**
 * A node in the layout tree.
 * Contains style information and child nodes.
 */
export interface LayoutNode {
  style: LayoutStyle;
  children: LayoutNode[];
}

/**
 * Result of layout calculation.
 * Contains the computed box and results for all children.
 */
export interface LayoutResult {
  box: LayoutBox;
  children: LayoutResult[];
}

/**
 * Interface for layout engines.
 *
 * Implement this interface to create a custom layout engine.
 * The engine takes a tree of LayoutNodes and computes their positions.
 */
export interface LayoutEngine {
  /**
   * Calculate layout for a node tree within a container.
   *
   * @param node - The root node to lay out
   * @param container - The bounding box to lay out within
   * @returns Computed layout with positions for all nodes
   */
  calculate(node: LayoutNode, container: LayoutBox): LayoutResult;
}
