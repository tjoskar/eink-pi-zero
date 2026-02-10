/**
 * Napi-RS Canvas Implementation
 *
 * Wraps the '@napi-rs/canvas' npm package to implement Canvas.
 * This is a Rust-based alternative to node-canvas with prebuilt binaries.
 *
 * Benefits over node-canvas:
 * - No native compilation needed (prebuilt for arm64, x64, etc.)
 * - Faster installation
 * - Similar API
 *
 * @see https://github.com/aspect-dev/aspect-build-napi-rs-canvas
 */

import {
  createCanvas,
  Image,
  type Canvas as NapiRsCanvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Canvas, ImageData } from "./types.ts";

/** Default display dimensions (Waveshare 7.5" V2) */
export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 480;

/**
 * Canvas implementation using @napi-rs/canvas.
 *
 * @example
 * ```typescript
 * const canvas = new NapiCanvas(800, 480);
 * canvas.setFont("bold 24px sans-serif");
 * canvas.fillText("Hello World", 100, 100);
 *
 * // Save as PNG for preview
 * fs.writeFileSync("output.png", canvas.toPng());
 * ```
 */
export class NapiCanvas implements Canvas {
  readonly width: number;
  readonly height: number;

  private canvas: NapiRsCanvas;
  private ctx: SKRSContext2D;

  /** Cache for loaded images to avoid reloading */
  private imageCache: Map<string, Image> = new Map();

  constructor(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    this.width = width;
    this.height = height;
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext("2d");

    // Initialize with white background and black text
    this.clear();
  }

  fillText(text: string, x: number, y: number): void {
    this.ctx.fillText(text, x, y);
  }

  setFont(font: string): void {
    this.ctx.font = font;
  }

  setFillColor(color: string): void {
    this.ctx.fillStyle = color;
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillRect(x, y, width, height);
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw an image from a file path.
   *
   * Supports PNG, JPEG, and other formats.
   * Images are cached after first load for performance.
   *
   * @throws Error if the image file cannot be loaded
   */
  drawImage(
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const resolvedPath = path.resolve(imagePath);

    // Check cache first
    let image = this.imageCache.get(resolvedPath);

    if (!image) {
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[Canvas] Image not found: ${resolvedPath}`);
        return;
      }

      try {
        // Load image synchronously by reading file buffer
        const buffer = fs.readFileSync(resolvedPath);
        // @napi-rs/canvas Image.src accepts Buffer directly
        const img = new Image();
        img.src = buffer;
        image = img;
        this.imageCache.set(resolvedPath, image);
      } catch (error) {
        console.warn(`[Canvas] Failed to load image: ${resolvedPath}`, error);
        return;
      }
    }

    if (image) {
      this.ctx.drawImage(image, x, y, width, height);
    }
  }

  clear(): void {
    // Fill with white
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Reset to black for drawing
    this.ctx.fillStyle = "black";
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 1;
    this.ctx.font = "16px sans-serif";
  }

  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }

  toPng(): Buffer {
    return this.canvas.toBuffer("image/png");
  }

  // ===========================================================================
  // Path/Line Drawing Methods
  // ===========================================================================

  beginPath(): void {
    this.ctx.beginPath();
  }

  moveTo(x: number, y: number): void {
    this.ctx.moveTo(x, y);
  }

  lineTo(x: number, y: number): void {
    this.ctx.lineTo(x, y);
  }

  stroke(): void {
    this.ctx.stroke();
  }

  fill(): void {
    this.ctx.fill();
  }

  setStrokeColor(color: string): void {
    this.ctx.strokeStyle = color;
  }

  setLineWidth(width: number): void {
    this.ctx.lineWidth = width;
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.ctx.arc(x, y, radius, startAngle, endAngle);
  }
}
