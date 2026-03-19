import { test, expect, afterEach } from "vitest";
import { createCache, getCachePath } from "../lib/cache.ts";
import { unlinkSync } from "node:fs";

const testFiles: string[] = [];

function cleanup() {
  for (const file of testFiles) {
    try {
      unlinkSync(getCachePath(file));
    } catch {}
  }
  testFiles.length = 0;
}

afterEach(cleanup);

test("createCache read returns null when no cache file exists", () => {
  const cache = createCache<string>({ file: "nonexistent-test-file.json" });
  expect(cache.read()).toBeNull();
});

test("createCache write then read returns the data", () => {
  const file = `test-write-read-${Date.now()}.json`;
  testFiles.push(file);
  const cache = createCache<{ name: string }>({ file });
  cache.write({ name: "hello" });
  expect(cache.read()).toEqual({ name: "hello" });
});

test("createCache with expired TTL returns null", () => {
  const file = `test-expired-${Date.now()}.json`;
  testFiles.push(file);
  const cache = createCache<string>({ file, ttlSeconds: 0 });
  cache.write("stale data");
  expect(cache.read()).toBeNull();
});

test("createCache read with allowStale returns expired data", () => {
  const file = `test-stale-${Date.now()}.json`;
  testFiles.push(file);
  const cache = createCache<string>({ file, ttlSeconds: 0 });
  cache.write("stale data");
  expect(cache.read(true)).toBe("stale data");
});
