/**
 * Garbage collection section — upcoming pickup dates.
 */

import { jsx } from "#lib";
import type { GarbageData } from "../data/garbage-data.ts";

export function GarbageSection({ data }: { data: GarbageData }) {
  if (data.events.length === 0) {
    return <view />;
  }

  return (
    <view direction="column" gap={4}>
      {data.events.map((event) => (
        <text size={14} color="black">
          {event.label}: {event.dateStr} ({event.daysUntil})
        </text>
      ))}
      {data.reminder ? (
        <text size={14} color="black">
          {data.reminder}
        </text>
      ) : null}
    </view>
  );
}
