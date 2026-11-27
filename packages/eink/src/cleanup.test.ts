/**
 * cleanup.js (the unit's ExecStopPost=), run against the simulated kernel.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("./driver/syscalls.ts", () => import("./driver/syscalls.fake.ts"));

type Kernel = (typeof import("./driver/syscalls.fake.ts"))["kernel"];

const [RST, PWR, DC, LED] = [17, 18, 25, 13];
const argv = process.argv;

/**
 * Run the script in fresh modules. `before` sets up the fresh fake kernel
 * the script will see; it is returned for the assertions.
 */
async function runCleanup(args: string[], before?: (kernel: Kernel) => void): Promise<Kernel> {
  vi.resetModules();
  const { kernel } = await import("./driver/syscalls.fake.ts");
  before?.(kernel);
  process.argv = ["node", "cleanup.js", ...args];
  await import("./cleanup.ts");
  return kernel;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
});

test("after a crash with the panel powered, power, RST, DC and the LED go low", async () => {
  const kernel = await runCleanup([String(LED)], (k) => {
    for (const line of [RST, PWR, DC, LED]) k.levels.set(line, 1); // as the crash left them
  });
  expect([RST, PWR, DC, LED].map((l) => kernel.levels.get(l))).toEqual([0, 0, 0, 0]);
  expect(kernel.requested.size).toBe(0);
});

test("lines held by another app are left alone", async () => {
  const kernel = await runCleanup([], (k) => {
    k.levels.set(PWR, 1);
    k.heldByOthers.add(PWR);
  });
  expect(kernel.levels.get(PWR)).toBe(1);
  expect(kernel.log.some((op) => op.op === "set")).toBe(false);
  expect(kernel.requested.size).toBe(0);
});

test("refuses a panel pin as LED, before touching anything", async () => {
  const exit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
  let kernel: Kernel | undefined;
  await expect(runCleanup(["24"], (k) => (kernel = k))).rejects.toThrow("exit");
  expect(exit).toHaveBeenCalledWith(2);
  expect(kernel?.log).toEqual([]);
});
