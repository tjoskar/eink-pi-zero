/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern.
 */
import { jsx, Icon, createState } from "#lib";
import { config } from "../../config.ts";

export const ENGINE_HEATER_TOPIC = `${config.mqttTopicPrefix}/statechange/engine_heater`;
export const ENGINE_HEATER_REQUEST_TOPIC = `${config.mqttTopicPrefix}/statechange/request/engine_heater`;

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
}

const initialDevices = new Map<string, DeviceState>([
  [
    `${config.mqttTopicPrefix}/statechange/washing_machine`,
    { label: "Washing Machine", icon: "local_laundry_service", on: false },
  ],
  [
    `${config.mqttTopicPrefix}/statechange/dryer`,
    { label: "Dryer", icon: "dry_cleaning", on: false },
  ],
  [
    `${config.mqttTopicPrefix}/statechange/engine_heater`,
    { label: "Engine Heater", icon: "local_fire_department", on: false },
  ],
  [
    `${config.mqttTopicPrefix}/statechange/bike_charger`,
    { label: "Bike Charger", icon: "electric_bike", on: false },
  ],
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
  return <Icon name={device.icon} size={36} color={device.on ? "black" : "lightGray"} />;
}
