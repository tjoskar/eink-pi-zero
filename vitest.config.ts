import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "#lib": path.resolve(import.meta.dirname, "lib/mod.ts"),
      "#lib/": path.resolve(import.meta.dirname, "lib") + "/",
    },
  },
  test: {
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
