import { test, expect, beforeAll } from "vitest";
import { Canvas, render, registerIconFont, Icon } from "../mod.ts";
import { ICON_FONT_FAMILY } from "../canvas/register-font.ts";
import { ICON_CODEPOINTS } from "./icons-name.ts";
import type { JSXElement } from "../runtime/types.ts";

beforeAll(() => {
  registerIconFont();
});

const SIZE = 48;

async function pixels(node: JSXElement): Promise<Uint8ClampedArray> {
  const canvas = new Canvas(SIZE, SIZE);
  await render(node, canvas);
  return canvas.getImageData().data;
}

// The font draws an icon from its name too (a ligature), so the name is the
// truth to check each codepoint against.
test.each(Object.keys(ICON_CODEPOINTS))(
  "<Icon name=%j> draws the glyph of that name",
  async (name) => {
    const byCodepoint = await pixels(<Icon name={name} size={SIZE} />);
    const byName = await pixels(
      <text size={SIZE} width={SIZE} font={ICON_FONT_FAMILY}>
        {name}
      </text>,
    );

    expect(byCodepoint.some((v, i) => i % 4 === 0 && v < 128)).toBe(true);
    expect(Buffer.from(byCodepoint).equals(Buffer.from(byName))).toBe(true);
  },
);
