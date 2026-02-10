/**
 * Hello World example - App component.
 *
 * A simple JSX component that displays:
 * - "Hello E-Ink!" title
 * - Current timestamp
 * - Button press counter
 */

import { jsx, Fragment, render, createCanvas, registerFont, setTheme, EINK_BW_THEME } from "#jsx/mod.js";

// Configure theme with custom default font
setTheme({
  ...EINK_BW_THEME,
  defaultFont: "Noto Sans",
});

// Register fonts before rendering - required for Pi Zero which has no system fonts
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");

export interface AppProps {
  buttonPresses: number;
  lastUpdate: Date;
}

/**
 * Main app component.
 */
export function App({ buttonPresses, lastUpdate }: AppProps) {
  const timeStr = lastUpdate.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateStr = lastUpdate.toLocaleDateString("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <view
      width={800}
      height={480}
      padding={40}
      direction="column"
      gap={20}
      justify="between"
      background="white"
    >
      {/* Header */}
      <view direction="column" gap={8} height={60}>
        <text size={48} weight="bold" color="black">
          Hej Emma!
        </text>
      </view>

      {/* Status */}
      <view
        direction="column"
        gap={16}
        padding={24}
        height={180}
        background="white"
      >
        <view direction="row" gap={16} align="center">
          <text size={24} color="darkGray">
            Date: {dateStr}
          </text>
        </view>
        <view direction="row" gap={16} align="center">
          <text size={32} weight="bold" color="black">
            Time: {timeStr}
          </text>
        </view>
        <view direction="row" gap={16} align="center">
          <text size={20} color="black">
            Button presses: {buttonPresses}
          </text>
        </view>
      </view>

      {/* Footer */}
      <view direction="row" justify="center" height={30}>
        <text size={16} color="black">
          Press button to update
        </text>
      </view>
    </view>
  );
}

/**
 * Render the app to a PNG buffer.
 */
export async function renderApp(props: AppProps): Promise<Buffer> {
  const canvas = createCanvas(800, 480);
  const element = <App {...props} />;
  await render(element, canvas);
  return canvas.toPng();
}
