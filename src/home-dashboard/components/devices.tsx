/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern.
 */

import { jsx, Icon } from "#jsx/mod.js";

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
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

export function DeviceColumn({ devices }: { devices: DeviceState[] }) {
  return (
    <view direction="column" gap={8}>
      {devices.map((device) => (
        <DeviceIcon device={device} />
      ))}
    </view>
  );
}
