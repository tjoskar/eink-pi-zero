/**
 * Material Icons Codepoint Mapping
 *
 * Maps icon names to their Unicode codepoints in the Material Icons font.
 * This allows using friendly names like "home" instead of "\ue88a".
 *
 * The codepoints are from Google's Material Icons font:
 * @see https://fonts.google.com/icons
 *
 * To find a codepoint for an icon:
 * 1. Go to https://fonts.google.com/icons
 * 2. Search for the icon (e.g., "thermostat")
 * 3. Click on the icon
 * 4. Look for "Code point" in the right panel (e.g., "e8b2")
 * 5. Add it to this mapping as: thermostat: "\ue8b2"
 *
 * Note: This is a subset of available icons. Add more as needed.
 */

/**
 * Icon name to Unicode codepoint mapping.
 *
 * Usage with the Icon component:
 * ```tsx
 * <Icon name="home" size={32} />
 * ```
 *
 * Add new icons by finding their codepoint on Google Fonts.
 */
export const ICON_CODEPOINTS: Record<string, string> = {
  // Navigation & Actions
  home: "\ue88a",
  menu: "\ue5d2",
  close: "\ue5cd",
  arrow_back: "\ue5c4",
  arrow_forward: "\ue5c8",
  refresh: "\ue5d5",
  settings: "\ue8b8",
  search: "\ue8b6",
  check: "\ue5ca",
  add: "\ue145",
  remove: "\ue15b",
  edit: "\ue3c9",
  delete: "\ue872",

  // Weather & Environment
  thermostat: "\ue8b2",
  wb_sunny: "\ue430",
  wb_cloudy: "\ue42d",
  wb_twilight: "\ue1c6",
  wb_iridescent: "\ue81a",
  light_mode: "\ue518",
  dark_mode: "\ue51c",
  nights_stay: "\uea46",
  cloud: "\ue2bd",
  water_drop: "\ue798",
  air: "\ue63d",
  storm: "\uf070",
  ac_unit: "\ueb3b",
  foggy: "\ue818",
  rainy: "\uf176",
  rainy_heavy: "\uf61f",
  umbrella: "\ue16c",
  clear_day: "\uf157",
  clear_night: "\uef44",
  partly_cloudy_day: "\uf172",
  partly_cloudy_night: "\uf174",
  thunderstorm: "\ue80f",
  severe_cold: "\ue2cd",
  blur_on: "\ue8e7",
  wind_power: "\uefd8",

  // Energy & Power
  bolt: "\uea0b",
  power: "\ue63c",
  battery_full: "\ue1a4",
  battery_charging_full: "\ue1a3",
  solar_power: "\uec0f",

  // Home & Devices
  light: "\ue0f0",
  lightbulb: "\ue0f0",
  tv: "\ue333",
  speaker: "\ue32d",
  router: "\ue328",
  sensors: "\ue51e",
  local_laundry_service: "\ue832",
  dry_cleaning: "\ue54a",
  local_fire_department: "\ue531",
  electric_bike: "\ueb1b",

  // Time & Calendar
  schedule: "\ue8b5",
  event: "\ue878",
  today: "\ue8df",
  calendar_today: "\ue935",
  timer: "\ue425",
  alarm: "\ue855",

  // Status & Info
  info: "\ue88e",
  warning: "\ue002",
  error: "\ue000",
  help: "\ue887",
  notifications: "\ue7f4",

  // Misc
  eco: "\uea35",
  recycling: "\ue760",
  delete_forever: "\ue92b",
  local_shipping: "\ue558",
  shopping_cart: "\ue8cc",
  favorite: "\ue87d",
  star: "\ue838",
  visibility: "\ue8f4",
  visibility_off: "\ue8f5",
};

/**
 * Get the Unicode character for an icon name.
 *
 * @param name - Icon name (e.g., "home", "thermostat")
 * @returns Unicode character string, or "?" if icon not found
 *
 * @example
 * ```typescript
 * getIconChar("home");     // Returns "\ue88a"
 * getIconChar("unknown");  // Returns "?" and logs warning
 * ```
 */
export function getIconChar(name: string): string {
  const char = ICON_CODEPOINTS[name];

  if (!char) {
    console.warn(
      `[Icon] Unknown icon: "${name}". ` +
        `Add it to ICON_CODEPOINTS in icons.ts. ` +
        `Find codepoints at https://fonts.google.com/icons`,
    );
    return "?";
  }

  return char;
}
