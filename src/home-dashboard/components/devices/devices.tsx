/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern.
 */
import { jsx, Icon, createState } from "#lib";
import { DEVICES } from "../../devices.ts";

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
}

const initialDevices = new Map<string, DeviceState>(
  Array.from(DEVICES, ([topic, config]) => [
    topic,
    { ...config, on: false },
  ]),
);

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
