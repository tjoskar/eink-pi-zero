/**
 * OpenWeatherMap 3.0 OneCall API — fetch, cache, and transform.
 *
 * Config via environment variables:
 *   WEATHER_API_KEY  — required
 *   WEATHER_LAT      — latitude  (default: 59.3293 — Stockholm)
 *   WEATHER_LON      — longitude (default: 18.0686)
 *   WEATHER_UNITS    — standard | metric | imperial (default: metric)
 *   WEATHER_LANG     — language code (default: en)
 *   CACHE_DURATION   — seconds (default: 3600)
 *   API_TIMEOUT      — milliseconds (default: 10000)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getWeatherIconName } from "./weather-icons.ts";
import { request, getCachePath } from "#lib";

const API_KEY = process.env.WEATHER_API_KEY ?? "";
const LAT = process.env.WEATHER_LAT ?? "59.3293";
const LON = process.env.WEATHER_LON ?? "18.0686";
const UNITS = process.env.WEATHER_UNITS ?? "metric";
const LANG = process.env.WEATHER_LANG ?? "en";
const CACHE_DURATION_S = Number(process.env.CACHE_DURATION ?? 3600);
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT ?? 10_000);

const CACHE_FILE = getCachePath("weather_cache.json");

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

interface CacheEnvelope {
  timestamp: number;
  data: Record<string, unknown>;
}

function readCache(opts?: { allowStale?: boolean }): Record<string, unknown> | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const envelope: CacheEnvelope = JSON.parse(
      readFileSync(CACHE_FILE, "utf-8"),
    );
    if (opts?.allowStale || Date.now() / 1000 - envelope.timestamp < CACHE_DURATION_S) {
      return envelope.data;
    }
  } catch (e) {
    console.log("Cache read error:", e);
  }
  return null;
}

function writeCache(data: Record<string, unknown>): void {
  try {
    const envelope: CacheEnvelope = { timestamp: Date.now() / 1000, data };
    writeFileSync(CACHE_FILE, JSON.stringify(envelope));
  } catch (e) {
    console.log("Cache write error:", e);
  }
}

async function fetchFromApi(): Promise<Record<string, any>> {
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${LAT}&lon=${LON}&units=${UNITS}&lang=${LANG}&appid=${API_KEY}`;

  const res = await request(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`OpenWeatherMap API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as Record<string, any>;
}

async function fetchWeatherData(): Promise<Record<string, any> | null> {
  const cached = readCache();
  if (cached) return cached;

  try {
    const data = await fetchFromApi();
    writeCache(data);
    return data;
  } catch (e) {
    console.log("Weather fetch failed, trying stale cache:", e);
    const stale = readCache({ allowStale: true });
    if (stale) {
      console.log("Using stale weather cache as fallback");
      return stale;
    }
    return null;
  }
}

function getRainTotal(data: Record<string, any>): number {
  const current = data.current ?? {};
  const now = new Date((current.dt ?? Date.now() / 1000) * 1000);
  const today = now.toDateString();
  const hourly: any[] = data.hourly ?? [];

  if (hourly.length === 0) {
    return current.rain?.["1h"] ?? 0;
  }

  let total = 0;
  for (const hour of hourly) {
    const hourDate = new Date((hour.dt ?? 0) * 1000);
    if (hourDate.toDateString() !== today) continue;
    if (hourDate < now) continue;
    total += hour.rain?.["1h"] ?? 0;
  }
  return total;
}

function getUvInfo(data: Record<string, any>): string {
  const current = data.current ?? {};
  const currentUv = current.uvi ?? 0;
  const now = new Date((current.dt ?? Date.now() / 1000) * 1000);
  const today = now.toDateString();

  let maxUv = currentUv;
  const highUvHours: number[] = [];

  for (const hour of (data.hourly ?? []) as any[]) {
    const hourDate = new Date((hour.dt ?? 0) * 1000);
    if (hourDate.toDateString() !== today) continue;

    const uv = hour.uvi ?? 0;
    if (uv > maxUv) maxUv = uv;
    if (uv >= 3) highUvHours.push(hourDate.getHours());
  }

  if (highUvHours.length === 0) {
    return `${Math.round(currentUv)}`;
  }

  const minH = Math.min(...highUvHours);
  const maxH = Math.max(...highUvHours);
  return `${Math.round(currentUv)} (${Math.round(maxUv)}, ${minH} - ${maxH})`;
}

export async function getWeatherDisplayData(): Promise<WeatherDisplayData | null> {
  const data = await fetchWeatherData();
  if (!data) return null;

  const current = data.current ?? {};
  const temp = current.temp ?? 0;
  const iconCode = current.weather?.[0]?.icon ?? "01d";
  const windSpeed = current.wind_speed ?? 0;

  const sunrise = new Date((current.sunrise ?? 0) * 1000);
  const sunset = new Date((current.sunset ?? 0) * 1000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  const rainTotal = getRainTotal(data);
  const uvInfo = getUvInfo(data);

  const daily: any[] = data.daily ?? [];
  const forecast: ForecastDay[] = daily.slice(1, 6).map((day) => {
    const dt = new Date((day.dt ?? 0) * 1000);
    const dayIconCode = day.weather?.[0]?.icon ?? "01d";
    const min = Math.round(day.temp?.min ?? 0);
    const max = Math.round(day.temp?.max ?? 0);
    return {
      day: DAYS_OF_WEEK[dt.getDay()],
      icon: getWeatherIconName(dayIconCode),
      temp: `${min}°/${max}°`,
    };
  });

  return {
    current: {
      temp: `${Math.round(temp)}°`,
      icon: getWeatherIconName(iconCode),
      windSpeed: `${Math.round(windSpeed)} m/s`,
      sunTimes: `${fmt(sunrise)} / ${fmt(sunset)}`,
      rain: `${rainTotal.toFixed(1)} mm`,
      uvInfo,
    },
    forecast,
  };
}
