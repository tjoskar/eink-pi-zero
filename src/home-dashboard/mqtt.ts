import mqtt from "mqtt";

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = Number(process.env.MQTT_PORT);
const MQTT_USER = process.env.MQTT_USERNAME;
const MQTT_PASS = process.env.MQTT_PASSWORD;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX;

/** Debounce delay in ms to batch rapid MQTT messages before rendering */
const RENDER_DEBOUNCE_MS = 3000;

export function validateMqttEnv(): void {
  if (!MQTT_USER || !MQTT_PASS || !MQTT_TOPIC_PREFIX || !MQTT_HOST || !MQTT_PORT) {
    throw new Error("Missing required MQTT environment variables");
  }
}

function createDebouncedUpdater(onUpdate: () => void): {
  schedule: () => void;
  [Symbol.dispose]: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      timer?.[Symbol.dispose]();
      timer = setTimeout(() => {
        timer = null;
        onUpdate();
      }, RENDER_DEBOUNCE_MS);
    },
    [Symbol.dispose]() {
      timer?.[Symbol.dispose]();
      timer = null;
    },
  };
}

export function connectMqtt(opts: {
  onMessage: (topic: string, value: string) => void;
  onUpdate: () => void;
}): AsyncDisposable {
  const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
  console.log(`Connecting to MQTT broker at ${url}...`);

  const debouncer = createDebouncedUpdater(opts.onUpdate);

  const client = mqtt.connect(url, {
    username: MQTT_USER,
    password: MQTT_PASS,
  });

  client.on("connect", () => {
    const topic = `${MQTT_TOPIC_PREFIX}/#`;
    console.log(`Connected to MQTT broker. Subscribing to ${topic}`);
    client.subscribe(topic);
  });

  client.on("message", (topic: string, payload: Buffer) => {
    const value = payload.toString().toLowerCase();
    if (value !== "on" && value !== "off") return;
    opts.onMessage(topic, value);
    debouncer.schedule();
  });

  client.on("error", (err) => {
    console.error("MQTT error", err);
  });

  client.on("offline", () => {
    console.log("MQTT client offline");
  });

  client.on("reconnect", () => {
    console.log("MQTT reconnecting...");
  });

  return {
    async [Symbol.asyncDispose]() {
      debouncer[Symbol.dispose]();
      console.log("Disconnecting MQTT...");
      await client.endAsync();
    },
  };
}
