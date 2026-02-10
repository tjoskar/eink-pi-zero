/**
 * E-Ink JSX Library
 *
 * A TSX framework for rendering to e-ink displays.
 * Designed for low-resource environments like Raspberry Pi Zero.
 *
 * Features:
 * - TSX syntax for declarative UI
 * - Flexbox-inspired layout (row, column, flex, gap, padding)
 * - Text rendering with custom fonts
 * - Material Icons support
 * - Image loading from local files
 * - PNG export for development preview
 *
 * @example Basic usage
 * ```tsx
 * import {
 *   render,
 *   createCanvas,
 *   registerFont,
 *   registerIconFont,
 *   Icon,
 * } from "./mod.ts";
 * import { EPDMockScreen } from "../../lib/epd_mock.ts";
 *
 * // 1. Register fonts (before rendering)
 * registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
 * registerIconFont();
 *
 * // 2. Define components
 * function Card({ title, value, icon }: CardProps) {
 *   return (
 *     <view flex={1} background="lightGray" padding={16} direction="column" gap={8}>
 *       <view direction="row" gap={8} align="center">
 *         <Icon name={icon} size={24} />
 *         <text font="16px Noto Sans">{title}</text>
 *       </view>
 *       <text font="32px Noto Sans">{value}</text>
 *     </view>
 *   );
 * }
 *
 * function Dashboard() {
 *   return (
 *     <view width={800} height={480} padding={20} direction="column" gap={20}>
 *       <text font="bold 32px Noto Sans">E-Ink Dashboard</text>
 *       <view direction="row" gap={20} flex={1}>
 *         <Card title="Temperature" value="-3°C" icon="thermostat" />
 *         <Card title="Electricity" value="0.85 kr" icon="bolt" />
 *       </view>
 *     </view>
 *   );
 * }
 *
 * // 3. Render
 * async function main() {
 *   const canvas = createCanvas(800, 480);
 *   await render(<Dashboard />, canvas);
 *
 *   // For development: save to PNG
 *   const screen = new EPDMockScreen("./output.png");
 *   await screen.render(canvas);
 *
 *   // For production: send to real display
 *   // const screen = new EPD7in5Screen();
 *   // await screen.init();
 *   // await screen.render(canvas);
 *   // await screen.sleep();
 * }
 *
 * main();
 * ```
 *
 * @example Some of the available elements
 * ```tsx
 * // Container with layout
 * <view
 *   width={100}           // Fixed width
 *   height={50}           // Fixed height
 *   flex={1}              // Flex grow
 *   direction="row"       // "row" | "column"
 *   gap={10}              // Gap between children
 *   padding={20}          // Inner padding
 *   align="center"        // "start" | "center" | "end"
 *   justify="between"     // "start" | "center" | "end" | "between"
 *   background="white"    // Background color
 * >
 *   {children}
 * </view>
 *
 * // Text with styling
 * <text
 *   font="bold 24px Arial"  // CSS font string
 *   color="black"           // Text color
 * >
 *   Hello World
 * </text>
 *
 * // Image from file
 * <image
 *   src="./logo.png"      // File path
 *   width={100}           // Display width
 *   height={50}           // Display height
 * />
 *
 * // Material Icon
 * <Icon
 *   name="home"           // Icon name
 *   size={32}             // Icon size
 *   color="black"         // Icon color
 * />
 * ```
 *
 * @example Swapping layout engine
 * ```typescript
 * import { setLayoutEngine } from "./mod.ts";
 * import { YogaLayoutEngine } from "./layout/yoga-engine.ts";
 *
 * // Use yoga for full flexbox support
 * const yoga = await YogaLayoutEngine.create();
 * setLayoutEngine(yoga);
 * ```
 *
 * @module
 */

// =============================================================================
// Canvas
// =============================================================================

export { createCanvas } from "./canvas/index.ts";
export type { Canvas as ICanvas, ImageData } from "./canvas/types.ts";

// =============================================================================
// Fonts
// =============================================================================

export {
  registerFont,
  registerIconFont,
  ICON_FONT_FAMILY,
} from "./canvas/register-font.ts";
export type { FontOptions } from "./canvas/register-font.ts";

// =============================================================================
// Theme
// =============================================================================

export {
  setTheme,
  getTheme,
  resolveColor,
  buildFontString,
  EINK_BW_THEME,
  EINK_COLOR_THEME,
} from "./theme/index.ts";
export type {
  Theme,
  Color,
  EinkBWColor,
  EinkColorPalette,
} from "./theme/index.ts";

// =============================================================================
// Render
// =============================================================================

export { render } from "./runtime/render.ts";

// =============================================================================
// Components
// =============================================================================

export { Icon } from "./components/icon.tsx";
export type { IconProps } from "./components/icon.tsx";
export { LineChart } from "./components/line-chart.tsx";
export type { LineChartProps } from "./components/line-chart.tsx";
export { ICON_CODEPOINTS, getIconChar } from "./components/icons-name.ts";

// =============================================================================
// Layout (for advanced usage)
// =============================================================================

export {
  setLayoutEngine,
  getLayoutEngine,
  SimpleLayoutEngine,
} from "./layout/index.ts";
export type {
  LayoutEngine,
  LayoutNode,
  LayoutBox,
  LayoutResult,
  LayoutStyle,
} from "./layout/types.ts";

// =============================================================================
// JSX Runtime (usually not needed directly)
// =============================================================================

export { jsx, jsxs, Fragment } from "./runtime/jsx-runtime.ts";
export type {
  JSXElement,
  JSXChildren,
  ViewProps,
  TextProps,
  ImageProps,
} from "./runtime/types.ts";
