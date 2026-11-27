/**
 * Time, in one place. Tests drive it with fake timers (`vi.useFakeTimers`),
 * which replace both `Date.now` and `setTimeout`.
 */
export const clock = {
  now: (): number => Date.now(),

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
