import { test, expect, beforeAll, vi } from "vitest";
import { Canvas, render, registerFont, registerIconFont, fontPath, Icon } from "./mod.ts";

beforeAll(() => {
  registerFont(fontPath("noto-sans-regular.ttf"), "Noto Sans");
  registerIconFont();
});

/** Columns (x) in row y that are darker than mid-grey. */
function darkColumns(canvas: Canvas, y: number): number[] {
  const { data, width } = canvas.getImageData();
  const columns: number[] = [];
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4] < 128) columns.push(x);
  }
  return columns;
}

/** Whether any pixel in the box is darker than mid-grey. */
function hasInk(canvas: Canvas, x0: number, y0: number, x1: number, y1: number): boolean {
  const { data, width } = canvas.getImageData();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * width + x) * 4] < 128) return true;
    }
  }
  return false;
}

test("a text that is not the last child in a row gets the width of its text", async () => {
  const canvas = new Canvas(400, 40);
  await render(
    <view direction="row" align="start">
      <text size={20} background="black">
        Hello
      </text>
      <text size={20}>world</text>
    </view>,
    canvas,
  );

  // "Hello" at 20px Noto Sans is roughly 50 px wide; its black background shows that width.
  const black = darkColumns(canvas, 2);
  expect(black[0]).toBe(0);
  expect(black.length).toBeGreaterThan(40);
  expect(black.length).toBeLessThan(60);
});

test("text wider than its box is cut with an ellipsis instead of overflowing", async () => {
  const long = "Wednesday Wednesday Wednesday";
  const cut = new Canvas(400, 40);
  await render(
    <view direction="row" align="start">
      <text size={20} width={100}>
        {long}
      </text>
    </view>,
    cut,
  );

  // Nothing is drawn outside the 100 px box.
  expect(hasInk(cut, 100, 0, 400, 40)).toBe(false);
  // The text still fills most of the box, so it was shortened, not dropped.
  expect(hasInk(cut, 70, 0, 100, 40)).toBe(true);
  // It ends with "…": the last glyph only has ink low down at the baseline,
  // unlike the letters, which reach up to the x-height.
  const right = Math.max(...Array.from({ length: 24 }, (_, y) => darkColumns(cut, y)).flat());
  expect(hasInk(cut, right - 3, 15, right + 1, 24)).toBe(true);
  expect(hasInk(cut, right - 3, 0, right + 1, 14)).toBe(false);
});

test("an explicit width wins over the text's own width", async () => {
  const canvas = new Canvas(400, 40);
  await render(
    <view direction="row" align="start">
      <text size={20} width={200} background="black">
        Hi
      </text>
      <text size={20}>there</text>
    </view>,
    canvas,
  );

  expect(darkColumns(canvas, 2)).toHaveLength(200);
});

test("an unknown font family is warned about once", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const canvas = new Canvas(400, 40);
  const app = (
    <view direction="row">
      <text size={20} font="No Such Font">
        a
      </text>
      <text size={20} font="No Such Font">
        b
      </text>
    </view>
  );
  await render(app, canvas);
  await render(app, canvas);

  const fontWarnings = warn.mock.calls.filter((args) => String(args[0]).includes("No Such Font"));
  expect(fontWarnings).toHaveLength(1);
  warn.mockRestore();
});

test("text exactly as wide as its box is drawn whole, not cut over a sub-pixel", async () => {
  // Material Icons glyphs measure a hair wider than the 24 px box the Icon gets.
  const canvas = new Canvas(40, 40);
  await render(
    <view direction="row" align="start">
      <Icon name="home" />
    </view>,
    canvas,
  );

  // The house's roof has ink in the top part of the box; an ellipsis would not.
  expect(hasInk(canvas, 0, 0, 24, 10)).toBe(true);
});
