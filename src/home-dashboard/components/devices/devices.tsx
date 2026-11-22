/**
 * Device status column — vertical list of device icons.
 *
 * Each icon is black when the device is on and lightGray when off,
 * matching the mqtt-device-status pattern. A Device whose Request got no
 * answer gets a small "no answer" mark next to its icon.
 */
import { jsx, Icon, createState } from "#lib";

/** Every Device's on/off state, published retained by Home Assistant. */
export const STATECHANGE_TOPICS = "controlpanel/statechange/#";
/** Confirmed state of the engine heater. */
export const ENGINE_HEATER_TOPIC = "controlpanel/statechange/engine_heater";
/** Requests to switch the engine heater on or off. */
export const ENGINE_HEATER_REQUEST_TOPIC = "controlpanel/statechange/request/engine_heater";

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
  /** A Request got no answer; shown until the next Confirmed state. */
  noAnswer?: boolean;
}

const initialDevices = new Map<string, DeviceState>([
  [
    "controlpanel/statechange/washing_machine",
    { label: "Washing Machine", icon: "local_laundry_service", on: false },
  ],
  ["controlpanel/statechange/dryer", { label: "Dryer", icon: "dry_cleaning", on: false }],
  [ENGINE_HEATER_TOPIC, { label: "Engine Heater", icon: "local_fire_department", on: false }],
  [
    "controlpanel/statechange/bike_charger",
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
  const icon = <Icon name={device.icon} size={36} color={device.on ? "black" : "lightGray"} />;
  if (!device.noAnswer) return icon;
  return (
    <view direction="row" gap={4} align="center">
      {icon}
      <Icon name="sync_problem" size={20} color="black" />
    </view>
  );
}
