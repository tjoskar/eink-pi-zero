/**
 * Device configuration for MQTT device status display.
 *
 * Each device maps to an MQTT topic that publishes "on"/"off" payloads.
 * Icon names reference Material Icons registered via registerIconFont().
 */

export interface DeviceConfig {
  label: string;
  topic: string;
  icon: string;
}

/**
 * Devices to monitor. Topics are relative to MQTT_TOPIC_PREFIX.
 *
 * Icon mapping from Python v1 Unicode glyphs:
 *   \ue832 → local_laundry_service
 *   \ue54a → dry_cleaning
 *   \ue531 → local_fire_department
 *   \ueb1b → electric_bike
 */
export const DEVICES_CONFIG: DeviceConfig[] = [
  { label: "Washing Machine", topic: "statechange/washing_machine", icon: "local_laundry_service" },
  { label: "Dryer", topic: "statechange/dryer", icon: "dry_cleaning" },
  { label: "Engine Heater", topic: "statechange/engine_heater", icon: "local_fire_department" },
  { label: "Bike Charger", topic: "statechange/bike_charger", icon: "electric_bike" },
];
