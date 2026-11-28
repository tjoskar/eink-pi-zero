/**
 * Maps SMHI weather symbol codes (Wsymb2, 1–27, `symbol_code` in the
 * snow1g forecast) to Material Icon names.
 *
 * Wsymb2 has no day/night variants, so the caller says whether it is night.
 * Only icon names in the Framework's icon map render; snow and sleet share
 * `weather_snowy`.
 */

const WSYMB2_ICON: Record<number, { day: string; night: string }> = {
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
  12: { day: "weather_snowy", night: "weather_snowy" }, // Light sleet showers
  13: { day: "weather_snowy", night: "weather_snowy" }, // Moderate sleet showers
  14: { day: "weather_snowy", night: "weather_snowy" }, // Heavy sleet showers
  15: { day: "weather_snowy", night: "weather_snowy" }, // Light snow showers
  16: { day: "weather_snowy", night: "weather_snowy" }, // Moderate snow showers
  17: { day: "weather_snowy", night: "weather_snowy" }, // Heavy snow showers
  18: { day: "rainy", night: "rainy" }, // Light rain
  19: { day: "rainy", night: "rainy" }, // Moderate rain
  20: { day: "rainy_heavy", night: "rainy_heavy" }, // Heavy rain
  21: { day: "thunderstorm", night: "thunderstorm" }, // Thunder
  22: { day: "weather_snowy", night: "weather_snowy" }, // Light sleet
  23: { day: "weather_snowy", night: "weather_snowy" }, // Moderate sleet
  24: { day: "weather_snowy", night: "weather_snowy" }, // Heavy sleet
  25: { day: "weather_snowy", night: "weather_snowy" }, // Light snow
  26: { day: "weather_snowy", night: "weather_snowy" }, // Moderate snow
  27: { day: "weather_snowy", night: "weather_snowy" }, // Heavy snow
};

export function getWeatherIconName(symbol: number | undefined, isNight: boolean): string {
  const variant = symbol === undefined ? undefined : WSYMB2_ICON[symbol];
  if (!variant) return "cloud";
  return isNight ? variant.night : variant.day;
}
