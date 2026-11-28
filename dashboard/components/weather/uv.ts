/**
 * Hourly UV index from Open-Meteo, with its own cache.
 *
 * Source: Open-Meteo (https://open-meteo.com), data licensed CC BY 4.0.
 * Free for non-commercial use without an API key (fewer than 10 000 calls a
 * day); the Dashboard makes at most a few dozen.
 *
 * `uv_index` is the mean over the hour that ends at each timestamp.
 */

import { fetchJson, createCache } from "@tjoskar/eink";
import { config } from "../../config.ts";

interface OpenMeteoResponse {
  hourly: { time: number[]; uv_index: Array<number | null> };
}

export interface UvHour {
  /** Start of the hour the value covers. */
  start: Date;
  uv: number;
}

const cache = createCache<OpenMeteoResponse>({
  file: "uv_cache.json",
  ttlSeconds: 3 * 3600,
  label: "UV",
});

function isResponse(data: unknown): data is OpenMeteoResponse {
  const hourly = (data as OpenMeteoResponse | null)?.hourly;
  return Array.isArray(hourly?.time) && Array.isArray(hourly?.uv_index);
}

async function fetchResponse(): Promise<OpenMeteoResponse | null> {
  const cached = cache.read();
  if (isResponse(cached)) return cached;

  // Unix time avoids Open-Meteo's fixed-offset local times; `timezone=auto`
  // still makes the two days local days.
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${config.weatherLat}&longitude=${config.weatherLon}` +
    `&hourly=uv_index&timezone=auto&timeformat=unixtime&forecast_days=2`;
  const fresh = await fetchJson<OpenMeteoResponse>(url, {
    timeout: config.apiTimeout,
    label: "UV",
  });
  if (isResponse(fresh)) {
    cache.write(fresh);
    return fresh;
  }

  const stale = cache.read(true);
  if (isResponse(stale)) {
    console.log("Using stale UV cache as fallback");
    return stale;
  }
  return null;
}

/** Hourly UV values, or an empty list when Open-Meteo fails and nothing is cached. */
export async function getUvHours(): Promise<UvHour[]> {
  const response = await fetchResponse();
  if (!response) return [];
  const { time, uv_index } = response.hourly;
  const hours: UvHour[] = [];
  time.forEach((end, i) => {
    const uv = uv_index[i];
    if (typeof end !== "number" || typeof uv !== "number" || !Number.isFinite(uv)) return;
    hours.push({ start: new Date((end - 3600) * 1000), uv });
  });
  return hours;
}
