/**
 * Text measurement for layout and drawing.
 *
 * Uses a reused 1×1 canvas so layout can measure text before the real canvas
 * draws it. Callers pass the same font string they draw with, so the measured
 * width equals the drawn width.
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

const ctx = createCanvas(1, 1).getContext("2d");

/** CSS generic families that resolve without being registered. */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

const warnedFamilies = new Set<string>();

/**
 * Width in pixels of `text` drawn with `font`.
 *
 * @param font - CSS font string, e.g. "bold 24px Noto Sans"
 * @param family - The font family in `font`, checked against the registered fonts
 */
export function measureTextWidth(text: string, font: string, family: string): number {
  warnIfUnknownFamily(family);
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * `text` shortened with a trailing "…" so it fits in `maxWidth`, unchanged if
 * it already fits, or empty if not even "…" fits.
 */
export function fitText(text: string, maxWidth: number, font: string, family: string): string {
  if (measureTextWidth(text, font, family) <= maxWidth) return text;
  if (measureTextWidth("…", font, family) > maxWidth) return "";

  // Longest prefix that fits together with the ellipsis.
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = chars.slice(0, mid).join("") + "…";
    if (measureTextWidth(candidate, font, family) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return chars.slice(0, low).join("") + "…";
}

function warnIfUnknownFamily(family: string): void {
  if (warnedFamilies.has(family) || GENERIC_FAMILIES.has(family) || GlobalFonts.has(family)) {
    return;
  }
  warnedFamilies.add(family);
  console.warn(`[Fonts] Unknown font family "${family}"; register it with registerFont().`);
}
