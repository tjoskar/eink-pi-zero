/**
 * Maps SMHI weather symbol codes (Wsymb2, 1–27) to Material Icon names.
 *
 * SMHI Wsymb2: https://opendata.smhi.se/apidocs/metfcst/parameters.html
 * Material Icons: https://fonts.google.com/icons
 *
 * Wsymb2 codes are day/night agnostic, so `getWeatherIconName` takes an
 * `isNight` flag to pick a night variant where one exists. Only icon names
 * registered in lib/components/icons-name.ts render, so the mapping stays
 * within that set (snow/sleet all fall back to `severe_cold`).
 */

interface IconVariant {
  day: string;
  night: string;
}

const WSYMB2_ICON_MAP: Record<number, IconVariant> = {
  1: { day: "clear_day", night: "clear_night" }, // Clear sky
  2: { day: "clear_day", night: "clear_night" }, // Nearly clear sky
  3: { day: "partly_cloudy_day", night: "partly_cloudy_night" }, // Variable cloudiness
  4: { day: "partly_cloudy_day", night: "partly_cloudy_night" }, // Halfclear sky
  5: { day: "cloud", night: "cloud" }, // Cloudy sky
  6: { day: "cloud", night: "cloud" }, // Overcast
  7: { day: "foggy", night: "foggy" }, // Fog
  8: { day: "rainy", night: "rainy" }, // Light rain showers
  9: { day: "rainy", night: "rainy" }, // Moderate rain showers
  10: { day: "rainy_heavy", night: "rainy_heavy" }, // Heavy rain showers
  11: { day: "thunderstorm", night: "thunderstorm" }, // Thunderstorm
  12: { day: "severe_cold", night: "severe_cold" }, // Light sleet showers
  13: { day: "severe_cold", night: "severe_cold" }, // Moderate sleet showers
  14: { day: "severe_cold", night: "severe_cold" }, // Heavy sleet showers
  15: { day: "severe_cold", night: "severe_cold" }, // Light snow showers
  16: { day: "severe_cold", night: "severe_cold" }, // Moderate snow showers
  17: { day: "severe_cold", night: "severe_cold" }, // Heavy snow showers
  18: { day: "rainy", night: "rainy" }, // Light rain
  19: { day: "rainy", night: "rainy" }, // Moderate rain
  20: { day: "rainy_heavy", night: "rainy_heavy" }, // Heavy rain
  21: { day: "thunderstorm", night: "thunderstorm" }, // Thunder
  22: { day: "severe_cold", night: "severe_cold" }, // Light sleet
  23: { day: "severe_cold", night: "severe_cold" }, // Moderate sleet
  24: { day: "severe_cold", night: "severe_cold" }, // Heavy sleet
  25: { day: "severe_cold", night: "severe_cold" }, // Light snow
  26: { day: "severe_cold", night: "severe_cold" }, // Moderate snow
  27: { day: "severe_cold", night: "severe_cold" }, // Heavy snow
};

export function getWeatherIconName(code: number, isNight = false): string {
  const variant = WSYMB2_ICON_MAP[code];
  if (!variant) return "cloud";
  return isNight ? variant.night : variant.day;
}
