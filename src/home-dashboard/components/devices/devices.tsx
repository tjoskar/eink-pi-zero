/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern.
 */
import { jsx, Icon, createState } from "#lib";

const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? "";

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
}

const initialDevices = new Map<string, DeviceState>([
  [`${MQTT_TOPIC_PREFIX}/statechange/washing_machine`, { label: "Washing Machine", icon: "local_laundry_service", on: false }],
  [`${MQTT_TOPIC_PREFIX}/statechange/dryer`, { label: "Dryer", icon: "dry_cleaning", on: false }],
  [`${MQTT_TOPIC_PREFIX}/statechange/engine_heater`, { label: "Engine Heater", icon: "local_fire_department", on: false }],
  [`${MQTT_TOPIC_PREFIX}/statechange/bike_charger`, { label: "Bike Charger", icon: "electric_bike", on: false }],
]);

export const devicesState = createState(initialDevices);

export function DeviceColumn() {
  const devices = devicesState.get();
  return (
    <view direction="column" gap={8}>
      {Array.from(devices.values(), (device) => (
        <DeviceIcon device={device} />
      ))}
    </view>
  );
}

function DeviceIcon({ device }: { device: DeviceState }) {
  return (
    <Icon
      name={device.icon}
      size={36}
      color={device.on ? "black" : "lightGray"}
    />
  );
}
