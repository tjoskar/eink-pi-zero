/**
 * Mock API responses for home-dashboard snapshot tests.
 *
 * Frozen test time: 2026-03-07 14:30:00 (Saturday)
 */

// ---------------------------------------------------------------------------
// OpenWeatherMap 3.0 OneCall response
// ---------------------------------------------------------------------------

const SAT_NOON = Math.floor(new Date(2026, 2, 7, 12, 0, 0).getTime() / 1000);

export const MOCK_OPENWEATHER_RESPONSE = {
  lat: 59.33,
  lon: 18.07,
  current: {
    dt: SAT_NOON + 9000, // ~14:30
    temp: 4.2,
    weather: [{ id: 802, main: "Clouds", description: "scattered clouds", icon: "03d" }],
    wind_speed: 3.8,
    sunrise: SAT_NOON - 6 * 3600 + 1080, // ~06:18
    sunset: SAT_NOON + 5 * 3600 + 3900,   // ~17:05
    uvi: 1.5,
  },
  hourly: Array.from({ length: 24 }, (_, i) => ({
    dt: SAT_NOON - 12 * 3600 + i * 3600,
    temp: 2 + Math.sin(i / 4) * 3,
    weather: [{ icon: "03d" }],
    uvi: i >= 10 && i <= 14 ? 2.5 : 0.5,
  })),
  daily: [
    // Today (Sat) + 5 forecast days
    { dt: SAT_NOON, temp: { min: 1, max: 5 }, weather: [{ icon: "03d" }] },
    { dt: SAT_NOON + 86400, temp: { min: 0, max: 4 }, weather: [{ icon: "13d" }] },
    { dt: SAT_NOON + 86400 * 2, temp: { min: -1, max: 3 }, weather: [{ icon: "01d" }] },
    { dt: SAT_NOON + 86400 * 3, temp: { min: 2, max: 7 }, weather: [{ icon: "10d" }] },
    { dt: SAT_NOON + 86400 * 4, temp: { min: 1, max: 6 }, weather: [{ icon: "02d" }] },
    { dt: SAT_NOON + 86400 * 5, temp: { min: 3, max: 8 }, weather: [{ icon: "04d" }] },
  ],
};

// ---------------------------------------------------------------------------
// Tibber GraphQL response
// ---------------------------------------------------------------------------

function makePriceEntries(baseDate: Date, count: number, basePrice: number): Array<{
  total: number;
  startsAt: string;
  level: string;
}> {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setHours(i, 0, 0, 0);
    // Vary price: cheaper at night, expensive midday
    const variation = Math.sin((i - 6) * Math.PI / 12) * 0.3;
    const total = basePrice + variation;
    let level = "NORMAL";
    if (total < 0.3) level = "CHEAP";
    if (total < 0.15) level = "VERY_CHEAP";
    if (total > 0.6) level = "EXPENSIVE";
    if (total > 0.8) level = "VERY_EXPENSIVE";
    return {
      total: Math.round(total * 10000) / 10000,
      startsAt: d.toISOString(),
      level,
    };
  });
}

const todayMidnight = new Date(2026, 2, 7, 0, 0, 0);
const tomorrowMidnight = new Date(2026, 2, 8, 0, 0, 0);

export const MOCK_TIBBER_RESPONSE = {
  data: {
    viewer: {
      homes: [
        {
          currentSubscription: {
            priceInfo: {
              today: makePriceEntries(todayMidnight, 24, 0.45),
              tomorrow: makePriceEntries(tomorrowMidnight, 24, 0.42),
            },
          },
          consumption: {
            nodes: [
              { cost: 12.5, consumption: 8.2 },
              { cost: 14.1, consumption: 9.5 },
              { cost: 10.3, consumption: 7.1 },
              { cost: 11.8, consumption: 8.8 },
              { cost: 13.2, consumption: 9.0 },
              { cost: 9.7, consumption: 6.5 },
              { cost: 15.0, consumption: 10.2 },
            ],
          },
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Dishes response (simple string array)
// ---------------------------------------------------------------------------

export const MOCK_DISHES_RESPONSE = [
  "Köttbullar med potatismos",
  "Laxfilé med citronsås",
  "Pasta carbonara",
  "Kycklinggryta med ris",
  "Vegetarisk lasagne",
];
