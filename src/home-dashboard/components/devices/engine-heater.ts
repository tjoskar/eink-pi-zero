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

const PENDING_TIMEOUT_MS = 15_000;

export function createEngineHeater(deps: {
  /** Publish a Request (`on`/`off`) to Home Assistant. */
  publish: (payload: "on" | "off") => void;
  setLed: (state: LedState) => void;
  /** Re-render the display now. */
  render: () => void;
}) {
  let confirmedOn = false;
  let shownOn = false;
  let noAnswer = false;
  let disposed = false;
  let pending: { requested: boolean; timer: ReturnType<typeof setTimeout> } | null = null;

  function revert() {
    pending = null;
    shownOn = confirmedOn;
    noAnswer = true;
    deps.setLed(confirmedOn);
    deps.render();
  }

  return {
    /** Button press. Ignored while a Request is Pending, or after disposing. */
    press() {
      if (pending || disposed) return;
      const requested = !confirmedOn;
      deps.publish(requested ? "on" : "off");
      shownOn = requested;
      noAnswer = false;
      deps.setLed("blink");
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
      deps.setLed(on);
      const changed = shownOn !== on || noAnswer;
      shownOn = on;
      noAnswer = false;
      return changed;
    },

    /** What the display should show for the heater. */
    shown(): { on: boolean; noAnswer: boolean } {
      return { on: shownOn, noAnswer };
    },

    [Symbol.dispose]() {
      disposed = true;
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
