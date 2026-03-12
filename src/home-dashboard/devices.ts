/**
 * Device configuration for the home dashboard.
 *
 * Uses full MQTT topics as keys for O(1) lookups in the message handler.
 * Topic prefix is read from environment at module load time.
 */

const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? "";

export interface DeviceConfig {
  label: string;
  icon: string;
}

/**
 * Devices keyed by full MQTT topic.
 *
 * Icon mapping from Python v1 Unicode glyphs:
 *   \ue832 → local_laundry_service
 *   \ue54a → dry_cleaning
 *   \ue531 → local_fire_department
 *   \ueb1b → electric_bike
 */
export const DEVICES: Map<string, DeviceConfig> = new Map([
  [`${MQTT_TOPIC_PREFIX}/statechange/washing_machine`, { label: "Washing Machine", icon: "local_laundry_service" }],
  [`${MQTT_TOPIC_PREFIX}/statechange/dryer`, { label: "Dryer", icon: "dry_cleaning" }],
  [`${MQTT_TOPIC_PREFIX}/statechange/engine_heater`, { label: "Engine Heater", icon: "local_fire_department" }],
  [`${MQTT_TOPIC_PREFIX}/statechange/bike_charger`, { label: "Bike Charger", icon: "electric_bike" }],
]);
