/**
 * Engine heater — button Requests against Home Assistant's Confirmed state.
 *
 * Home Assistant owns the heater state. A press publishes a Request that
 * toggles the Confirmed state (none yet counts as off) and starts a Pending:
 * the display and LED show the requested state at once, the LED blinks.
 * A matching Confirmed state within 15 s ends the Pending (LED steady, no
 * extra render); otherwise LED and display revert to the last Confirmed state
 * and a "no answer" mark shows until the next Confirmed state arrives.
 */

/** LED output: steady on/off, or blinking while a Request is Pending. */
export type LedState = boolean | "blink";

/** What the display shows for the heater. */
export interface ShownState {
  on: boolean;
  /** A Request got no answer; shown until the next Confirmed state. */
  noAnswer: boolean;
}

const PENDING_TIMEOUT_MS = 15_000;

export function createEngineHeater(deps: {
  /** Publish a Request (`on`/`off`) to Home Assistant. */
  publish: (payload: "on" | "off") => void;
  setLed: (state: LedState) => void;
  /** Store what the display should show; called on every change. */
  show: (state: ShownState) => void;
  /** Re-render the display now. */
  render: () => void;
}) {
  let confirmedOn = false;
  let shown: ShownState = { on: false, noAnswer: false };
  // Unknown until the first command, so that one is always sent.
  let led: LedState | null = null;
  let disposed = false;
  let pending: { requested: boolean; timer: ReturnType<typeof setTimeout> } | null = null;

  function setLed(state: LedState) {
    if (state === led) return;
    led = state;
    deps.setLed(state);
  }

  /** Returns true if what is shown changed. */
  function show(next: ShownState): boolean {
    if (next.on === shown.on && next.noAnswer === shown.noAnswer) return false;
    shown = next;
    deps.show(next);
    return true;
  }

  function revert() {
    pending = null;
    setLed(confirmedOn);
    show({ on: confirmedOn, noAnswer: true });
    deps.render();
  }

  return {
    /** Button press. Ignored while a Request is Pending, or after disposing. */
    press() {
      if (pending || disposed) return;
      const requested = !confirmedOn;
      deps.publish(requested ? "on" : "off");
      setLed("blink");
      show({ on: requested, noAnswer: false });
      pending = { requested, timer: setTimeout(revert, PENDING_TIMEOUT_MS) };
      deps.render();
    },

    /**
     * A Confirmed state arrived. Returns true if the display must be
     * re-rendered; the caller schedules that render.
     */
    confirmed(on: boolean): boolean {
      confirmedOn = on;
      if (pending) {
        // Not an answer to our Request (e.g. a redelivered retained state).
        if (pending.requested !== on) return false;
        clearTimeout(pending.timer);
        pending = null;
      }
      setLed(on);
      return show({ on, noAnswer: false });
    },

    [Symbol.dispose]() {
      disposed = true;
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
