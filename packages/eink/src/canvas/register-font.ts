/**
 * Font Registration
 *
 * Provides functions for registering custom fonts with the canvas.
 * Fonts must be registered before creating a canvas that uses them.
 *
 * @example Basic usage
 * ```typescript
 * import { registerFont, registerIconFont } from "./mod.ts";
 *
 * // Register a font that ships with the Framework
 * registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");
 *
 * // Register the Material Icons font
 * registerIconFont();
 *
 * // Now you can use these fonts in your JSX:
 * // <text font="24px Noto Sans">Hello</text>
 * // <Icon name="home" size={32} />
 * ```
 *
 * @example Registering multiple weights
 * ```typescript
 * registerFont("./fonts/roboto-regular.ttf", "Roboto");
 * registerFont("./fonts/roboto-bold.ttf", "Roboto-Bold");
 *
 * // Use in JSX:
 * // <text font="24px Roboto">Regular text</text>
 * // <text font="24px Roboto-Bold">Bold text</text>
 * ```
 */

import { GlobalFonts } from "@napi-rs/canvas";
import * as path from "node:path";
import * as fs from "node:fs";
import { FONT_DIR } from "../assets/paths.ts";

/** Name of the icon font family */
export const ICON_FONT_FAMILY = "Material Icons";

/** Default path to the Material Icons font that ships with the Framework */
const DEFAULT_ICON_FONT_PATH = fontPath("material-icons.woff");

/**
 * Path to a font that ships with the Framework (see fonts/readme.md).
 *
 * @example
 * ```typescript
 * registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");
 * ```
 */
export function fontPath(file: string): string {
  return path.join(FONT_DIR, file);
}

/**
 * Register a font file for use with canvas.
 *
 * The font file must be a TrueType (.ttf), OpenType (.otf) font or a WOFF/WOFF2 font.
 *
 * @param file - Path to the font file
 * @param family - Font family name to use in CSS font strings
 *
 * @throws Error if the font file does not exist
 *
 * @example
 * ```typescript
 * // Register a regular font
 * registerFont("./fonts/my-font.ttf", "My Font");
 *
 * // For bold, use a different family name
 * registerFont("./fonts/my-font-bold.ttf", "My Font Bold");
 * ```
 */
export function registerFont(file: string, family: string): void {
  const resolvedPath = path.resolve(file);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Font file not found: ${resolvedPath}`);
  }

  GlobalFonts.registerFromPath(resolvedPath, family);

  console.log(`[Fonts] Registered "${family}" from ${resolvedPath}`);
}

/**
 * Register the Material Icons font for use with the Icon component.
 *
 * This function registers the icon font with the family name "Material Icons".
 * After registration, you can use the Icon component to render icons.
 *
 * @param file - Optional custom path to the icon font file.
 *                   Defaults to the Material Icons font that ships with the Framework
 *
 * @throws Error if the font file does not exist
 *
 * @example
 * ```typescript
 * // Use default path
 * registerIconFont();
 *
 * // Or specify a custom path
 * registerIconFont("./custom/path/icons.woff");
 *
 * // Then use in JSX:
 * // <Icon name="home" size={32} color="black" />
 * ```
 */
export function registerIconFont(file = DEFAULT_ICON_FONT_PATH): void {
  registerFont(file, ICON_FONT_FAMILY);
}
