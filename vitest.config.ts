import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    alias: {
      "#jsx/": path.resolve(import.meta.dirname, "jsx/lib") + "/",
      "#lib/": path.resolve(import.meta.dirname, "lib") + "/",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["**/*.snapshot.test.{ts,tsx}", "node_modules/**"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "snapshot",
          include: ["**/*.snapshot.test.{ts,tsx}"],
          exclude: ["node_modules/**"],
          environment: "node",
        },
      },
    ],
  },
});
