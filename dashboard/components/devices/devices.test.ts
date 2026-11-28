import { beforeEach, expect, test, vi } from "vitest";

type Devices = typeof import("./devices.tsx");
let d: Devices;

// A fresh module per test: the Devices live in module state.
beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "log").mockImplementation(() => {});
  d = await import("./devices.tsx");
});

const DRYER = "controlpanel/statechange/dryer";
const DRYER_END = "controlpanel/end_time/dryer";
const dryer = () => d.devicesState.get().get(DRYER)!;

test("six Devices in the order they are shown", () => {
  expect(Array.from(d.devicesState.get().values(), (x) => x.label)).toEqual([
    "Washing Machine",
    "Dryer",
    "Dishwasher",
    "3D Printer",
    "Engine Heater",
    "Bike Charger",
  ]);
});

test("a changed Confirmed state renders, an unchanged one does not", () => {
  expect(d.setConfirmedState(DRYER, true)).toBe(true);
  expect(d.setConfirmedState(DRYER, true)).toBe(false);
  expect(dryer().on).toBe(true);
});

test("an unknown Device is ignored", () => {
  expect(d.setConfirmedState("controlpanel/statechange/sauna", true)).toBe(false);
  expect(d.setEndTime("controlpanel/end_time/sauna", "2026-11-28T12:00:00Z")).toBe(false);
  expect(d.devicesState.get().size).toBe(6);
});

test("End time topics are told apart from the rest", () => {
  expect(d.isEndTimeTopic(DRYER_END)).toBe(true);
  expect(d.isEndTimeTopic(DRYER)).toBe(false);
});

test("an End time for a running Device with none shown renders", () => {
  d.setConfirmedState(DRYER, true);

  expect(d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z")).toBe(true);
  expect(dryer().endTime).toEqual(new Date("2026-11-28T12:40:00Z"));
});

test("a changed End time waits for the next render", () => {
  d.setConfirmedState(DRYER, true);
  d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z");

  expect(d.setEndTime(DRYER_END, "2026-11-28T12:45:00Z")).toBe(false);
  expect(dryer().endTime).toEqual(new Date("2026-11-28T12:45:00Z"));
});

test("an End time that arrives before the Device turns on is kept and shows with it", () => {
  expect(d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z")).toBe(false);

  expect(d.setConfirmedState(DRYER, true)).toBe(true);
  expect(dryer().endTime).toEqual(new Date("2026-11-28T12:40:00Z"));
});

test("an empty or unreadable End time clears it", () => {
  d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z");
  d.setEndTime(DRYER_END, "");
  expect(dryer().endTime).toBeUndefined();

  d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z");
  d.setEndTime(DRYER_END, "unknown");
  expect(dryer().endTime).toBeUndefined();
});

test("a Device that turns off drops its End time", () => {
  d.setConfirmedState(DRYER, true);
  d.setEndTime(DRYER_END, "2026-11-28T12:40:00Z");

  d.setConfirmedState(DRYER, false);
  expect(dryer().endTime).toBeUndefined();

  d.setConfirmedState(DRYER, true);
  expect(dryer().endTime).toBeUndefined();
});

/** The plain texts the Device column shows (icon glyphs left out). */
function shownTexts(): string[] {
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string") {
      if (!/[\ue000-\uf8ff]/.test(node)) texts.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    const { type, props } = node as { type: unknown; props: { children?: unknown } };
    if (typeof type === "function") return walk(type(props));
    walk(props.children);
  };
  walk(d.DeviceColumn());
  return texts;
}

test("a running Device shows its End time in local time", () => {
  d.setConfirmedState(DRYER, true);
  d.setEndTime(DRYER_END, "2026-03-07T14:50:00Z");

  expect(shownTexts()).toEqual(["15:50"]);
});

test("a Device that is off shows no End time", () => {
  d.setEndTime(DRYER_END, "2026-03-07T14:50:00Z");

  expect(shownTexts()).toEqual([]);
});
