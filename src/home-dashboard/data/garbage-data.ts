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

interface CollectionEntry {
  household: string;
  garden?: string;
}

const GARBAGE_COLLECTION_DATES: CollectionEntry[] = [
  { household: "2026-03-18" },
  { household: "2026-03-31" },
  { household: "2026-04-15", garden: "2026-04-17" },
];

const TYPE_LABELS: Record<"household" | "garden", string> = {
  household: "Hush\u00e5llssopor",
  garden: "Tr\u00e4dg\u00e5rdsavfall",
};

function parseDate(str: string): Date {
  // Parse "YYYY-MM-DD" as local date (midnight)
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  // Normalize to midnight to avoid DST edge cases
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

function formatDaysUntil(days: number): string {
  if (days === 0) return "idag";
  if (days === 1) return "imorgon";
  return `om ${days} dagar`;
}

function formatDateStr(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function getGarbageData(): GarbageData {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Collect all future events (including today)
  const futureEvents: Array<{
    type: "household" | "garden";
    date: Date;
  }> = [];

  for (const entry of GARBAGE_COLLECTION_DATES) {
    const householdDate = parseDate(entry.household);
    if (householdDate >= today) {
      futureEvents.push({ type: "household", date: householdDate });
    }

    if (entry.garden) {
      const gardenDate = parseDate(entry.garden);
      if (gardenDate >= today) {
        futureEvents.push({ type: "garden", date: gardenDate });
      }
    }
  }

  // Sort by date and take next 2
  futureEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextTwo = futureEvents.slice(0, 2);

  // Build GarbageEvent list
  const events: GarbageEvent[] = nextTwo.map((ev) => {
    const days = daysBetween(today, ev.date);
    return {
      type: ev.type,
      dateStr: formatDateStr(ev.date),
      daysUntil: formatDaysUntil(days),
      label: TYPE_LABELS[ev.type],
    };
  });

  // Reminder if next collection is today or tomorrow
  let reminder: string | null = null;
  if (events.length > 0) {
    const first = events[0];
    if (first.daysUntil === "idag" || first.daysUntil === "imorgon") {
      const typeText =
        first.type === "household" ? "hush\u00e5llssoporna" : "tr\u00e4dg\u00e5rdsavfallet";
      reminder = `Dags att st\u00e4lla ut ${typeText}!`;
    }
  }

  return { events, reminder };
}
