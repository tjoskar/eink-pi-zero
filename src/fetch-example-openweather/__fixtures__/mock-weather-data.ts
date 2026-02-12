import type { WeatherDisplayData } from "../weather-api.ts";

export const MOCK_WEATHER: WeatherDisplayData = {
  current: {
    temp: "15°",
    icon: "wb_sunny",
    windSpeed: "5 m/s",
    sunTimes: "06:18 / 21:05",
    rain: "0.5 mm",
    uvInfo: "2 (3, 10 - 14)",
  },
  forecast: [
    { day: "Mon", icon: "wb_sunny", temp: "10°/20°" },
    { day: "Tue", icon: "cloud", temp: "11°/19°" },
    { day: "Wed", icon: "rainy", temp: "8°/15°" },
    { day: "Thu", icon: "wb_cloudy", temp: "9°/17°" },
    { day: "Fri", icon: "wb_sunny", temp: "12°/22°" },
  ],
};
