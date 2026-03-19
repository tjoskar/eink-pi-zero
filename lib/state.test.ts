import { test, expect } from "vitest";
import { createState } from "../lib/state.ts";

test("createState get returns initial value", () => {
  const state = createState(42);
  expect(state.get()).toBe(42);
});

test("createState set updates value and get reflects it", () => {
  const state = createState("hello");
  state.set("world");
  expect(state.get()).toBe("world");
});

test("createState works with objects", () => {
  const state = createState({ count: 0 });
  state.set({ count: 5 });
  expect(state.get()).toEqual({ count: 5 });
});
