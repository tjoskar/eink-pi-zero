/**
 * True if running in mock mode.
 * Mock mode is enabled when MOCK=1 environment variable is set
 */
export const IS_MOCK = process.env.MOCK === "1";

/**
 * Log the current environment on module load.
 */
if (IS_MOCK) {
  console.log("[env] Running in MOCK mode (press 'b' to simulate button)");
}
