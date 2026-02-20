/**
 * A simple wrapper around '@napi-rs/canvas'
 */
import {
  createCanvas,
  Image,
  type Canvas as NapiRsCanvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import * as fs from "node:fs";
import * as path from "node:path";

/** Default display dimensions (Waveshare 7.5" V2) */
export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 480;

/**
 *
 * @example
 * ```typescript
 * const canvas = new Canvas(800, 480);
 * canvas.setFont("bold 24px sans-serif");
 * canvas.fillText("Hello World", 100, 100);
 *
 * // Save as PNG for preview
 * fs.writeFileSync("output.png", canvas.toPng());
 * ```
 */
export class Canvas {
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

  static create(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): Canvas {
    return new Canvas(width, height);
  }

  /**
   * Draw filled text at the specified position.
   * Text is drawn with the current font and fill color.
   *
   * @param text - The text string to draw
   * @param x - X coordinate (left edge of text)
   * @param y - Y coordinate (baseline of text)
   */
  fillText(text: string, x: number, y: number): void {
    this.ctx.fillText(text, x, y);
  }

  /**
   * Set the font for subsequent text drawing.
   * Uses CSS font syntax.
   *
   * @param font - Font string, e.g., "bold 24px Arial" or "16px sans-serif"
   */
  setFont(font: string): void {
    this.ctx.font = font;
  }

  /**
   * Set the fill color for subsequent drawing operations.
   *
   * @param color - Color string, e.g., "black", "#333", "rgb(100,100,100)"
   */
  setFillColor(color: string): void {
    this.ctx.fillStyle = color;
  }

  /**
   * Draw a filled rectangle.
   *
   * @param x - X coordinate of top-left corner
   * @param y - Y coordinate of top-left corner
   * @param width - Rectangle width
   * @param height - Rectangle height
   */
  fillRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * Draw a rectangle outline (stroke only, not filled).
   *
   * @param x - X coordinate of top-left corner
   * @param y - Y coordinate of top-left corner
   * @param width - Rectangle width
   * @param height - Rectangle height
   */
  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw an image from a file path.
   * Images are cached after first load for performance.
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

  /**
   * Clear the canvas to white.
   */
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

  /**
   * Get raw image data for screen driver processing.
   * Returns RGBA pixel data.
   */
  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }

  /**
   * Export canvas to PNG buffer.
   * Useful for development preview.
   */
  toPng(): Buffer {
    return this.canvas.toBuffer("image/png");
  }

  // ===========================================================================
  // Path/Line Drawing Methods
  // ===========================================================================

  /**
   * Begin a new path. Call before drawing lines.
   */
  beginPath(): void {
    this.ctx.beginPath();
  }

  /**
   * Move the pen to a position without drawing.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  moveTo(x: number, y: number): void {
    this.ctx.moveTo(x, y);
  }

  /**
   * Draw a line from current position to the specified position.
   *
   * @param x - X coordinate to draw to
   * @param y - Y coordinate to draw to
   */
  lineTo(x: number, y: number): void {
    this.ctx.lineTo(x, y);
  }

  /**
   * Stroke the current path.
   */
  stroke(): void {
    this.ctx.stroke();
  }

  /**
   * Set the text baseline alignment.
   *
   * @param baseline - Baseline value, e.g., "top", "middle", "alphabetic"
   */
  setTextBaseline(baseline: CanvasTextBaseline): void {
    this.ctx.textBaseline = baseline;
  }

  /**
   * Set the horizontal text alignment.
   *
   * @param align - Alignment value, e.g., "left", "center", "right"
   */
  setTextAlign(align: CanvasTextAlign): void {
    this.ctx.textAlign = align;
  }

  /**
   * Fill the current path.
   */
  fill(): void {
    this.ctx.fill();
  }

  /**
   * Set the stroke color for lines.
   *
   * @param color - Color string, e.g., "black", "#333"
   */
  setStrokeColor(color: string): void {
    this.ctx.strokeStyle = color;
  }

  /**
   * Set the line width for strokes.
   *
   * @param width - Line width in pixels
   */
  setLineWidth(width: number): void {
    this.ctx.lineWidth = width;
  }

  /**
   * Draw an arc/curve.
   *
   * @param x - X coordinate of the arc's center
   * @param y - Y coordinate of the arc's center
   * @param radius - Radius of the arc
   * @param startAngle - Starting angle in radians
   * @param endAngle - Ending angle in radians
   */
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

interface ImageData {
  /** RGBA pixel data, 4 bytes per pixel */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
