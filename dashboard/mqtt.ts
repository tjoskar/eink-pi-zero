import mqtt from "mqtt";
import { config } from "./config.ts";

/** Debounce delay in ms to batch rapid MQTT messages before rendering */
const RENDER_DEBOUNCE_MS = 3000;

/**
 * Liveness of the Dashboard, retained: `online` on connect, `offline` on a
 * clean shutdown or, via the last will, when the connection is lost. Home
 * Assistant notifies when it has been `offline` for more than 10 minutes.
 */
const STATUS_TOPIC = "controlpanel/status";

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
  /** Topics (or wildcards) to subscribe to. */
  topics: string[];
  /** Handle a message; return true if it changed rendered state. */
  onMessage: (topic: string, value: string) => boolean;
  onUpdate: () => void;
}): { publish: (topic: string, payload: string) => void } & AsyncDisposable {
  const url = `mqtt://${config.mqttHost}:${config.mqttPort}`;
  console.log(`Connecting to MQTT broker at ${url}...`);

  const debouncer = createDebouncedUpdater(opts.onUpdate);

  const client = mqtt.connect(url, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    // Drop publishes made while offline instead of sending them on reconnect:
    // a late engine heater Request would switch it long after the Dashboard
    // showed "no answer".
    queueQoSZero: false,
    will: { topic: STATUS_TOPIC, payload: Buffer.from("offline"), qos: 1, retain: true },
  });

  client.on("connect", () => {
    console.log(`Connected to MQTT broker. Subscribing to ${opts.topics.join(", ")}`);
    client.subscribe(opts.topics);
    client.publish(STATUS_TOPIC, "online", { qos: 1, retain: true });
  });

  client.on("message", (topic: string, payload: Buffer) => {
    const value = payload.toString().toLowerCase();
    if (value !== "on" && value !== "off") return;
    if (opts.onMessage(topic, value)) {
      debouncer.schedule();
    }
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
      // A clean disconnect does not fire the last will, so say it ourselves.
      // QoS 0: written before the DISCONNECT, and `endAsync` never waits for
      // an acknowledgement that a dropped connection would never deliver.
      if (client.connected) client.publish(STATUS_TOPIC, "offline", { qos: 0, retain: true });
      await client.endAsync();
    },
  };
}
