import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { request, getCachePath } from "#lib";

const CACHE_FILE = getCachePath("dishes_cache.json");

const CACHE_TTL = 3600; // 1 hour in seconds

interface CacheEnvelope {
  timestamp: number;
  dishes: string[];
}

function loadCache(opts?: { allowStale?: boolean }): string[] | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;

    const raw = readFileSync(CACHE_FILE, "utf-8");
    const cache: CacheEnvelope = JSON.parse(raw);

    if (!opts?.allowStale) {
      const cacheAge = Date.now() / 1000 - (cache.timestamp ?? 0);
      if (cacheAge >= CACHE_TTL) return null;
    }

    const dishes = cache.dishes;
    if (!Array.isArray(dishes) || dishes.length === 0) return null;

    return dishes;
  } catch (err) {
    console.error("Dishes cache read error:", err);
    return null;
  }
}

function saveCache(dishes: string[]): void {
  try {
    const envelope: CacheEnvelope = {
      timestamp: Date.now() / 1000,
      dishes,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(envelope));
  } catch (err) {
    console.error("Dishes cache write error:", err);
  }
}

async function fetchRemoteDishes(): Promise<string[] | null> {
  const url = process.env.DISHES_API_URL!; // TODO: verify that this env is set

  try {
    const resp = await request(url, {
      signal: AbortSignal.timeout(1_000),
    });

    if (!resp.ok) {
      console.error(`Dishes HTTP error ${resp.status}`);
      return null;
    }

    const data: unknown = await resp.json();
    if (Array.isArray(data)) {
      return data as string[];
    }

    return null;
  } catch (err) {
    console.error("Dishes fetch error:", err);
    return null;
  }
}

function truncate(text: string, limit: number = 40): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "\u2026";
}

export async function getDishes(): Promise<string[]> {
  const cached = loadCache();
  if (cached) {
    return cached.map((d) => truncate(d));
  }

  const fetched = await fetchRemoteDishes();
  if (fetched) {
    saveCache(fetched);
    return fetched.map((d) => truncate(d));
  }

  const stale = loadCache({ allowStale: true });
  if (stale) {
    console.warn("Using stale dishes cache as fallback");
    return stale.map((d) => truncate(d));
  }

  return [];
}
