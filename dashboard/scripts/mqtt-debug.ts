/**
 * MQTT debug client: prints every message on a topic filter.
 *
 * Usage (uses the same MQTT_* variables as the Dashboard):
 *   node --env-file=.env scripts/mqtt-debug.ts [filter] [--retained]
 *
 *   filter      Topic filter, default `controlpanel/#`.
 *   --retained  Print what the broker holds retained, then exit once no new
 *               message has arrived for 2 s. Without it, keep listening.
 *
 * Read-only: it never publishes.
 */
import mqtt from "mqtt";

const args = process.argv.slice(2);
const retainedOnly = args.includes("--retained");
const filter = args.find((a) => !a.startsWith("--")) ?? "controlpanel/#";
const IDLE_EXIT_MS = 2000;

const url = `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT ?? 1883}`;
const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: retainedOnly ? 0 : 1000,
});

let idleTimer: ReturnType<typeof setTimeout> | undefined;
function exitWhenIdle(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void client.endAsync(), IDLE_EXIT_MS);
}

client.on("connect", () => {
  console.error(`Connected to ${url}, subscribed to ${filter}`);
  client.subscribe(filter);
  if (retainedOnly) exitWhenIdle();
});

client.on("message", (topic, payload, packet) => {
  const time = new Date().toLocaleTimeString("sv-SE");
  const flag = packet.retain ? "R" : " ";
  console.log(`${time} ${flag} ${topic} = ${JSON.stringify(payload.toString())}`);
  if (retainedOnly) exitWhenIdle();
});

client.on("error", (err) => {
  console.error("MQTT error:", err.message);
  if (retainedOnly) process.exitCode = 1;
});
