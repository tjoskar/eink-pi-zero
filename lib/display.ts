/**
 * Display controller for e-ink rendering.
 *
 * This module handles rendering images to the e-ink display by:
 * - In mock mode: Saving PNG to disk and logging
 * - On Pi: Spawning Python render.py script
 */

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IS_MOCK } from "./env.js";

/** Timeout for Python render script */
const RENDER_TIMEOUT_MS = 30_000;

/** Flag to track if a render is in progress */
let renderInProgress = false;

/** Path to the Python render script */
const PYTHON_SCRIPT = join(
  import.meta.dirname,
  "..",
  "..",
  "python",
  "render.py",
);

export interface RenderOptions {
  /** Use fast init mode (faster refresh, less clean) */
  fast?: boolean;
  /** Clear display before rendering */
  clear?: boolean;
}

/**
 * Render a PNG buffer to the e-ink display.
 *
 * @param imageBuffer - PNG image data as a Buffer
 * @param options - Render options (fast, clear)
 * @returns Promise that resolves when rendering is complete
 * @throws Error if rendering fails
 */
export async function renderToDisplay(
  imageBuffer: Buffer,
  options: RenderOptions = {},
): Promise<void> {
  if (renderInProgress) {
    throw new Error("Render already in progress");
  }

  renderInProgress = true;

  const imagePath = join(tmpdir(), "eink-latest.png");
  await writeFile(imagePath, imageBuffer);

  if (IS_MOCK) {
    // In mock mode, just log the path
    console.log(`[display] Mock render: ${imagePath}`);
    renderInProgress = false;
    return;
  }

  // On Pi, spawn Python script
  return new Promise((resolve, reject) => {
    const args = [PYTHON_SCRIPT, imagePath];
    if (options.fast) args.push("--fast");
    if (options.clear) args.push("--clear");

    console.log(`[display] Spawning: python3 ${args.join(" ")}`);

    const proc = spawn("python3", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      renderInProgress = false;
      reject(new Error(`Render timeout after ${RENDER_TIMEOUT_MS}ms`));
    }, RENDER_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (stdout.trim()) {
        console.log(`[display] ${stdout.trim()}`);
      }

      if (code === 0) {
        renderInProgress = false;
        resolve();
      } else {
        renderInProgress = false;
        const errorMsg =
          stderr.trim() || `Python script exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      renderInProgress = false;
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}
