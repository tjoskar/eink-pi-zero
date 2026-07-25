/**
 * SMHI meteorological forecast API — fetch, cache, and transform.
 *
 * Uses SMHI's free open-data point forecast (no API key required). Sunrise/
 * sunset and the UV index are computed locally (see ./solar.ts) since SMHI's
 * forecast does not provide them.
 *
 * Endpoint (the older pmp3g/v2 endpoint was retired in March 2026):
 *   https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1
 *     /geotype/point/lon/{lon}/lat/{lat}/data.json
 *
 * Config via environment variables:
 *   WEATHER_LAT     — latitude  (default: 59.3293 — Stockholm)
 *   WEATHER_LON     — longitude (default: 18.0686)
 *   CACHE_DURATION  — seconds (default: 3600)
 *   API_TIMEOUT     — milliseconds (default: 10000)
 */

import { getWeatherIconName } from "./weather-icons.ts";
import { solarElevation, sunTimes, uvIndex } from "./solar.ts";
import { fetchJson, createCache } from "#lib";
import { config } from "../../config.ts";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CurrentWeather {
  temp: string;
  icon: string; // Material Icon name
  windSpeed: string;
  sunTimes: string;
  rain: string;
  uvInfo: string;
}

export interface ForecastDay {
  day: string;
  icon: string; // Material Icon name
  temp: string;
}

export interface WeatherDisplayData {
  current: CurrentWeather;
  forecast: ForecastDay[];
}

/** A single hourly point from SMHI's `timeSeries`, with a flat `data` object. */
interface SmhiEntry {
  time: string;
  data: Record<string, number>;
}

interface SmhiResponse {
  timeSeries: SmhiEntry[];
}

const cache = createCache<SmhiResponse>({
  file: "weather_cache.json",
  ttlSeconds: 1800,
  label: "Weather",
});

async function fetchFromApi(): Promise<SmhiResponse | null> {
  const url =
    `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1` +
    `/geotype/point/lon/${config.weatherLon}/lat/${config.weatherLat}/data.json`;

  return fetchJson<SmhiResponse>(url, {
    timeout: config.apiTimeout,
    label: "Weather",
  });
}

async function fetchWeatherData(): Promise<SmhiResponse | null> {
  const cached = cache.read();
  if (cached) return cached;

  const data = await fetchFromApi();
  if (data) {
    cache.write(data);
    return data;
  }

  const stale = cache.read(true);
  if (stale) {
    console.log("Using stale weather cache as fallback");
    return stale;
  }
  return null;
}

const fmtTime = (d: Date) => d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

/** Sum of forecast precipitation (mm) for the rest of today. */
function getRainTotal(series: SmhiEntry[], now: Date): number {
  const today = now.toDateString();
  let total = 0;
  for (const entry of series) {
    const t = new Date(entry.time);
    if (t.toDateString() !== today || t < now) continue;
    // Within today SMHI reports hourly points; mean intensity (mm/h) ≈ mm/hour.
    total += entry.data.precipitation_amount_mean ?? 0;
  }
  return total;
}

/** Current UV plus, if it gets strong today, the daily peak and the high-UV window. */
function getUvInfo(
  series: SmhiEntry[],
  now: Date,
  lat: number,
  lon: number,
  currentClouds: number,
): string {
  const today = now.toDateString();
  const currentUv = uvIndex(solarElevation(now, lat, lon), currentClouds);

  let maxUv = currentUv;
  const highUvHours: number[] = [];
  for (const entry of series) {
    const t = new Date(entry.time);
    if (t.toDateString() !== today) continue;
    const uv = uvIndex(solarElevation(t, lat, lon), entry.data.cloud_area_fraction ?? 0);
    if (uv > maxUv) maxUv = uv;
    if (uv >= 3) highUvHours.push(t.getHours());
  }

  if (highUvHours.length === 0) {
    return `${Math.round(currentUv)}`;
  }
  const minH = Math.min(...highUvHours);
  const maxH = Math.max(...highUvHours);
  return `${Math.round(currentUv)} (${Math.round(maxUv)}, ${minH} - ${maxH})`;
}

/** Group the hourly series into the next 5 days (excluding today). */
function buildForecast(series: SmhiEntry[], now: Date): ForecastDay[] {
  const today = now.toDateString();
  const byDay = new Map<string, SmhiEntry[]>();
  for (const entry of series) {
    const key = new Date(entry.time).toDateString();
    if (key === today) continue;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(entry);
    else byDay.set(key, [entry]);
  }

  return [...byDay.entries()].slice(0, 5).map(([key, entries]) => {
    const temps = entries.map((e) => e.data.air_temperature).filter((v) => typeof v === "number");
    const min = Math.round(Math.min(...temps));
    const max = Math.round(Math.max(...temps));

    // Representative icon: the entry closest to local midday.
    const midday = entries.reduce((best, e) =>
      Math.abs(new Date(e.time).getHours() - 12) < Math.abs(new Date(best.time).getHours() - 12)
        ? e
        : best,
    );

    return {
      day: DAYS_OF_WEEK[new Date(key).getDay()],
      icon: getWeatherIconName(midday.data.symbol_code ?? 1, false),
      temp: `${min}°/${max}°`,
    };
  });
}

export async function getWeatherDisplayData(): Promise<WeatherDisplayData | null> {
  const data = await fetchWeatherData();
  const series = data?.timeSeries ?? [];
  if (series.length === 0) return null;

  const now = new Date();
  const lat = parseFloat(config.weatherLat);
  const lon = parseFloat(config.weatherLon);

  const current = series.find((e) => new Date(e.time) >= now) ?? series[0];
  const temp = current.data.air_temperature ?? 0;
  const windSpeed = current.data.wind_speed ?? 0;
  const symbolCode = current.data.symbol_code ?? 1;

  const { sunrise, sunset } = sunTimes(now, lat, lon);
  const isNight = sunrise && sunset ? now < sunrise || now > sunset : false;
  const sunLabel = sunrise && sunset ? `${fmtTime(sunrise)} / ${fmtTime(sunset)}` : "--:-- / --:--";

  return {
    current: {
      temp: `${Math.round(temp)}°`,
      icon: getWeatherIconName(symbolCode, isNight),
      windSpeed: `${Math.round(windSpeed)} m/s`,
      sunTimes: sunLabel,
      rain: `${getRainTotal(series, now).toFixed(1)} mm`,
      uvInfo: getUvInfo(series, now, lat, lon, current.data.cloud_area_fraction ?? 0),
    },
    forecast: buildForecast(series, now),
  };
}
