import { fetchJson, createCache } from "#lib";
import { config } from "../../config.ts";

const cache = createCache<string[]>({
  file: "dishes_cache.json",
  ttlSeconds: 1800,
  label: "Dishes",
});

async function fetchRemoteDishes(): Promise<string[] | null> {
  const url = config.dishesApiUrl;
  const data = await fetchJson<unknown>(url, { timeout: 1_000, label: "Dishes" });
  return Array.isArray(data) ? (data as string[]) : null;
}

function truncate(text: string, limit: number = 40): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "\u2026";
}

export async function getDishes(): Promise<string[]> {
  const cached = cache.read();
  if (cached) {
    return cached.map((d) => truncate(d));
  }

  const fetched = await fetchRemoteDishes();
  if (fetched) {
    cache.write(fetched);
    return fetched.map((d) => truncate(d));
  }

  const stale = cache.read(true);
  if (stale) {
    console.warn("Using stale dishes cache as fallback");
    return stale.map((d) => truncate(d));
  }

  return [];
}
