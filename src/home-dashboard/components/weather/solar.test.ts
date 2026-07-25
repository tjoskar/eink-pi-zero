import { describe, expect, test } from "vitest";
import { clearSkyUvIndex, solarElevation, sunTimes, uvIndex } from "./solar.ts";

// Stockholm
const LAT = 59.3293;
const LON = 18.0686;

describe("solarElevation", () => {
  test("sun is high around local noon at summer solstice", () => {
    // ~11:00 UTC ≈ solar noon in Stockholm (UTC+2 in summer).
    const elevation = solarElevation(new Date("2026-06-21T11:00:00Z"), LAT, LON);
    // Max possible ≈ 90 - 59.33 + 23.44 ≈ 54°.
    expect(elevation).toBeGreaterThan(50);
    expect(elevation).toBeLessThan(55);
  });

  test("sun is below the horizon at local midnight", () => {
    expect(solarElevation(new Date("2026-06-21T23:00:00Z"), LAT, LON)).toBeLessThan(0);
  });
});

describe("sunTimes", () => {
  test("sunrise precedes sunset on a summer day", () => {
    const { sunrise, sunset } = sunTimes(new Date("2026-06-21T12:00:00Z"), LAT, LON);
    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    expect(sunrise!.getTime()).toBeLessThan(sunset!.getTime());
  });
});

describe("uvIndex", () => {
  test("is zero when the sun is below the horizon", () => {
    expect(clearSkyUvIndex(-5)).toBe(0);
    expect(uvIndex(-5, 0)).toBe(0);
  });

  test("clouds reduce UV below the clear-sky value", () => {
    const clear = uvIndex(50, 0);
    const overcast = uvIndex(50, 100);
    expect(clear).toBeGreaterThan(0);
    expect(overcast).toBeLessThan(clear);
    expect(overcast).toBeGreaterThan(0); // overcast still passes some UV
  });
});
