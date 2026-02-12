/**
 * Shared utilities for pixel-based snapshot tests.
 *
 * Compares a rendered PNG against a reference image using pixelmatch.
 * On mismatch, writes *.actual.png and *.diff.png next to the reference
 * for visual inspection.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export interface SnapshotOptions {
  /** Directory to store reference/actual/diff PNGs */
  snapshotsDir: string;
  /** Base name without extension (e.g. "weather-app") */
  name: string;
  /** pixelmatch threshold (0–1). Default: 0.1 */
  threshold?: number;
  /** Maximum allowed pixel differences. Default: 0 */
  maxDiffPixels?: number;
}

/**
 * Compare a rendered PNG buffer against a stored reference image.
 *
 * - First run (no reference): saves the buffer as the new reference.
 * - UPDATE_SNAPSHOTS=1: overwrites the reference.
 * - Otherwise: pixel-compares and throws on mismatch.
 */
export function assertSnapshot(actualPng: Buffer, opts: SnapshotOptions): void {
  const { snapshotsDir, name, threshold = 0.1, maxDiffPixels = 0 } = opts;

  const refPath = join(snapshotsDir, `${name}.png`);
  const actualPath = join(snapshotsDir, `${name}.actual.png`);
  const diffPath = join(snapshotsDir, `${name}.diff.png`);

  mkdirSync(snapshotsDir, { recursive: true });

  // Update mode or first run — save as reference
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(refPath)) {
    writeFileSync(refPath, actualPng);
    return;
  }

  // Compare
  const actual = PNG.sync.read(actualPng);
  const reference = PNG.sync.read(readFileSync(refPath));
  const { width, height } = actual;
  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    reference.data, actual.data, diff.data,
    width, height,
    { threshold },
  );

  if (numDiffPixels > maxDiffPixels) {
    writeFileSync(actualPath, actualPng);
    writeFileSync(diffPath, PNG.sync.write(diff));
    throw new Error(
      `Image mismatch: ${numDiffPixels} pixels differ (max ${maxDiffPixels}).\n` +
      `  Reference: ${refPath}\n` +
      `  Actual:    ${actualPath}\n` +
      `  Diff:      ${diffPath}`,
    );
  }

  // Clean up artifacts from previous failures
  for (const f of [actualPath, diffPath]) {
    if (existsSync(f)) unlinkSync(f);
  }
}
