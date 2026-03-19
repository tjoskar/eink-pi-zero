import { test, expect, beforeEach } from "vitest";
import {
  resolveColor,
  buildFontString,
  setTheme,
  getTheme,
  getDefaultFont,
  getDefaultFontSize,
  EINK_BW_THEME,
  EINK_COLOR_THEME,
} from "../lib/theme.ts";

beforeEach(() => {
  setTheme(EINK_BW_THEME);
});

test("resolveColor returns hex for known colors", () => {
  expect(resolveColor("black")).toBe("#000000");
  expect(resolveColor("white")).toBe("#FFFFFF");
  expect(resolveColor("darkGray")).toBe("#555555");
  expect(resolveColor("lightGray")).toBe("#AAAAAA");
});

test("resolveColor passes through unknown strings", () => {
  expect(resolveColor("#FF00FF")).toBe("#FF00FF");
  expect(resolveColor("rgb(255,0,0)")).toBe("rgb(255,0,0)");
  expect(resolveColor("potato")).toBe("potato");
});

test("buildFontString builds correct CSS font string with defaults", () => {
  expect(buildFontString()).toBe("16px Noto Sans");
});

test("buildFontString with custom size", () => {
  expect(buildFontString(24)).toBe("24px Noto Sans");
});

test("buildFontString with custom font", () => {
  expect(buildFontString(undefined, "Roboto")).toBe("16px Roboto");
});

test("buildFontString with weight", () => {
  expect(buildFontString(24, "Roboto", "bold")).toBe("bold 24px Roboto");
});

test("buildFontString with normal weight", () => {
  expect(buildFontString(12, undefined, "normal")).toBe("normal 12px Noto Sans");
});

test("setTheme and getTheme switches themes", () => {
  expect(getTheme()).toBe(EINK_BW_THEME);
  setTheme(EINK_COLOR_THEME);
  expect(getTheme()).toBe(EINK_COLOR_THEME);
});

test("resolveColor uses the active theme", () => {
  setTheme(EINK_COLOR_THEME);
  expect(resolveColor("red")).toBe("#FF0000");
  expect(resolveColor("orange")).toBe("#FFA500");
});

test("getDefaultFont returns theme default font", () => {
  expect(getDefaultFont()).toBe("Noto Sans");
});

test("getDefaultFontSize returns theme default font size", () => {
  expect(getDefaultFontSize()).toBe(16);
});

test("getDefaultFont reflects custom theme", () => {
  setTheme({ defaultFont: "Roboto", defaultFontSize: 14, colors: { black: "#000" } });
  expect(getDefaultFont()).toBe("Roboto");
  expect(getDefaultFontSize()).toBe(14);
});
