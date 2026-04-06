/**
 * Fancy Hello World example.
 *
 * A more fancy version of Hello World that renders an image
 * and text on the e-ink display.
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

setTheme({
  ...EINK_BW_THEME,
  defaultFont: "Noto Sans",
});

registerFont("./fonts/noto-sans-regular.ttf", "Noto Sans");

async function main(): Promise<void> {
  console.log("Render Fancy Hello World");
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
