/**
 * Device column: one icon per Device, black when on and lightGray when off.
 *
 * A running Device with an End time shows it as `HH:MM` under its icon. A
 * Device whose Request got no answer gets a small "no answer" mark next to
 * its icon.
 */
import { Icon, createState } from "@tjoskar/eink";

const STATECHANGE_PREFIX = "controlpanel/statechange/";
const END_TIME_PREFIX = "controlpanel/end_time/";

/** Every Device's on/off state, published retained by Home Assistant. */
export const STATECHANGE_TOPICS = `${STATECHANGE_PREFIX}#`;
/**
 * End times, published retained by Home Assistant as an ISO-8601 time;
 * an empty payload clears one when its Device turns off.
 */
export const END_TIME_TOPICS = `${END_TIME_PREFIX}#`;
/** Confirmed state of the engine heater. */
export const ENGINE_HEATER_TOPIC = `${STATECHANGE_PREFIX}engine_heater`;
/** Requests to switch the engine heater on or off. */
export const ENGINE_HEATER_REQUEST_TOPIC = `${STATECHANGE_PREFIX}request/engine_heater`;

export interface DeviceState {
  label: string;
  icon: string;
  on: boolean;
  /** When the running Device is expected to finish; shown only while on. */
  endTime?: Date;
  /** A Request got no answer; shown until the next Confirmed state. */
  noAnswer?: boolean;
}

/** The Devices in the order they are shown, keyed by their statechange topic. */
const initialDevices = new Map<string, DeviceState>([
  [
    `${STATECHANGE_PREFIX}washing_machine`,
    { label: "Washing Machine", icon: "local_laundry_service", on: false },
  ],
  [`${STATECHANGE_PREFIX}dryer`, { label: "Dryer", icon: "laundry", on: false }],
  [`${STATECHANGE_PREFIX}dishwasher`, { label: "Dishwasher", icon: "flatware", on: false }],
  [`${STATECHANGE_PREFIX}printer`, { label: "3D Printer", icon: "view_in_ar", on: false }],
  [ENGINE_HEATER_TOPIC, { label: "Engine Heater", icon: "directions_car", on: false }],
  [
    `${STATECHANGE_PREFIX}bike_charger`,
    { label: "Bike Charger", icon: "electric_bike", on: false },
  ],
]);

export const devicesState = createState(initialDevices);

/**
 * Store a Device's Confirmed state. Returns true (render) when it changed.
 * The engine heater is not handled here; see `engine-heater.ts`.
 */
export function setConfirmedState(topic: string, on: boolean): boolean {
  const devices = devicesState.get();
  const device = devices.get(topic);
  if (!device || device.on === on) return false;
  // A Device that turns off has finished; its End time must not show at its
  // next run, even if the empty End time from Home Assistant is lost.
  const endTime = on ? device.endTime : undefined;
  devicesState.set(new Map(devices).set(topic, { ...device, on, endTime }));
  console.log(`${device.label}: ${on ? "ON" : "OFF"}`);
  return true;
}

export function isEndTimeTopic(topic: string): boolean {
  return topic.startsWith(END_TIME_PREFIX);
}

/**
 * Store a Device's End time. An empty or unreadable payload clears it.
 *
 * Returns true (render) only when a running Device gets an End time while
 * none is shown, so the time appears even if it arrives after the Device's
 * own render. A changed End time waits for the next render: a finishing
 * estimate may be updated often, and each update must not refresh the panel.
 * So a changed or cleared End time can stay on the panel until the next
 * scheduled render (hourly, none between 00:00 and 05:00).
 *
 * An End time for a Device that is off is kept, since retained messages
 * arrive in any order at connect. If Home Assistant's empty payload is lost
 * and the Dashboard restarts, a stale End time therefore shows at the
 * Device's next run until Home Assistant publishes a new one.
 */
export function setEndTime(topic: string, payload: string): boolean {
  const deviceTopic = STATECHANGE_PREFIX + topic.slice(END_TIME_PREFIX.length);
  const devices = devicesState.get();
  const device = devices.get(deviceTopic);
  if (!device) return false;

  const time = new Date(payload);
  const endTime = payload === "" || Number.isNaN(time.getTime()) ? undefined : time;
  devicesState.set(new Map(devices).set(deviceTopic, { ...device, endTime }));
  return device.on && !device.endTime && endTime !== undefined;
}

export function DeviceColumn() {
  const devices = devicesState.get();
  return (
    <view direction="column" gap={8}>
      {Array.from(devices.values(), (device) => (
        <DeviceItem device={device} />
      ))}
    </view>
  );
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

function DeviceItem({ device }: { device: DeviceState }) {
  const icon = <DeviceIcon device={device} />;
  if (!device.on || !device.endTime) return icon;
  return (
    <view direction="column" gap={2}>
      {icon}
      <text size={14} color="black">
        {formatTime(device.endTime)}
      </text>
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
