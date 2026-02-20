/**
 * Icon Component
 *
 * Renders Material Icons as text using the icon font.
 * Requires the icon font to be registered before use.
 *
 * @example
 * ```tsx
 * import { registerIconFont, Icon } from "../lib/mod.ts";
 *
 * // Register the font first
 * registerIconFont();
 *
 * // Then use in JSX
 * function App() {
 *   return (
 *     <view direction="row" gap={8} align="center">
 *       <Icon name="home" size={32} color="black" />
 *       <text>Home</text>
 *     </view>
 *   );
 * }
 * ```
 */

import { jsx } from "../runtime/jsx-runtime.ts";
import { ICON_FONT_FAMILY } from "../canvas/register-font.ts";
import { getIconChar } from "./icons-name.ts";

/** Props for the Icon component */
export interface IconProps {
  /** Icon name from Material Icons (e.g., "home", "thermostat", "bolt") */
  name: string;

  /** Icon size in pixels. Default: 24 */
  size?: number;

  /** Icon color. Default: "black" */
  color?: string;

  /** Override parent's cross-axis alignment for this icon */
  alignSelf?: "auto" | "start" | "center" | "end" | "stretch";
}

/**
 * Icon component that renders Material Icons.
 *
 * Available icons are defined in icons-name.ts. To add more icons:
 * 1. Find the icon at https://fonts.google.com/icons
 * 2. Get the codepoint (e.g., "e88a" for home)
 * 3. Add to ICON_CODEPOINTS: `myIcon: "\ue88a"`
 *
 * @example Common icons
 * ```tsx
 * <Icon name="home" />           // Home icon
 * <Icon name="thermostat" />     // Temperature
 * <Icon name="bolt" />           // Lightning/electricity
 * <Icon name="wb_sunny" />       // Sun/weather
 * <Icon name="notifications" />  // Bell
 * ```
 *
 * @example With styling
 * ```tsx
 * <Icon name="warning" size={48} color="darkGray" />
 * ```
 */
export function Icon({
  name,
  size = 24,
  color = "black",
  alignSelf,
}: IconProps): JSX.Element {
  const char = getIconChar(name);

  return (
    <text
      size={size}
      width={size}
      font={ICON_FONT_FAMILY}
      color={color}
      alignSelf={alignSelf}
    >
      {char}
    </text>
  );
}
