import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, "dishes_cache.json");

const CACHE_TTL = 3600; // 1 hour in seconds

interface CacheEnvelope {
  timestamp: number;
  dishes: string[];
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function loadCache(): string[] | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;

    const raw = readFileSync(CACHE_FILE, "utf-8");
    const cache: CacheEnvelope = JSON.parse(raw);

    const cacheAge = Date.now() / 1000 - (cache.timestamp ?? 0);
    if (cacheAge >= CACHE_TTL) return null;

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

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchRemoteDishes(): Promise<string[] | null> {
  const url = process.env.DISHES_API_URL ?? "https://matsedel.deno.dev";

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, limit: number = 40): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "\u2026";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDishes(): Promise<string[]> {
  // 1. Try cache
  const cached = loadCache();
  if (cached) {
    return cached.map((d) => truncate(d));
  }

  // 2. Fetch from API
  const fetched = await fetchRemoteDishes();
  if (fetched) {
    saveCache(fetched);
    return fetched.map((d) => truncate(d));
  }

  // 3. Both failed
  return [];
}
