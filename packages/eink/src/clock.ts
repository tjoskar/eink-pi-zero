/**
 * Time, in one place. Tests drive it with fake timers (`vi.useFakeTimers`),
 * which replace both `performance.now` and `setTimeout`.
 */
export const clock = {
  /**
   * Monotonic ms. Not Date.now: a Pi has no RTC, and NTP steps the wall
   * clock right after boot, which would break timeouts and the refresh guard.
   */
  now: (): number => performance.now(),

  /** Wait `ms`, or less if `signal` aborts first (it never rejects). */
  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      signal?.addEventListener("abort", done, { once: true });
    });
  },
};
