/**
 * Canvas Interface
 *
 * Defines the interface for canvas implementations.
 * This abstraction allows swapping between different canvas libraries
 * (e.g., node-canvas, skia-canvas) without changing render code.
 *
 * The interface focuses on operations needed for e-ink rendering:
 * - Text drawing
 * - Rectangle drawing (filled and stroked)
 * - Image drawing
 * - PNG export (for development preview)
 * - Raw image data access (for screen drivers)
 */

/**
 * Raw image data from canvas.
 * Compatible with CanvasRenderingContext2D.getImageData() result.
 */
export interface ImageData {
  /** RGBA pixel data, 4 bytes per pixel */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Canvas interface for e-ink rendering.
 *
 * Implementations should:
 * - Initialize with white background
 * - Default to black fill color
 * - Support font strings like "bold 24px Arial"
 */
export interface Canvas {
  /** Canvas width in pixels */
  readonly width: number;

  /** Canvas height in pixels */
  readonly height: number;

  /**
   * Draw filled text at the specified position.
   * Text is drawn with the current font and fill color.
   *
   * @param text - The text string to draw
   * @param x - X coordinate (left edge of text)
   * @param y - Y coordinate (baseline of text)
   */
  fillText(text: string, x: number, y: number): void;

  /**
   * Set the font for subsequent text drawing.
   * Uses CSS font syntax.
   *
   * @param font - Font string, e.g., "bold 24px Arial" or "16px sans-serif"
   */
  setFont(font: string): void;

  /**
   * Set the fill color for subsequent drawing operations.
   *
   * @param color - Color string, e.g., "black", "#333", "rgb(100,100,100)"
   */
  setFillColor(color: string): void;

  /**
   * Draw a filled rectangle.
   *
   * @param x - X coordinate of top-left corner
   * @param y - Y coordinate of top-left corner
   * @param width - Rectangle width
   * @param height - Rectangle height
   */
  fillRect(x: number, y: number, width: number, height: number): void;

  /**
   * Draw a rectangle outline (stroke only, not filled).
   *
   * @param x - X coordinate of top-left corner
   * @param y - Y coordinate of top-left corner
   * @param width - Rectangle width
   * @param height - Rectangle height
   */
  strokeRect(x: number, y: number, width: number, height: number): void;

  /**
   * Draw an image from a file path.
   *
   * @param imagePath - Path to the image file (PNG, JPEG, etc.)
   * @param x - X coordinate to draw at
   * @param y - Y coordinate to draw at
   * @param width - Width to scale image to
   * @param height - Height to scale image to
   */
  drawImage(
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;

  /**
   * Clear the canvas to white.
   */
  clear(): void;

  /**
   * Get raw image data for screen driver processing.
   * Returns RGBA pixel data.
   */
  getImageData(): ImageData;

  /**
   * Export canvas to PNG buffer.
   * Useful for development preview.
   */
  toPng(): Buffer;

  // ===========================================================================
  // Path/Line Drawing Methods
  // ===========================================================================

  /**
   * Begin a new path. Call before drawing lines.
   */
  beginPath(): void;

  /**
   * Move the pen to a position without drawing.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  moveTo(x: number, y: number): void;

  /**
   * Draw a line from current position to the specified position.
   *
   * @param x - X coordinate to draw to
   * @param y - Y coordinate to draw to
   */
  lineTo(x: number, y: number): void;

  /**
   * Stroke (draw) the current path.
   */
  stroke(): void;

  /**
   * Fill the current path.
   */
  fill(): void;

  /**
   * Set the stroke color for lines.
   *
   * @param color - Color string, e.g., "black", "#333"
   */
  setStrokeColor(color: string): void;

  /**
   * Set the line width for strokes.
   *
   * @param width - Line width in pixels
   */
  setLineWidth(width: number): void;

  /**
   * Draw an arc or circle.
   *
   * @param x - X coordinate of center
   * @param y - Y coordinate of center
   * @param radius - Radius in pixels
   * @param startAngle - Start angle in radians
   * @param endAngle - End angle in radians
   */
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void;
}
