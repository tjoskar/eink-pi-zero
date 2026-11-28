/**
 * SMHI point Forecast: fetch, cache, and parse into typed steps.
 *
 * Source: SMHI open data, meteorological forecast snow1g version 1
 * (https://opendata.smhi.se), licensed CC BY 4.0. No API key.
 *
 *   https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1
 *     /geotype/point/lon/{lon}/lat/{lat}/data.json
 *
 * Hourly steps for the first days, then every 3, 6 and 12 hours. Each step's
 * precipitation is the amount (mm) over its interval, from
 * `intervalParametersStartTime` to `time`.
 */

import { fetchJson, createCache } from "@tjoskar/eink";
import { config } from "../../config.ts";

interface SmhiResponse {
  timeSeries: Array<{
    time: string;
    intervalParametersStartTime?: string;
    data: Record<string, number>;
  }>;
}

export interface ForecastStep {
  time: Date;
  /** Start of the interval the precipitation covers. */
  intervalStart: Date;
  temperature?: number;
  windSpeed?: number;
  precipitation?: number;
  symbol?: number;
}

const cache = createCache<SmhiResponse>({
  file: "smhi_forecast_cache.json",
  ttlSeconds: 1800,
  label: "SMHI",
});

/** SMHI's missing value for every parameter. */
const MISSING = 9999;
/**
 * -9 means "not applicable" (e.g. precipitation_frozen_part without
 * precipitation). The parameters read below never use it, but none of them
 * can really be -9, so it is dropped defensively; except air temperature,
 * where -9 is a real value.
 */
const NOT_APPLICABLE = -9;

function value(data: Record<string, number>, key: string, minusNineIsMissing = true) {
  const v = data[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v === MISSING) return undefined;
  if (minusNineIsMissing && v === NOT_APPLICABLE) return undefined;
  return v;
}

function parse(response: SmhiResponse): ForecastStep[] {
  const steps: ForecastStep[] = [];
  for (const entry of response.timeSeries ?? []) {
    if (typeof entry?.time !== "string" || typeof entry.data !== "object" || !entry.data) continue;
    const time = new Date(entry.time);
    if (Number.isNaN(time.getTime())) continue;
    const start = new Date(entry.intervalParametersStartTime ?? entry.time);
    steps.push({
      time,
      intervalStart: Number.isNaN(start.getTime()) ? time : start,
      temperature: value(entry.data, "air_temperature", false),
      windSpeed: value(entry.data, "wind_speed"),
      precipitation: value(entry.data, "precipitation_amount_mean"),
      symbol: value(entry.data, "symbol_code"),
    });
  }
  return steps.toSorted((a, b) => a.time.getTime() - b.time.getTime());
}

function isResponse(data: unknown): data is SmhiResponse {
  return Array.isArray((data as SmhiResponse | null)?.timeSeries);
}

async function fetchResponse(): Promise<SmhiResponse | null> {
  const cached = cache.read();
  if (isResponse(cached)) return cached;

  const url =
    `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1` +
    `/geotype/point/lon/${config.weatherLon}/lat/${config.weatherLat}/data.json`;
  const fresh = await fetchJson<SmhiResponse>(url, { timeout: config.apiTimeout, label: "SMHI" });
  if (isResponse(fresh)) {
    cache.write(fresh);
    return fresh;
  }

  const stale = cache.read(true);
  if (isResponse(stale)) {
    console.log("Using stale SMHI cache as fallback");
    return stale;
  }
  return null;
}

/** The Forecast steps, or an empty list when SMHI is down and nothing is cached. */
export async function getForecastSteps(): Promise<ForecastStep[]> {
  const response = await fetchResponse();
  return response ? parse(response) : [];
}
