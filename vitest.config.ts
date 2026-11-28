import { defineConfig } from "vitest/config";

// The Dashboard's Pi runs in Swedish time; its day boundaries and sun times
// depend on it. Pin it so tests behave the same on every machine and in CI.
process.env.TZ = "Europe/Stockholm";

export default defineConfig({
  // Resolve @tjoskar/eink to its TypeScript source, not the built dist/.
  ssr: { resolve: { conditions: ["source"] } },
  // The Framework ships jsx-runtime only, not jsx-dev-runtime.
  oxc: { jsx: { development: false } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["**/*.snapshot.test.{ts,tsx}", "**/node_modules/**", "**/dist/**"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "snapshot",
          include: ["**/*.snapshot.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          environment: "node",
        },
      },
    ],
  },
});
