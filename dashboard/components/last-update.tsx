/**
 * Footer: the last update time, HH:MM:SS, with the Offline mark left of it
 * when shown.
 */
import { OfflineMark, isOffline } from "../offline.tsx";

export function LastUpdate() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  if (!isOffline(now)) {
    return (
      <text size={14} color="darkGray" textAlign="right">
        {timeStr}
      </text>
    );
  }

  return (
    <view direction="row" justify="end" align="center" gap={8}>
      <OfflineMark />
      <text size={14} color="darkGray">
        {timeStr}
      </text>
    </view>
  );
}
