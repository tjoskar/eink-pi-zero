/**
 * Readings: measured values Home Assistant publishes retained under
 * `controlpanel/reading/<name>`, as a plain number (e.g. `3.4`).
 *
 * A Reading never triggers a render; the latest value shows at the next
 * scheduled render.
 */
import { createState } from "@tjoskar/eink";

const READING_PREFIX = "controlpanel/reading/";
export const READING_TOPICS = `${READING_PREFIX}#`;
export const OUTDOOR_TEMPERATURE_TOPIC = `${READING_PREFIX}outdoor_temperature`;

export const readingsState = createState(new Map<string, number>());

export function isReadingTopic(topic: string): boolean {
  return topic.startsWith(READING_PREFIX);
}

/**
 * Store a Reading. A payload that is not a number (e.g. `unavailable`)
 * clears it, so the Dashboard falls back to whatever it shows without one.
 */
export function setReading(topic: string, payload: string): void {
  const value = Number(payload);
  const readings = new Map(readingsState.get());
  if (payload.trim() === "" || !Number.isFinite(value)) {
    readings.delete(topic);
  } else {
    readings.set(topic, value);
  }
  readingsState.set(readings);
}

export function getReading(topic: string): number | undefined {
  return readingsState.get().get(topic);
}
