/**
 * Mock API responses for home-dashboard snapshot tests.
 *
 * Frozen test time: 2026-03-07 14:30:00 (Saturday)
 */

// Local midnight of the frozen test day (Sat 2026-03-07).
const DAY_START = new Date(2026, 2, 7, 0, 0, 0).getTime();

// Wsymb2 symbol per forecast day: today + 5 ahead (variable, overcast, clear,
// rain showers, halfclear, cloudy).
const DAY_SYMBOLS = [3, 6, 1, 8, 4, 5];

/**
 * SMHI point-forecast shape: hourly `timeSeries` entries with a flat `data`
 * object. Six days of hourly points so the transform can group a 5-day forecast.
 */
export const MOCK_SMHI_RESPONSE = {
  referenceTime: new Date(DAY_START).toISOString(),
  timeSeries: Array.from({ length: 24 * 6 }, (_, hour) => {
    const t = new Date(DAY_START + hour * 3600000);
    const dayIdx = Math.floor(hour / 24);
    const hourOfDay = t.getHours();
    return {
      time: t.toISOString(),
      data: {
        air_temperature: Math.round((2 + Math.sin(hour / 4) * 3 - dayIdx * 0.5) * 10) / 10,
        wind_speed: 3.8,
        cloud_area_fraction: 40,
        precipitation_amount_mean: hourOfDay >= 13 && hourOfDay <= 15 ? 0.4 : 0,
        symbol_code: DAY_SYMBOLS[dayIdx] ?? 3,
      },
    };
  }),
};

function makePriceEntries(
  baseDate: Date,
  count: number,
  basePrice: number,
): Array<{
  total: number;
  startsAt: string;
  level: string;
}> {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setHours(i, 0, 0, 0);
    // Vary price: cheaper at night, expensive midday
    const variation = Math.sin(((i - 6) * Math.PI) / 12) * 0.3;
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

export const MOCK_DISHES_RESPONSE = [
  "Köttbullar med potatismos",
  "Laxfilé med citronsås",
  "Pasta carbonara",
  "Kycklinggryta med ris",
  "Vegetarisk lasagne",
];
