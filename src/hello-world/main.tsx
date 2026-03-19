/**
 * Hello World example.
 */
import { App } from "./app.tsx";
import {
  jsx,
  Canvas,
  render,
  registerFont,
  setTheme,
  EINK_BW_THEME,
  renderToDisplay,
  initHardware,
} from "#lib";

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
  using _hardware = await initHardware();
  await renderToDisplay(imageBuffer);
}

export async function renderApp(): Promise<Buffer> {
  const canvas = Canvas.create(800, 480);
  const element = <App />;
  await render(element, canvas);
  return canvas.toPng();
}

await main();
