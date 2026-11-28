/**
 * Mock API responses for home-dashboard snapshot tests.
 *
 * Frozen test time: 2026-03-07 14:30:00 (Saturday)
 */

/** Wsymb2 symbol per day from today (Sat): variable clouds, snow, clear, rain, variable, cloudy. */
const DAY_SYMBOLS = [3, 25, 1, 18, 3, 5];
/** Min/max temperature per day from today. */
const DAY_TEMPS: Array<[number, number]> = [
  [1, 5],
  [0, 4],
  [-1, 3],
  [2, 7],
  [1, 6],
  [3, 8],
];

function smhiStep(start: Date, end: Date) {
  const midnight = new Date(end);
  midnight.setHours(0, 0, 0, 0);
  const day = Math.round((midnight.getTime() - new Date(2026, 2, 7).getTime()) / 86_400_000);
  const [min, max] = DAY_TEMPS[Math.min(day, DAY_TEMPS.length - 1)];
  // Coldest at 04:00, warmest at 16:00.
  const t = min + ((max - min) * (1 - Math.cos(((end.getHours() - 4) * Math.PI) / 12))) / 2;
  const hour = end.getHours();
  return {
    time: end.toISOString(),
    intervalParametersStartTime: start.toISOString(),
    data: {
      air_temperature: Math.round(t * 10) / 10,
      wind_speed: 3.8,
      cloud_area_fraction: 5,
      // Some rain this evening, today only.
      precipitation_amount_mean: day === 0 && hour >= 17 && hour <= 19 ? 0.4 : 0.0,
      precipitation_frozen_part: -9,
      cloud_base_altitude: 9999,
      symbol_code: DAY_SYMBOLS[Math.min(day, DAY_SYMBOLS.length - 1)],
    },
  };
}

/** SMHI snow1g v1: hourly steps for two days, then every 6 hours. Starts at 14:00. */
export const MOCK_SMHI_RESPONSE = {
  createdTime: new Date(2026, 2, 7, 13, 30).toISOString(),
  referenceTime: new Date(2026, 2, 7, 13, 0).toISOString(),
  geometry: { type: "Point", coordinates: [[18.0686, 59.3293]] },
  timeSeries: (() => {
    const steps = [];
    let start = new Date(2026, 2, 7, 13, 0);
    while (start < new Date(2026, 2, 13, 22, 0)) {
      const hours = start < new Date(2026, 2, 9, 16, 0) ? 1 : 6;
      const end = new Date(start.getTime() + hours * 3_600_000);
      steps.push(smhiStep(start, end));
      start = end;
    }
    return steps;
  })(),
};

/** Open-Meteo hourly UV for today and tomorrow; each value is the mean of the hour before it. */
export const MOCK_OPEN_METEO_UV_RESPONSE = {
  timezone: "Europe/Stockholm",
  hourly: (() => {
    const time: number[] = [];
    const uv_index: number[] = [];
    for (let i = 0; i < 48; i++) {
      const end = new Date(2026, 2, 7, i);
      const startHour = (i + 23) % 24;
      time.push(end.getTime() / 1000);
      uv_index.push(startHour >= 11 && startHour <= 13 ? 3.2 : startHour === 14 ? 2.4 : 0.3);
    }
    return { time, uv_index };
  })(),
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
