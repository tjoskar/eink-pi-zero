/**
 * MQTT Device Status — App component.
 *
 * Renders a vertical column of device icons. Each icon is black when
 * the device is on and lightGray when off, matching the Python v1 layout.
 */

import {
  jsx,
  Icon,
  createCanvas,
  render,
  registerFont,
  registerIconFont,
  setTheme,
  EINK_BW_THEME,
} from "#jsx/mod.js";

// Configure theme and fonts before any rendering
setTheme({ ...EINK_BW_THEME, defaultFont: "Noto Sans" });
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");
registerIconFont();

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

function App({ devices }: { devices: DeviceState[] }) {
  return (
    <view
      width={800}
      height={480}
      padding={16}
      direction="column"
      gap={8}
      background="white"
    >
      {devices.map((device) => (
        <DeviceIcon device={device} />
      ))}
    </view>
  );
}

/**
 * Render the device status display to a PNG buffer.
 */
export async function renderApp(devices: DeviceState[]): Promise<Buffer> {
  const canvas = createCanvas(800, 480);
  await render(<App devices={devices} />, canvas);
  return canvas.toPng();
}
