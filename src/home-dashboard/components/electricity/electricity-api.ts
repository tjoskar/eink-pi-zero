import { fetchJson, createCache } from "#lib";
import { config } from "../../config.ts";

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

const cache = createCache<TibberResponse>({
  file: "electricity_cache.json",
  label: "Electricity",
  isFresh({ timestamp }) {
    const age = Date.now() / 1000 - timestamp;
    if (age > MAX_AGE) return false;
    const h = new Date().getHours();
    return h >= 13 && h < 15 ? age < SHORT_WINDOW_TTL : true;
  },
});

async function fetchTibberPrices(): Promise<TibberResponse | null> {
  const token = config.tibberToken;
  if (!token) {
    console.error("TIBBER_TOKEN not set");
    return null;
  }

  return fetchJson<TibberResponse>(TIBBER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: TIBBER_QUERY }),
    timeout: 1_000,
    label: "Tibber",
  });
}

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
      highlightIndex >= 0 && highlightIndex < prices.length ? prices[highlightIndex] : 0;

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

export async function getElectricityData(): Promise<ElectricityData | null> {
  const cached = cache.read();
  if (cached) {
    return processResponse(cached);
  }

  const fetched = await fetchTibberPrices();
  if (fetched) {
    cache.write(fetched);
    return processResponse(fetched);
  }

  const stale = cache.read(true);
  if (stale) {
    console.log("Using stale electricity cache as fallback");
    return processResponse(stale);
  }

  return null;
}
