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
 * These properties are inspired by CSS Flexbox and powered by yoga-layout.
 * Supports the most common flexbox properties needed for e-ink dashboards.
 */
export interface LayoutStyle {
  /** Fixed width in pixels. If not set, width is calculated automatically. */
  width?: number;

  /** Fixed height in pixels. If not set, height is calculated automatically. */
  height?: number;

  /** Minimum width in pixels. */
  minWidth?: number;

  /** Maximum width in pixels. */
  maxWidth?: number;

  /** Minimum height in pixels. */
  minHeight?: number;

  /** Maximum height in pixels. */
  maxHeight?: number;

  /** Padding on all sides in pixels. Applied inside the element's box. */
  padding?: number;

  /** Gap between children in pixels. Similar to CSS gap property. */
  gap?: number;

  /**
   * Flex grow factor. Elements with flexGrow will share remaining space proportionally.
   * @example Two children with flexGrow={1} each get 50% of remaining space
   * @example Child with flexGrow={2} gets twice as much space as child with flexGrow={1}
   */
  flex?: number;

  /**
   * Flex grow factor. Alias for flex.
   */
  flexGrow?: number;

  /**
   * Flex shrink factor. Determines how much an element shrinks relative to others
   * when there isn't enough space.
   * @default 1
   */
  flexShrink?: number;

  /**
   * Whether children should wrap to new lines when they overflow.
   * - "nowrap": All children on one line (default)
   * - "wrap": Wrap to new lines
   * @default "nowrap"
   */
  flexWrap?: "nowrap" | "wrap";

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
   * - "stretch": Stretch to fill (default)
   * @default "stretch"
   */
  align?: "start" | "center" | "end" | "stretch";

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
