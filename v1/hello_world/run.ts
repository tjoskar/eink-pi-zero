/**
 * Hello World for Waveshare 7.5" V2 E-Ink Display
 */
import { Canvas } from "../lib/canvas.ts";
import { EPD7in5Screen as Screen } from "../lib/epd_7in5v2.ts";

async function main(): Promise<void> {
  const screen = new Screen();
  const canvas = new Canvas(screen.width, screen.height);
  canvas.fillText("Hello World", 100, 100);

  try {
    await screen.init();
    await screen.clear();
    await screen.render(canvas);
    await screen.sleep();

    console.log("\nDone!");
  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  }
}

main();
