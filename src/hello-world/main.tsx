/**
 * Hello World example.
 */
import { App } from "./app.tsx";
import { renderToDisplay } from "#lib/hardware.ts";
import { jsx, createCanvas, render, registerFont, setTheme, EINK_BW_THEME } from "#jsx/mod";

// Configure theme with custom default font
setTheme({
  ...EINK_BW_THEME,
  defaultFont: "Noto Sans",
});

// Register fonts before rendering - required for Pi Zero which has no system fonts
registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");

async function main(): Promise<void> {
  console.log("Render Hello World");
  const imageBuffer = await renderApp();

  console.log("Render to display");
  await renderToDisplay(imageBuffer, { fast: true });
}

export async function renderApp(): Promise<Buffer> {
  const canvas = createCanvas(800, 480);
  const element = <App />;
  await render(element, canvas);
  return canvas.toPng();
}

await main();
