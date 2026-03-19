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

import { getWeatherIconName } from "./weather-icons.ts";
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

const cache = createCache<Record<string, unknown>>({
  file: "weather_cache.json",
  get ttlSeconds() {
    return config.cacheDuration;
  },
  label: "Weather",
});

async function fetchFromApi(): Promise<Record<string, unknown> | null> {
  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${config.weatherLat}&lon=${config.weatherLon}&units=${config.weatherUnits}&lang=${config.weatherLang}&appid=${config.weatherApiKey}`;

  return fetchJson<Record<string, unknown>>(url, {
    timeout: config.apiTimeout,
    label: "Weather",
  });
}

async function fetchWeatherData(): Promise<Record<string, unknown> | null> {
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

const fmtTime = (d: Date) => d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

export async function getWeatherDisplayData(): Promise<WeatherDisplayData | null> {
  const data = await fetchWeatherData();
  if (!data) return null;

  const current = data.current ?? {};
  const temp = (current as any).temp ?? 0;
  const iconCode = (current as any).weather?.[0]?.icon ?? "01d";
  const windSpeed = (current as any).wind_speed ?? 0;

  const sunrise = new Date(((current as any).sunrise ?? 0) * 1000);
  const sunset = new Date(((current as any).sunset ?? 0) * 1000);

  const rainTotal = getRainTotal(data as Record<string, any>);
  const uvInfo = getUvInfo(data as Record<string, any>);

  const daily: any[] = (data as any).daily ?? [];
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
      sunTimes: `${fmtTime(sunrise)} / ${fmtTime(sunset)}`,
      rain: `${rainTotal.toFixed(1)} mm`,
      uvInfo,
    },
    forecast,
  };
}
