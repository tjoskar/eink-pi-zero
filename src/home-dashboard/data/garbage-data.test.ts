import { expect, test } from "vitest";
import { getGarbageData } from "./garbage-data.ts";
import type { CollectionEntry } from "./garbage-data.ts";

const dates: CollectionEntry[] = [
  { type: "household", date: "2026-03-18" },
  { type: "household", date: "2026-03-31" },
  { type: "household", date: "2026-04-15" },
  { type: "garden", date: "2026-04-17" },
];

test("returns the next 2 upcoming events", () => {
  const now = new Date(2026, 2, 7); // March 7
  const result = getGarbageData(now, dates);

  expect(result.events).toHaveLength(2);
  expect(result.events[0]).toEqual({
    type: "household",
    dateStr: "18/03",
    daysUntil: "om 11 dagar",
    label: "Hushållssopor",
  });
  expect(result.events[1]).toEqual({
    type: "household",
    dateStr: "31/03",
    daysUntil: "om 24 dagar",
    label: "Hushållssopor",
  });
});

test("skips past events", () => {
  const now = new Date(2026, 2, 20); // March 20 — first entry is in the past
  const result = getGarbageData(now, dates);

  expect(result.events).toHaveLength(2);
  expect(result.events[0]).toEqual({
    type: "household",
    dateStr: "31/03",
    daysUntil: "om 11 dagar",
    label: "Hushållssopor",
  });
  expect(result.events[1]).toEqual({
    type: "household",
    dateStr: "15/04",
    daysUntil: "om 26 dagar",
    label: "Hushållssopor",
  });
});

test("includes garden events", () => {
  const now = new Date(2026, 3, 14); // April 14
  const result = getGarbageData(now, dates);

  expect(result.events).toHaveLength(2);
  expect(result.events[0]).toEqual({
    type: "household",
    dateStr: "15/04",
    daysUntil: "i morgon",
    label: "Hushållssopor",
  });
  expect(result.events[1]).toEqual({
    type: "garden",
    dateStr: "17/04",
    daysUntil: "om 3 dagar",
    label: "Trädgårdsavfall",
  });
});

test("reminder when collection is today", () => {
  const now = new Date(2026, 2, 18); // March 18 — household collection day
  const result = getGarbageData(now, dates);

  expect(result.events[0].daysUntil).toBe("i dag");
  expect(result.reminder).toBe("Dags att ställa ut hushållssoporna!");
});

test("reminder when collection is tomorrow", () => {
  const now = new Date(2026, 2, 17); // March 17 — day before household collection
  const result = getGarbageData(now, dates);

  expect(result.events[0].daysUntil).toBe("i morgon");
  expect(result.reminder).toBe("Dags att ställa ut hushållssoporna!");
});

test("reminder for garden waste", () => {
  const now = new Date(2026, 3, 17); // April 17 — garden collection day
  const result = getGarbageData(now, [
    { type: "garden", date: "2026-04-17" },
    { type: "household", date: "2026-04-20" },
  ]);

  expect(result.events[0].type).toBe("garden");
  expect(result.reminder).toBe("Dags att ställa ut trädgårdsavfallet!");
});

test("no reminder when collection is 2+ days away", () => {
  const now = new Date(2026, 2, 7);
  const result = getGarbageData(now, dates);

  expect(result.reminder).toBeNull();
});

test("empty list returns no events and no reminder", () => {
  const now = new Date(2026, 2, 7);
  const result = getGarbageData(now, []);

  expect(result.events).toHaveLength(0);
  expect(result.reminder).toBeNull();
});
