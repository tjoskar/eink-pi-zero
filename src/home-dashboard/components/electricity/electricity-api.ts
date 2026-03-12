import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { request, getCachePath } from "#lib";

const CACHE_FILE = getCachePath("electricity_cache.json");

const TIBBER_API_URL = "https://api.tibber.com/v1-beta/gql";
const SHORT_WINDOW_TTL = 300; // 5 minutes (seconds)
const MAX_AGE = 86400; // 24 hours (seconds)

const TIBBER_QUERY = `{
  viewer {
    homes {
      currentSubscription {
        priceInfo {
          today {
            total
            startsAt
            level
          }
          tomorrow {
            total
            startsAt
            level
          }
        }
      }
      consumption(resolution: DAILY, last: 7) {
        nodes {
          cost
          consumption
        }
      }
    }
  }
}`;

const LEVEL_LABEL_SV: Record<string, string> = {
  NORMAL: "Normalt",
  CHEAP: "Billigt",
  VERY_CHEAP: "Mycket billigt",
  EXPENSIVE: "Dyrt",
  VERY_EXPENSIVE: "Mycket dyrt",
};

export interface ElectricityData {
  prices: number[];
  highlightIndex: number;
  levelLabel: string;
  currentPrice: number;
  consumption: number[];
  consumptionCosts: number[];
}

interface CacheEnvelope {
  timestamp: number;
  data: TibberResponse;
}

interface PriceEntry {
  total: number;
  startsAt: string;
  level: string;
}

interface ConsumptionNode {
  cost: number | null;
  consumption: number | null;
}

interface TibberResponse {
  data: {
    viewer: {
      homes: Array<{
        currentSubscription: {
          priceInfo: {
            today: PriceEntry[];
            tomorrow: PriceEntry[];
          };
        };
        consumption: {
          nodes: ConsumptionNode[];
        };
      }>;
    };
  };
}

function loadCache(opts?: { allowStale?: boolean }): TibberResponse | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;

    const raw = readFileSync(CACHE_FILE, "utf-8");
    const cache: CacheEnvelope = JSON.parse(raw);
    if (!cache.data) return null;

    if (opts?.allowStale) return cache.data;

    const nowHour = new Date().getHours();
    const cacheAge = Date.now() / 1000 - (cache.timestamp ?? 0);

    // Hard age cap: if older than 24h force refresh regardless of window
    if (cacheAge > MAX_AGE) return null;

    // Short refresh window: 13:00 <= time < 15:00
    if (nowHour >= 13 && nowHour < 15) {
      return cacheAge < SHORT_WINDOW_TTL ? cache.data : null;
    }

    // Outside publication window reuse any age (up to MAX_AGE)
    return cache.data;
  } catch (err) {
    console.error("Error reading electricity cache:", err);
    return null;
  }
}

function saveCache(data: TibberResponse): void {
  try {
    const envelope: CacheEnvelope = {
      timestamp: Date.now() / 1000,
      data,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(envelope));
  } catch (err) {
    console.error("Error writing electricity cache:", err);
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchTibberPrices(): Promise<TibberResponse | null> {
  const token = process.env.TIBBER_TOKEN;
  if (!token) {
    console.error("TIBBER_TOKEN not set");
    return null;
  }

  try {
    const resp = await request(TIBBER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: TIBBER_QUERY }),
      signal: AbortSignal.timeout(1_000),
    });

    if (!resp.ok) {
      console.error(`Tibber API HTTP ${resp.status}`);
      return null;
    }

    return (await resp.json()) as TibberResponse;
  } catch (err) {
    console.error("Electricity fetch error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Process response into ElectricityData
// ---------------------------------------------------------------------------

function processResponse(data: TibberResponse): ElectricityData | null {
  try {
    const homes = data.data?.viewer?.homes;
    if (!homes || homes.length === 0) return null;

    const priceInfo = homes[0].currentSubscription?.priceInfo;
    const today = priceInfo?.today ?? [];
    const tomorrow = priceInfo?.tomorrow ?? [];
    const combined: PriceEntry[] = [...today, ...tomorrow];

    // Convert to öre (SEK/kWh * 100, truncated to int)
    const prices = combined.map((e) => Math.trunc(e.total * 100));

    // Determine highlight index: entry whose startsAt <= now < next startsAt
    const now = Date.now();
    let highlightIndex = -1;

    for (let i = 0; i < combined.length; i++) {
      const starts = new Date(combined[i].startsAt).getTime();
      if (isNaN(starts)) continue;

      let nextStarts: number;
      if (i + 1 < combined.length) {
        nextStarts = new Date(combined[i + 1].startsAt).getTime();
        if (isNaN(nextStarts)) nextStarts = starts;
      } else {
        // Last entry: assume 1-hour slot
        nextStarts = starts + 3600_000;
      }

      if (starts <= now && now < nextStarts) {
        highlightIndex = i;
        break;
      }
    }

    // Level label (Swedish)
    let levelLabel = "";
    if (highlightIndex >= 0 && highlightIndex < combined.length) {
      const level = combined[highlightIndex].level;
      levelLabel = LEVEL_LABEL_SV[level] ?? level;
    }

    // Current price
    const currentPrice =
      highlightIndex >= 0 && highlightIndex < prices.length
        ? prices[highlightIndex]
        : 0;

    // Consumption nodes
    const nodes = homes[0].consumption?.nodes ?? [];
    const consumption: number[] = [];
    const consumptionCosts: number[] = [];

    for (const n of nodes) {
      if (n.consumption != null) {
        consumption.push(Number(n.consumption));
      }
      if (n.cost != null) {
        consumptionCosts.push(Number(n.cost));
      }
    }

    return {
      prices,
      highlightIndex,
      levelLabel,
      currentPrice,
      consumption,
      consumptionCosts,
    };
  } catch (err) {
    console.error("Error processing Tibber price data:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getElectricityData(): Promise<ElectricityData | null> {
  // 1. Try fresh cache
  const cached = loadCache();
  if (cached) {
    return processResponse(cached);
  }

  // 2. Fetch from API
  const fetched = await fetchTibberPrices();
  if (fetched) {
    saveCache(fetched);
    return processResponse(fetched);
  }

  // 3. Stale cache fallback
  const stale = loadCache({ allowStale: true });
  if (stale) {
    console.log("Using stale electricity cache as fallback");
    return processResponse(stale);
  }

  return null;
}
