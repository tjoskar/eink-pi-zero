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
 */
export const DEVICES_CONFIG: DeviceConfig[] = [
  { label: "Washing Machine", topic: "statechange/washing_machine", icon: "local_laundry_service" },
  { label: "Dryer", topic: "statechange/dryer", icon: "laundry" },
  { label: "Engine Heater", topic: "statechange/engine_heater", icon: "directions_car" },
  { label: "Bike Charger", topic: "statechange/bike_charger", icon: "electric_bike" },
];
