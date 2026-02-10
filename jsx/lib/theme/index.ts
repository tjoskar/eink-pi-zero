/**
 * Theme System
 *
 * Provides theming support for the JSX framework with:
 * - Default font configuration
 * - Color palettes for different display types
 * - Type-safe color values
 *
 * @example Basic usage
 * ```typescript
 * import { setTheme, EINK_BW_THEME } from "./theme/index.ts";
 *
 * // Use black & white e-ink theme (default)
 * setTheme(EINK_BW_THEME);
 *
 * // Or create a custom theme for color e-ink
 * setTheme({
 *   defaultFont: "Noto Sans",
 *   colors: {
 *     black: "#000000",
 *     white: "#FFFFFF",
 *     red: "#FF0000",
 *     yellow: "#FFFF00",
 *   },
 * });
 * ```
 */

// =============================================================================
// Color Palette Types
// =============================================================================

/**
 * Standard e-ink black & white colors.
 * 4 grayscale levels: black (0), darkGray (85), lightGray (170), white (255)
 */
export type EinkBWColor = "black" | "darkGray" | "lightGray" | "white";

/**
 * Extended colors for 7-color e-ink displays (e.g., Waveshare 7-color).
 */
export type EinkColorPalette =
  | EinkBWColor
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "orange";

/**
 * Color type that can be either a palette color or a custom hex value.
 * Use palette colors for best e-ink compatibility.
 */
export type Color = EinkBWColor | EinkColorPalette | (string & {});

// =============================================================================
// Theme Configuration
// =============================================================================

/**
 * Theme configuration for the JSX framework.
 */
export interface Theme<TColor extends string = EinkBWColor> {
  /** Default font family used when no font is specified */
  defaultFont: string;

  /** Default font size in pixels */
  defaultFontSize: number;

  /** Available colors and their hex values */
  colors: Record<TColor, string>;
}

/**
 * Pre-configured theme for black & white e-ink displays.
 * Supports 4 grayscale levels commonly available on e-ink screens.
 */
export const EINK_BW_THEME: Theme<EinkBWColor> = {
  defaultFont: "Noto Sans",
  defaultFontSize: 16,
  colors: {
    black: "#000000",    // 0
    darkGray: "#555555", // 85
    lightGray: "#AAAAAA", // 170
    white: "#FFFFFF",    // 255
  },
};

/**
 * Pre-configured theme for 7-color e-ink displays.
 * Includes the standard colors available on Waveshare 7-color e-ink.
 */
export const EINK_COLOR_THEME: Theme<EinkColorPalette> = {
  defaultFont: "Noto Sans",
  defaultFontSize: 16,
  colors: {
    black: "#000000",    // 0
    darkGray: "#555555", // 85
    lightGray: "#AAAAAA", // 170
    white: "#FFFFFF",    // 255
    red: "#FF0000",
    green: "#00FF00",
    blue: "#0000FF",
    yellow: "#FFFF00",
    orange: "#FFA500",
  },
};

// =============================================================================
// Global Theme State
// =============================================================================

let currentTheme: Theme<string> = EINK_BW_THEME;

/**
 * Set the active theme.
 *
 * @param theme - The theme configuration to use
 *
 * @example
 * ```typescript
 * // Use color e-ink theme
 * setTheme(EINK_COLOR_THEME);
 *
 * // Or create a custom theme
 * setTheme({
 *   defaultFont: "Roboto",
 *   defaultFontSize: 14,
 *   colors: {
 *     black: "#000000",
 *     white: "#FFFFFF",
 *   },
 * });
 * ```
 */
export function setTheme<TColor extends string>(theme: Theme<TColor>): void {
  currentTheme = theme as Theme<string>;
}

/**
 * Get the current theme.
 */
export function getTheme(): Theme<string> {
  return currentTheme;
}

/**
 * Get the default font family.
 */
export function getDefaultFont(): string {
  return currentTheme.defaultFont;
}

/**
 * Get the default font size.
 */
export function getDefaultFontSize(): number {
  return currentTheme.defaultFontSize;
}

/**
 * Resolve a color name to its hex value.
 * If the color is already a hex value, returns it as-is.
 *
 * @param color - Color name or hex value
 * @returns The hex color value
 */
export function resolveColor(color: string): string {
  // If it's a known color name, use the theme value
  if (color in currentTheme.colors) {
    return currentTheme.colors[color];
  }
  // Otherwise return as-is (assume it's a valid CSS color)
  return color;
}

/**
 * Build a CSS font string from size and optional font family.
 *
 * @param size - Font size in pixels
 * @param font - Optional font family (defaults to theme's defaultFont)
 * @param weight - Optional font weight ("bold", "normal", etc.)
 * @returns CSS font string like "bold 24px Noto Sans"
 */
export function buildFontString(
  size?: number,
  font?: string,
  weight?: "normal" | "bold",
): string {
  const fontSize = size ?? currentTheme.defaultFontSize;
  const fontFamily = font ?? currentTheme.defaultFont;
  const fontWeight = weight ? `${weight} ` : "";

  return `${fontWeight}${fontSize}px ${fontFamily}`;
}
