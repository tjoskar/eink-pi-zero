/**
 * The weather section's data: the SMHI Forecast, UV from Open-Meteo, and the
 * outdoor temperature Reading.
 *
 * Weather data: SMHI open data (CC BY 4.0). UV index: Open-Meteo.com (CC BY 4.0).
 *
 * Config via environment variables:
 *   WEATHER_LAT, WEATHER_LON — the house, in decimal degrees
 *   API_TIMEOUT              — milliseconds
 */

import { getWeatherIconName } from "./weather-icons.ts";
import { isSunUp, sunTimes } from "./solar.ts";
import { getForecastSteps, type ForecastStep } from "./smhi.ts";
import { getUvHours, type UvHour } from "./uv.ts";
import { getReading, OUTDOOR_TEMPERATURE_TOPIC } from "../../readings.ts";
import { config } from "../../config.ts";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UV index from which the high-UV hours are shown. */
const HIGH_UV = 3;

export interface CurrentWeather {
  temp: string;
  icon: string; // Material Icon name
  windSpeed: string;
  sunTimes: string;
  rain: string;
  /** null hides the UV row. */
  uvInfo: string | null;
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

const fmtTime = (d: Date) => d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function nearest(steps: ForecastStep[], now: Date): ForecastStep {
  return steps.reduce((best, step) =>
    Math.abs(step.time.getTime() - now.getTime()) < Math.abs(best.time.getTime() - now.getTime())
      ? step
      : best,
  );
}

/** Forecast precipitation (mm) for the rest of today. */
function rainRestOfToday(steps: ForecastStep[], now: Date): number {
  let total = 0;
  for (const step of steps) {
    if (step.time <= now || !isSameDay(step.intervalStart, now)) continue;
    total += step.precipitation ?? 0;
  }
  return total;
}

/**
 * UV now, plus today's peak and high-UV hours when it gets strong:
 * `1 (4, 11 - 14)`. null when there is no UV data for today.
 */
function uvInfo(hours: UvHour[], now: Date): string | null {
  const today = hours.filter((h) => isSameDay(h.start, now));
  if (today.length === 0) return null;

  const current = today.reduce((best, h) =>
    Math.abs(h.start.getTime() + 1_800_000 - now.getTime()) <
    Math.abs(best.start.getTime() + 1_800_000 - now.getTime())
      ? h
      : best,
  );
  const high = today.filter((h) => h.uv >= HIGH_UV).map((h) => h.start.getHours());
  if (high.length === 0) return `${Math.round(current.uv)}`;

  const max = Math.max(...today.map((h) => h.uv));
  return `${Math.round(current.uv)} (${Math.round(max)}, ${Math.min(...high)} - ${Math.max(...high)})`;
}

/** The next five days after today: min/max temperature and the symbol nearest midday. */
function fiveDays(steps: ForecastStep[], now: Date): ForecastDay[] {
  const byDay = new Map<string, ForecastStep[]>();
  for (const step of steps) {
    if (isSameDay(step.time, now) || step.time < now) continue;
    const key = step.time.toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), step]);
  }

  const days: ForecastDay[] = [];
  for (const daySteps of byDay.values()) {
    if (days.length === 5) break;
    const temps = daySteps.flatMap((s) => (s.temperature === undefined ? [] : [s.temperature]));
    if (temps.length === 0) continue;

    const date = daySteps[0].time;
    const midday = new Date(date);
    midday.setHours(12, 0, 0, 0);
    days.push({
      day: DAYS_OF_WEEK[date.getDay()],
      icon: getWeatherIconName(nearest(daySteps, midday).symbol, false),
      temp: `${Math.round(Math.min(...temps))}°/${Math.round(Math.max(...temps))}°`,
    });
  }
  return days;
}

/**
 * null when SMHI is down and the cache is empty or entirely in the past:
 * the section shows "Väderdata saknas".
 */
export async function getWeatherDisplayData(): Promise<WeatherDisplayData | null> {
  // A UV failure only hides the UV row, never the whole section.
  const [steps, uvHours] = await Promise.all([
    getForecastSteps(),
    getUvHours().catch((err: unknown) => {
      console.error("UV failed:", err);
      return [];
    }),
  ]);
  const now = new Date();
  // A stale cache can hold nothing but the past (SMHI down for over a week): no Forecast either.
  if (!steps.some((s) => s.time >= now)) return null;

  const lat = Number(config.weatherLat);
  const lon = Number(config.weatherLon);

  // Until the first Reading: SMHI's first step at or after now with a temperature.
  const forecastTemp = steps.find((s) => s.time >= now && s.temperature !== undefined)?.temperature;
  const temp = getReading(OUTDOOR_TEMPERATURE_TOPIC) ?? forecastTemp;
  const current = nearest(steps, now);
  const { sunrise, sunset } = sunTimes(now, lat, lon);

  return {
    current: {
      temp: temp === undefined ? "–" : `${Math.round(temp)}°`,
      icon: getWeatherIconName(current.symbol, !isSunUp(now, lat, lon)),
      windSpeed: current.windSpeed === undefined ? "–" : `${Math.round(current.windSpeed)} m/s`,
      sunTimes: `${sunrise ? fmtTime(sunrise) : "--:--"} / ${sunset ? fmtTime(sunset) : "--:--"}`,
      rain: `${rainRestOfToday(steps, now).toFixed(1)} mm`,
      uvInfo: uvInfo(uvHours, now),
    },
    forecast: fiveDays(steps, now),
  };
}
