/**
 * Offline mark: tells the viewer the shown data may be old, because the
 * broker has been unreachable for more than 5 minutes or Home Assistant
 * reports itself `offline` on `homeassistant/status`.
 *
 * Like a Reading, it never triggers a render: it is worked out when the
 * Dashboard renders, so it appears and clears at the next scheduled render.
 */
import { Icon, createState } from "@tjoskar/eink";

/** Home Assistant's birth (`online`) and last-will (`offline`) topic. */
export const HA_STATUS_TOPIC = "homeassistant/status";

/** How long the broker may be unreachable before the mark shows. */
const BROKER_GRACE_MS = 5 * 60_000;

const connectionState = createState({
  /** When the broker was last lost; undefined while connected or not yet tried. */
  brokerLostAt: undefined as Date | undefined,
  haOffline: false,
});

/** The broker connection was lost, or not made yet. Repeats keep the first time. */
export function brokerLost(now = new Date()): void {
  const state = connectionState.get();
  if (state.brokerLostAt) return;
  connectionState.set({ ...state, brokerLostAt: now });
}

/**
 * The broker connection was made. Home Assistant's status is forgotten too:
 * its birth and last will are not retained by default, so an `online` sent
 * while disconnected is lost and `offline` would stick. A retained status is
 * sent again right after the subscribe.
 */
export function brokerConnected(): void {
  connectionState.set({ brokerLostAt: undefined, haOffline: false });
}

/**
 * Store Home Assistant's status. Only `offline` sets the mark; any other
 * payload (`online`) clears it.
 */
export function setHaStatus(payload: string): void {
  connectionState.set({ ...connectionState.get(), haOffline: payload.toLowerCase() === "offline" });
}

export function isOffline(now = new Date()): boolean {
  const { brokerLostAt, haOffline } = connectionState.get();
  if (haOffline) return true;
  return brokerLostAt !== undefined && now.getTime() - brokerLostAt.getTime() > BROKER_GRACE_MS;
}

export function OfflineMark() {
  return (
    <view direction="row" gap={2} align="center">
      <Icon name="cloud_off" size={16} color="black" />
      <text size={14} color="black">
        Offline
      </text>
    </view>
  );
}
