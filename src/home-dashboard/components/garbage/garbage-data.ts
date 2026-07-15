export interface GarbageEvent {
  dateStr: string;
  daysUntil: string;
  label: string;
}

export interface GarbageData {
  events: GarbageEvent[];
  reminder: string | null;
}

/**
 * A recurring collection: it happens on `anchor` and then repeats every
 * `intervalDays`. `anchor` just needs to be one known collection date — it can
 * be in the past; occurrences are projected forward from it.
 */
export interface RecurringCollection {
  label: string;
  /** Word used in the "Dags att ställa ut X!" reminder. */
  reminderText: string;
  anchor: string; // YYYY-MM-DD, a known collection date
  intervalDays: number;
}

/**
 * Schedule:
 *  - Tunna 2 + Trädgårdsavfall every 2nd week (Tue / Fri).
 *  - Tunna 1 every 4th week (Mon).
 */
const COLLECTIONS: RecurringCollection[] = [
  { label: "Tunna 2", reminderText: "tunna 2", anchor: "2026-06-23", intervalDays: 14 },
  { label: "Trädgårdsavfall", reminderText: "trädgårdsavfallet", anchor: "2026-06-26", intervalDays: 14 },
  { label: "Tunna 1", reminderText: "tunna 1", anchor: "2026-07-06", intervalDays: 28 },
];

const dateFormat = new Intl.DateTimeFormat("sv-SE", { day: "2-digit", month: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("sv-SE", { numeric: "auto" });

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

export function getGarbageData(
  now: Date = new Date(),
  collections: RecurringCollection[] = COLLECTIONS,
): GarbageData {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcoming = collections
    .flatMap((c) => {
      const anchor = parseLocalDate(c.anchor);
      const first = Math.max(0, Math.ceil(daysBetween(anchor, today) / c.intervalDays));
      // Two per stream is enough to find the next two overall.
      return [first, first + 1].map((n) => ({ c, date: addDays(anchor, n * c.intervalDays) }));
    })
    .toSorted((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 2);

  const events: GarbageEvent[] = upcoming.map(({ c, date }) => ({
    dateStr: dateFormat.format(date),
    daysUntil: relativeFormat.format(daysBetween(today, date), "day"),
    label: c.label,
  }));

  // Reminder if next collection is today or tomorrow.
  const next = upcoming[0];
  const reminder =
    next && daysBetween(today, next.date) <= 1 ? `Dags att ställa ut ${next.c.reminderText}!` : null;

  return { events, reminder };
}
