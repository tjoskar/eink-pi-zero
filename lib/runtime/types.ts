/**
 * JSX Runtime Types
 *
 * Defines the element types and props for the JSX framework.
 * These types are used by both the JSX factory and the render function.
 */

import type { LayoutStyle } from "../layout/types.ts";
import type { Color } from "../theme.ts";

// =============================================================================
// JSX Node Types
// =============================================================================

/** Primitive types that can appear as children */
export type JSXChild = JSXElement | string | number | null | undefined;

/** Children can be a single child or an array */
export type JSXChildren = JSXChild | JSXChild[];

/** A JSX element with type, props, and resolved children */
export interface JSXElement {
  type: string | ComponentFunction;
  props: ElementProps;
}

/** A function component */
export type ComponentFunction = (props: Record<string, unknown>) => JSXElement | Promise<JSXElement>;

// =============================================================================
// Element Props
// =============================================================================

/** Base props shared by all elements */
export interface BaseProps extends LayoutStyle {
  /** Child elements */
  children?: JSXChildren;

  /** Background color */
  background?: Color;
}

/** Props for <view> elements */
export interface ViewProps extends BaseProps {
  // View uses all base props
}

/** Props for <text> elements */
export interface TextProps extends BaseProps {
  /**
   * Font size in pixels.
   * Uses theme's defaultFontSize if not specified.
   * @example size={24}
   */
  size?: number;

  /**
   * Font family name.
   * Uses theme's defaultFont if not specified.
   * @example font="Roboto"
   */
  font?: string;

  /**
   * Font weight.
   * @example weight="bold"
   */
  weight?: "normal" | "bold";

  /**
   * Text color.
   * Uses theme colors for type safety, but also accepts any CSS color string.
   * @example color="black" or color="#FF0000"
   */
  color?: Color;

  /**
   * Horizontal text alignment within the element's box.
   * Only has effect when the element has a known width (explicit or stretched).
   * @example textAlign="center"
   */
  textAlign?: "left" | "center" | "right";
}

/** Props for <image> elements */
export interface ImageProps extends BaseProps {
  /** Path to the image file */
  src: string;
}

/** Props for <linechart> elements */
export interface LineChartProps extends BaseProps {
  /** Array of data values to plot */
  data: number[];

  /** Index of the data point to mark/highlight */
  markedIndex?: number;

  /** Number of labels to show on X axis (evenly distributed) */
  xLabelCount?: number;

  /** Number of labels to show on Y axis (evenly distributed from min to max) */
  yLabelCount?: number;

  /** Custom labels for X axis (overrides xLabelCount) */
  xLabels?: string[];

  /** Show axis lines (default: true). Labels are still shown when false. */
  showAxisLines?: boolean;

  /** Use step interpolation — flat lines with 90° jumps between points */
  stepLine?: boolean;
}

/** Union of all element props */
export type ElementProps = ViewProps | TextProps | ImageProps | LineChartProps;

// =============================================================================
// JSX Namespace Declaration
// =============================================================================

/**
 * Declares the JSX namespace for TypeScript.
 *
 * This tells TypeScript:
 * - What elements are valid (<view>, <text>, <image>)
 * - What props each element accepts
 * - That JSX expressions return JSXElement
 */
declare global {
  namespace JSX {
    // The type returned by JSX expressions (includes Promise for async components)
    type Element = JSXElement | Promise<JSXElement>;

    // Props for intrinsic elements (lowercase tags)
    interface IntrinsicElements {
      /**
       * Container element for layout.
       *
       * @example
       * ```tsx
       * <view direction="row" gap={10} padding={20}>
       *   <text>Left</text>
       *   <text>Right</text>
       * </view>
       * ```
       */
      view: ViewProps;

      /**
       * Text element for rendering strings.
       *
       * @example
       * ```tsx
       * // Simple text with default font
       * <text size={24} color="black">Hello World</text>
       *
       * // Bold text
       * <text size={32} weight="bold">Title</text>
       *
       * // Custom font family
       * <text size={16} font="Roboto" color="gray">Subtitle</text>
       * ```
       */
      text: TextProps;

      /**
       * Image element for rendering images from files.
       *
       * @example
       * ```tsx
       * <image src="./logo.png" width={100} height={50} />
       * ```
       */
      image: ImageProps;

      /**
       * Line chart element for rendering data as a line graph.
       *
       * @example
       * ```tsx
       * <linechart
       *   data={[10, 25, 18, 42, 35]}
       *   width={400}
       *   height={200}
       *   markedIndex={3}
       *   xLabelCount={3}
       *   yLabelCount={4}
       * />
       * ```
       */
      linechart: LineChartProps;
    }
  }
}
