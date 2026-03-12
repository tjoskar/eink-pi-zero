export interface GarbageEvent {
  type: "household" | "garden";
  dateStr: string;
  daysUntil: string;
  label: string;
}

export interface GarbageData {
  events: GarbageEvent[];
  reminder: string | null;
}

export interface CollectionEntry {
  type: "household" | "garden";
  date: string; // YYYY-MM-DD
}

const GARBAGE_COLLECTION_DATES: CollectionEntry[] = [
  { type: "household", date: "2026-03-18" },
  { type: "household", date: "2026-03-31" },
  { type: "household", date: "2026-04-15" },
  { type: "garden", date: "2026-04-17" },
];

const TYPE_LABELS: Record<"household" | "garden", string> = {
  household: "Hushållssopor",
  garden: "Trädgårdsavfall",
};

const REMINDER_TEXT: Record<"household" | "garden", string> = {
  household: "hushållssoporna",
  garden: "trädgårdsavfallet",
};

const dateFormat = new Intl.DateTimeFormat("sv-SE", { day: "2-digit", month: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("sv-SE", { numeric: "auto" });

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

export function getGarbageData(
  now: Date = new Date(),
  dates: CollectionEntry[] = GARBAGE_COLLECTION_DATES,
): GarbageData {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcoming = dates
    .map((e) => ({ ...e, parsed: parseLocalDate(e.date) }))
    .filter((e) => e.parsed >= today)
    .slice(0, 2);

  const events: GarbageEvent[] = upcoming.map((e) => {
    const days = daysBetween(today, e.parsed);
    return {
      type: e.type,
      dateStr: dateFormat.format(e.parsed),
      daysUntil: relativeFormat.format(days, "day"),
      label: TYPE_LABELS[e.type],
    };
  });

  // Reminder if next collection is today or tomorrow
  let reminder: string | null = null;
  if (upcoming.length > 0) {
    const daysToFirst = daysBetween(today, upcoming[0].parsed);
    if (daysToFirst <= 1) {
      reminder = `Dags att ställa ut ${REMINDER_TEXT[upcoming[0].type]}!`;
    }
  }

  return { events, reminder };
}
