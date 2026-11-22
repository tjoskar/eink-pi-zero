/**
 * Maps OpenWeatherMap icon codes to Material Icon names.
 *
 * OpenWeatherMap codes: https://openweathermap.org/weather-conditions
 * Material Icons: https://fonts.google.com/icons
 */

const WEATHER_ICON_MAP: Record<string, string> = {
  // Clear
  "01d": "clear_day",
  "01n": "clear_night",
  // Partly cloudy
  "02d": "partly_cloudy_day",
  "02n": "partly_cloudy_night",
  // Cloudy
  "03d": "partly_cloudy_day",
  "03n": "partly_cloudy_night",
  "04d": "partly_cloudy_day",
  "04n": "partly_cloudy_night",
  // Rain
  "09d": "rainy_heavy",
  "09n": "rainy_heavy",
  "10d": "rainy",
  "10n": "rainy",
  // Thunderstorm
  "11d": "thunderstorm",
  "11n": "thunderstorm",
  // Snow
  "13d": "severe_cold",
  "13n": "severe_cold",
  // Mist / fog
  "50d": "blur_on",
  "50n": "foggy",
};

export function getWeatherIconName(code: string): string {
  return WEATHER_ICON_MAP[code] ?? "cloud";
}
