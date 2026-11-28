import { describe, expect, test } from "vitest";
import { isSunUp, sunTimes } from "./solar.ts";

// Stockholm
const LAT = 59.3293;
const LON = 18.0686;

const minutesApart = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60_000;

describe("sunTimes", () => {
  test("midsummer in Stockholm: 01:31 and 20:08 UTC, within a few minutes", () => {
    const { sunrise, sunset } = sunTimes(new Date("2026-06-21T12:00:00Z"), LAT, LON);
    expect(minutesApart(sunrise!, new Date("2026-06-21T01:31:00Z"))).toBeLessThan(5);
    expect(minutesApart(sunset!, new Date("2026-06-21T20:08:00Z"))).toBeLessThan(5);
  });

  test("midwinter in Stockholm: 07:44 and 13:48 UTC, within a few minutes", () => {
    const { sunrise, sunset } = sunTimes(new Date("2026-12-21T12:00:00Z"), LAT, LON);
    expect(minutesApart(sunrise!, new Date("2026-12-21T07:44:00Z"))).toBeLessThan(5);
    expect(minutesApart(sunset!, new Date("2026-12-21T13:48:00Z"))).toBeLessThan(5);
  });

  test("no sunrise or sunset under the midnight sun", () => {
    // Kiruna, 68.0° N
    expect(sunTimes(new Date("2026-06-21T12:00:00Z"), 67.86, 20.23)).toEqual({
      sunrise: null,
      sunset: null,
    });
  });
});

describe("isSunUp", () => {
  test("up at noon, down at midnight", () => {
    expect(isSunUp(new Date("2026-03-07T11:00:00Z"), LAT, LON)).toBe(true);
    expect(isSunUp(new Date("2026-03-07T23:00:00Z"), LAT, LON)).toBe(false);
  });
});
