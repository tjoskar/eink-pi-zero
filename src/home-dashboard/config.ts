const _config = {
  mqttHost: String(process.env.MQTT_HOST ?? ""),
  mqttPort: Number(process.env.MQTT_PORT ?? 1883),
  mqttUsername: String(process.env.MQTT_USERNAME ?? ""),
  mqttPassword: String(process.env.MQTT_PASSWORD ?? ""),
  mqttTopicPrefix: String(process.env.MQTT_TOPIC_PREFIX ?? ""),
  tibberToken: String(process.env.TIBBER_TOKEN ?? ""),
  weatherApiKey: String(process.env.WEATHER_API_KEY ?? ""),
  weatherLat: String(process.env.WEATHER_LAT ?? ""),
  weatherLon: String(process.env.WEATHER_LON ?? ""),
  weatherUnits: String(process.env.WEATHER_UNITS ?? ""),
  weatherLang: String(process.env.WEATHER_LANG ?? ""),
  cacheDuration: Number(process.env.CACHE_DURATION ?? 3600),
  apiTimeout: Number(process.env.API_TIMEOUT ?? 1_000),
  dishesApiUrl: String(process.env.DISHES_API_URL ?? ""),
  renderOnce: process.env.RENDER_ONCE === "1",
};

export type Config = typeof _config;

/**
 * Set config overrides (typically in tests).
 */
export function overrideConfig(partial: Partial<Config>): void {
  Object.assign(_config, partial);
}

export const config: Config = new Proxy(_config, {
  get(target, prop) {
    if (prop in target) {
      return target[prop as keyof Config];
    }
    throw new Error(`Config property "${String(prop)}" does not exist. Add it to the .env file`);
  },
});
