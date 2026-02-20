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
 * // Register a custom font
 * registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
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

/** Name of the icon font family */
export const ICON_FONT_FAMILY = "Material Icons";

/** Default path to the Material Icons font (relative to project root) */
const DEFAULT_ICON_FONT_PATH = "./fonts/material-icons.woff";

/**
 * Register a font file for use with canvas.
 *
 * The font file must be a TrueType (.ttf), OpenType (.otf) font or a WOFF/WOFF2 font.
 *
 * @param fontPath - Path to the font file
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
export function registerFont(
  fontPath: string,
  family: string,
): void {
  const resolvedPath = path.resolve(fontPath);

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
 * @param fontPath - Optional custom path to the icon font file.
 *                   Defaults to "./fonts/material-icons.woff"
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
export function registerIconFont(fontPath = DEFAULT_ICON_FONT_PATH): void {
  registerFont(fontPath, ICON_FONT_FAMILY);
}
