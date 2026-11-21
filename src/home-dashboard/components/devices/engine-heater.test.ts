import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createEngineHeater, type LedState } from "./engine-heater.ts";

let published: string[];
let led: LedState[];
let renders: number;

function setup() {
  published = [];
  led = [];
  renders = 0;
  return createEngineHeater({
    publish: (payload) => published.push(payload),
    setLed: (state) => led.push(state),
    render: () => renders++,
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("a press with no Confirmed state yet requests on", () => {
  const heater = setup();

  heater.press();

  expect(published).toEqual(["on"]);
});

test("a press toggles from the Confirmed state", () => {
  const heater = setup();
  heater.confirmed(true);

  heater.press();

  expect(published).toEqual(["off"]);
});

test("a press shows the requested state at once and blinks the LED while Pending", () => {
  const heater = setup();

  heater.press();

  expect(heater.shown()).toEqual({ on: true, noAnswer: false });
  expect(led).toEqual(["blink"]);
  expect(renders).toBe(1);
});

test("a Confirmed state within 15 s makes the LED steady with no extra render", () => {
  const heater = setup();
  heater.press();
  vi.advanceTimersByTime(14_000);

  const needsRender = heater.confirmed(true);

  expect(needsRender).toBe(false);
  expect(led).toEqual(["blink", true]);
  expect(heater.shown()).toEqual({ on: true, noAnswer: false });
  vi.advanceTimersByTime(60_000);
  expect(renders).toBe(1);
  expect(led).toEqual(["blink", true]);
});

test("no Confirmed state within 15 s reverts to the last Confirmed state with the no-answer mark", () => {
  const heater = setup();
  heater.confirmed(true);
  heater.press();
  vi.advanceTimersByTime(14_999);
  expect(heater.shown()).toEqual({ on: false, noAnswer: false });

  vi.advanceTimersByTime(1);

  expect(heater.shown()).toEqual({ on: true, noAnswer: true });
  expect(led.at(-1)).toBe(true);
  expect(renders).toBe(2);
});

test("the no-answer mark stays until the next Confirmed state, which clears it", () => {
  const heater = setup();
  heater.press();
  vi.advanceTimersByTime(15_000);
  vi.advanceTimersByTime(600_000);
  expect(heater.shown()).toEqual({ on: false, noAnswer: true });

  const needsRender = heater.confirmed(false);

  expect(needsRender).toBe(true);
  expect(heater.shown()).toEqual({ on: false, noAnswer: false });
});

test("a Confirmed state that does not match the Request leaves the Pending running", () => {
  const heater = setup();
  heater.confirmed(true);
  heater.press();

  const needsRender = heater.confirmed(true);

  expect(needsRender).toBe(false);
  expect(heater.shown()).toEqual({ on: false, noAnswer: false });
  expect(led.at(-1)).toBe("blink");
  vi.advanceTimersByTime(15_000);
  expect(heater.shown()).toEqual({ on: true, noAnswer: true });
});

test("a press during Pending is ignored", () => {
  const heater = setup();
  heater.press();
  vi.advanceTimersByTime(10_000);

  heater.press();

  expect(published).toEqual(["on"]);
  expect(renders).toBe(1);
  vi.advanceTimersByTime(5_000);
  expect(heater.shown()).toEqual({ on: false, noAnswer: true });
});

test("a new press hides the no-answer mark while its Request is Pending", () => {
  const heater = setup();
  heater.press();
  vi.advanceTimersByTime(15_000);

  heater.press();

  expect(heater.shown()).toEqual({ on: true, noAnswer: false });
});

test("a change made in Home Assistant shows up without a press", () => {
  const heater = setup();

  const needsRender = heater.confirmed(true);

  expect(needsRender).toBe(true);
  expect(heater.shown()).toEqual({ on: true, noAnswer: false });
  expect(led).toEqual([true]);
});

test("disposing cancels a Pending revert", () => {
  const heater = setup();
  heater.press();

  heater[Symbol.dispose]();
  vi.advanceTimersByTime(15_000);

  expect(renders).toBe(1);
});

test("a press after disposing is ignored", () => {
  const heater = setup();
  heater[Symbol.dispose]();

  heater.press();

  expect(published).toEqual([]);
  expect(led).toEqual([]);
  expect(renders).toBe(0);
});
