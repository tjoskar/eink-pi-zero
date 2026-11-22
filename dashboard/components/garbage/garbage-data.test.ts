import { expect, test } from "vitest";
import { getGarbageData } from "./garbage-data.ts";

test("week 26: Tunna 2 (Tue) then Trädgårdsavfall (Fri)", () => {
  const now = new Date(2026, 5, 22); // Mon June 22
  const result = getGarbageData(now);

  expect(result.events).toHaveLength(2);
  expect(result.events[0]).toEqual({
    dateStr: "23/06",
    daysUntil: "i morgon",
    label: "Tunna 2",
  });
  expect(result.events[1]).toEqual({
    dateStr: "26/06",
    daysUntil: "om 4 dagar",
    label: "Trädgårdsavfall",
  });
});

test("week 27 is empty — next events are week 28", () => {
  const now = new Date(2026, 5, 29); // Mon June 29 (week 27)
  const result = getGarbageData(now);

  expect(result.events[0]).toMatchObject({ dateStr: "06/07", label: "Tunna 1" });
  expect(result.events[1]).toMatchObject({ dateStr: "07/07", label: "Tunna 2" });
});

test("week 28: Tunna 1 (Mon), Tunna 2 (Tue), Trädgårdsavfall (Fri)", () => {
  // Take the next three by reading across two calls (display only shows two).
  const monday = getGarbageData(new Date(2026, 6, 6)); // Mon July 6
  expect(monday.events[0]).toMatchObject({ dateStr: "06/07", label: "Tunna 1" });
  expect(monday.events[1]).toMatchObject({ dateStr: "07/07", label: "Tunna 2" });

  const tuesday = getGarbageData(new Date(2026, 6, 7)); // Tue July 7
  expect(tuesday.events[0]).toMatchObject({ dateStr: "07/07", label: "Tunna 2" });
  expect(tuesday.events[1]).toMatchObject({ dateStr: "10/07", label: "Trädgårdsavfall" });
});

test("Tunna 1 repeats every 4 weeks", () => {
  // After July 6, the next Tunna 1 is Aug 3 (28 days later).
  const result = getGarbageData(new Date(2026, 6, 7)); // Tue July 7
  const aug = getGarbageData(new Date(2026, 6, 13)); // Mon July 13 — past wk 28
  expect(result.events.some((e) => e.label === "Tunna 1")).toBe(false);
  // From July 13, upcoming includes the wk 30 bi-weekly pair, not Tunna 1 yet.
  expect(aug.events.map((e) => e.label)).toEqual(["Tunna 2", "Trädgårdsavfall"]);
  expect(aug.events[0].dateStr).toBe("21/07");
});

test("reminder when collection is today", () => {
  const now = new Date(2026, 5, 23); // Tue June 23 — Tunna 2 day
  const result = getGarbageData(now);

  expect(result.events[0].daysUntil).toBe("i dag");
  expect(result.reminder).toBe("Dags att ställa ut tunna 2!");
});

test("reminder when collection is tomorrow", () => {
  const now = new Date(2026, 6, 5); // Sun July 5 — day before Tunna 1
  const result = getGarbageData(now);

  expect(result.events[0].daysUntil).toBe("i morgon");
  expect(result.reminder).toBe("Dags att ställa ut tunna 1!");
});

test("reminder for garden waste", () => {
  const now = new Date(2026, 5, 25); // Thu June 25 — day before Trädgårdsavfall
  const result = getGarbageData(now);

  expect(result.events[0].label).toBe("Trädgårdsavfall");
  expect(result.reminder).toBe("Dags att ställa ut trädgårdsavfallet!");
});

test("no reminder when collection is 2+ days away", () => {
  const now = new Date(2026, 5, 22); // Mon June 22 — Tunna 2 is Tue (tomorrow → has reminder)
  const result = getGarbageData(now, [
    { label: "Tunna 2", reminderText: "tunna 2", anchor: "2026-06-23", intervalDays: 14 },
  ]);
  // June 22 → June 23 is tomorrow, so use a farther anchor to assert no reminder.
  const farther = getGarbageData(new Date(2026, 5, 20), [
    { label: "Tunna 2", reminderText: "tunna 2", anchor: "2026-06-23", intervalDays: 14 },
  ]);
  expect(result.reminder).not.toBeNull();
  expect(farther.reminder).toBeNull();
});

test("empty collections list returns no events and no reminder", () => {
  const now = new Date(2026, 5, 22);
  const result = getGarbageData(now, []);

  expect(result.events).toHaveLength(0);
  expect(result.reminder).toBeNull();
});
