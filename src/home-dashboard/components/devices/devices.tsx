/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern.
 */
import { jsx, Icon, createState } from "#lib";
import { DEVICES_CONFIG } from "../../../mqtt-device-status/devices.ts";

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
}

const initialDevices: DeviceState[] = DEVICES_CONFIG.map((d) => ({
  label: d.label,
  icon: d.icon,
  on: false,
}));

export const devicesState = createState<DeviceState[]>(initialDevices);

export function DeviceColumn() {
  const devices = devicesState.get();
  return (
    <view direction="column" gap={8}>
      {devices.map((device) => (
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
