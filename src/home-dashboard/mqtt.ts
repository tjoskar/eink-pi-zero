import mqtt from "mqtt";
import { config } from "./config.ts";

/** Debounce delay in ms to batch rapid MQTT messages before rendering */
const RENDER_DEBOUNCE_MS = 3000;

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
}): { publish: (topic: string, payload: string) => void } & AsyncDisposable {
  const url = `mqtt://${config.mqttHost}:${config.mqttPort}`;
  console.log(`Connecting to MQTT broker at ${url}...`);

  const debouncer = createDebouncedUpdater(opts.onUpdate);

  const client = mqtt.connect(url, {
    username: config.mqttUsername,
    password: config.mqttPassword,
  });

  client.on("connect", () => {
    const topic = `${config.mqttTopicPrefix}/#`;
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
    publish(topic: string, payload: string) {
      client.publish(topic, payload);
    },
    async [Symbol.asyncDispose]() {
      debouncer[Symbol.dispose]();
      console.log("Disconnecting MQTT...");
      await client.endAsync();
    },
  };
}
