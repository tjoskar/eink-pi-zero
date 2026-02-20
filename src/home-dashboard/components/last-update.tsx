/**
 * Last update timestamp — shows current time in HH:MM:SS format.
 */

import { jsx } from "#lib";

export function LastUpdate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <text size={14} color="darkGray" textAlign="right">
      {timeStr}
    </text>
  );
}
