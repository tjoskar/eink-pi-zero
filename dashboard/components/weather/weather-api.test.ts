import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setRequest, type RequestFn } from "@tjoskar/eink";
import {
  MOCK_SMHI_RESPONSE,
  MOCK_OPEN_METEO_UV_RESPONSE,
} from "../../__fixtures__/mock-api-responses.ts";
import { overrideConfig } from "../../config.ts";
import { OUTDOOR_TEMPERATURE_TOPIC, readingsState, setReading } from "../../readings.ts";
import { getWeatherDisplayData } from "./weather-api.ts";

// The caches live in memory: each test starts empty, and a test can fill them.
const { cacheFiles, isCache } = vi.hoisted(() => ({
  cacheFiles: new Map<string, string>(),
  isCache: (path: unknown) => typeof path === "string" && path.includes(".cache"),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    mkdirSync: (path: string, ...rest: any[]) =>
      isCache(path) ? undefined : (actual.mkdirSync as any)(path, ...rest),
    existsSync: (path: string) => (isCache(path) ? cacheFiles.has(path) : actual.existsSync(path)),
    readFileSync: (path: string, ...rest: any[]) =>
      isCache(path) ? cacheFiles.get(path) : (actual.readFileSync as any)(path, ...rest),
    writeFileSync: (path: string, data: string, ...rest: any[]) =>
      isCache(path)
        ? void cacheFiles.set(path, data)
        : (actual.writeFileSync as any)(path, data, ...rest),
  };
});

type Responses = { smhi: unknown; uv: unknown };
let responses: Responses;
const requested: string[] = [];

const fakeFetch: RequestFn = async (input) => {
  const url = input instanceof Request ? input.url : input.toString();
  requested.push(url);
  const body = url.includes("smhi.se")
    ? responses.smhi
    : url.includes("open-meteo.com")
      ? responses.uv
      : undefined;
  if (body === undefined) return new Response("down", { status: 503 });
  return Response.json(body);
};

/** The SMHI fixture with each change applied to the step ending at that hour today. */
function smhiWith(changes: Record<number, Record<string, number>>) {
  const copy = structuredClone(MOCK_SMHI_RESPONSE);
  for (const [hour, change] of Object.entries(changes)) {
    const step = copy.timeSeries.find(
      (s) => new Date(s.time).getTime() === at(Number(hour)).getTime(),
    );
    Object.assign(step!.data, change);
  }
  return copy;
}

/** Saturday 2026-03-07 at `hour`:`minute`, local time. */
const at = (hour: number, minute = 0) => new Date(2026, 2, 7, hour, minute);

let restoreRequest: () => void;
let silence: Array<{ mockRestore(): void }>;

beforeAll(() => {
  overrideConfig({ weatherLat: "59.3293", weatherLon: "18.0686", apiTimeout: 1000 });
  restoreRequest = setRequest(fakeFetch);
});

afterAll(() => restoreRequest());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(14, 30));
  cacheFiles.clear();
  requested.length = 0;
  readingsState.set(new Map());
  responses = { smhi: MOCK_SMHI_RESPONSE, uv: MOCK_OPEN_METEO_UV_RESPONSE };
  silence = [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  vi.useRealTimers();
  for (const spy of silence) spy.mockRestore();
});

describe("current weather", () => {
  test("from SMHI and Open-Meteo, without a Reading", async () => {
    const data = await getWeatherDisplayData();

    expect(data?.current).toEqual({
      temp: "5°", // the 15:00 step, the first at or after 14:30
      icon: "partly_cloudy_day",
      windSpeed: "4 m/s",
      sunTimes: "06:28 / 17:31",
      rain: "1.2 mm", // 17, 18 and 19 o'clock, 0.4 mm each
      uvInfo: "2 (3, 11 - 13)",
    });
    expect(requested.some((url) => url.includes("snow1g/version/1"))).toBe(true);
  });

  test("the outdoor temperature Reading replaces SMHI's temperature", async () => {
    setReading(OUTDOOR_TEMPERATURE_TOPIC, "-3.6");
    expect((await getWeatherDisplayData())?.current.temp).toBe("-4°");
  });

  test("a Reading that is not a number clears it, back to SMHI", async () => {
    setReading(OUTDOOR_TEMPERATURE_TOPIC, "-3.6");
    setReading(OUTDOOR_TEMPERATURE_TOPIC, "unavailable");
    expect((await getWeatherDisplayData())?.current.temp).toBe("5°");
  });

  test("night icon after sunset", async () => {
    vi.setSystemTime(at(22));
    expect((await getWeatherDisplayData())?.current.icon).toBe("partly_cloudy_night");
  });

  test("a missing wind speed shows a dash, not 0 m/s", async () => {
    responses.smhi = smhiWith({ 15: { wind_speed: 9999 } });
    vi.setSystemTime(at(14, 50)); // nearest step: 15:00
    expect((await getWeatherDisplayData())?.current.windSpeed).toBe("–");
  });

  test("a missing temperature (9999) falls through to the next step", async () => {
    responses.smhi = smhiWith({ 15: { air_temperature: 9999 }, 16: { air_temperature: 12.3 } });
    expect((await getWeatherDisplayData())?.current.temp).toBe("12°");
  });

  test("-9 is a real temperature, but missing precipitation", async () => {
    responses.smhi = smhiWith({ 15: { air_temperature: -9 } });
    const withColdStep = await getWeatherDisplayData();
    expect(withColdStep?.current.temp).toBe("-9°");

    cacheFiles.clear();
    responses.smhi = smhiWith({ 18: { precipitation_amount_mean: -9 } });
    expect((await getWeatherDisplayData())?.current.rain).toBe("0.8 mm");
  });
});

describe("UV", () => {
  test("the row is hidden when Open-Meteo fails and nothing is cached", async () => {
    responses.uv = undefined;
    const data = await getWeatherDisplayData();
    expect(data?.current.uvInfo).toBeNull();
    expect(data?.current.temp).toBe("5°");
  });

  test("a stale cache is used when Open-Meteo fails", async () => {
    await getWeatherDisplayData();
    vi.setSystemTime(at(18, 30)); // past the 3 h TTL
    responses.uv = undefined;
    expect((await getWeatherDisplayData())?.current.uvInfo).toBe("0 (3, 11 - 13)");
  });

  test("just the current value when it never gets high", async () => {
    responses.uv = {
      hourly: {
        time: MOCK_OPEN_METEO_UV_RESPONSE.hourly.time,
        uv_index: MOCK_OPEN_METEO_UV_RESPONSE.hourly.uv_index.map(() => 1.4),
      },
    };
    expect((await getWeatherDisplayData())?.current.uvInfo).toBe("1");
  });
});

describe("SMHI responses", () => {
  test("a malformed step is skipped, not fatal", async () => {
    const copy = structuredClone(MOCK_SMHI_RESPONSE) as { timeSeries: unknown[] };
    copy.timeSeries.unshift(null, { time: "not a date", data: {} }, { time: at(15).toISOString() });
    responses.smhi = copy;
    expect((await getWeatherDisplayData())?.current.temp).toBe("5°");
  });

  test("late in the evening: no rain left today, the five days start tomorrow", async () => {
    vi.setSystemTime(at(23, 30));
    const data = await getWeatherDisplayData();
    expect(data?.current.rain).toBe("0.0 mm");
    expect(data?.forecast[0].day).toBe("Sun");
  });
});

describe("SMHI down", () => {
  test("with an empty cache there is no weather at all", async () => {
    responses.smhi = undefined;
    expect(await getWeatherDisplayData()).toBeNull();
  });

  test("a stale cache with only past steps counts as no weather", async () => {
    await getWeatherDisplayData();
    vi.setSystemTime(new Date(2026, 2, 20, 12)); // after the last step
    responses.smhi = undefined;
    expect(await getWeatherDisplayData()).toBeNull();
  });

  test("with a stale cache the Forecast is still shown", async () => {
    await getWeatherDisplayData();
    vi.setSystemTime(at(15, 30)); // past the 30 min TTL
    responses.smhi = undefined;
    expect((await getWeatherDisplayData())?.current.temp).toBe("5°");
  });
});

test("five days after today: min/max temperature and the symbol nearest midday", async () => {
  expect((await getWeatherDisplayData())?.forecast).toEqual([
    { day: "Sun", icon: "weather_snowy", temp: "0°/4°" },
    { day: "Mon", icon: "clear_day", temp: "-1°/3°" },
    { day: "Tue", icon: "rainy", temp: "2°/7°" },
    { day: "Wed", icon: "partly_cloudy_day", temp: "1°/6°" },
    { day: "Thu", icon: "cloud", temp: "3°/8°" },
  ]);
});
