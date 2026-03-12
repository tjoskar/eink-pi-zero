import type { Canvas } from "./canvas/napi-canvas.ts";
import type { LayoutNode, LayoutResult, LayoutBox } from "./layout/types.ts";
import { getLayoutEngine } from "./layout/mod.ts";
import type {
  JSXElement,
  JSXChildren,
  ComponentFunction,
  LineChartProps,
  TextProps,
} from "./runtime/types.ts";
import { resolveColor, buildFontString } from "./theme.ts";

/**
 * Recursively resolve function components to intrinsic elements.
 *
 * Function components are called with their props to get their element tree.
 * This continues recursively until only intrinsic elements remain.
 */
async function resolveElement(element: JSXElement): Promise<JSXElement> {
  if (typeof element.type === "function") {
    // Call the component function to get its element tree
    const componentFn = element.type as ComponentFunction;
    const result = await componentFn(element.props as Record<string, unknown>);
    // Recursively resolve in case it returns another component
    return resolveElement(result);
  }
  return element;
}

async function flattenChildren(children: JSXChildren | undefined): Promise<JSXElement[]> {
  if (children == null) return [];

  const arr = Array.isArray(children) ? children : [children];

  const filtered = arr
    .flat(Infinity)
    .filter((child): child is JSXElement => {
      // Filter out null/undefined
      if (child == null) return false;
      // Keep objects (elements)
      if (typeof child === "object") return true;
      // Primitives (string/number) are handled separately
      return false;
    });

  return Promise.all(filtered.map(resolveElement));
}

/**
 * Extract text content from children.
 *
 * For <text> elements, we need to get the string content from children.
 * This handles strings, numbers, and nested text.
 */
function getTextContent(children: JSXChildren | undefined): string {
  if (children == null) return "";

  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);

  if (Array.isArray(children)) {
    return children
      .flat(Infinity)
      .map((child) => {
        if (child == null) return "";
        if (typeof child === "string") return child;
        if (typeof child === "number") return String(child);
        return "";
      })
      .join("");
  }

  return "";
}

/**
 * Convert a JSX element tree to a layout node tree.
 *
 * Layout nodes only contain the style information needed for layout calculation.
 * Element-specific props (like font, color, src) are not included.
 *
 * For text elements, height is automatically calculated from font size if not specified.
 */
async function buildLayoutTree(element: JSXElement): Promise<LayoutNode> {
  const resolved = await resolveElement(element);
  const { type, props } = resolved;

  // Build children layout nodes
  const childElements = await flattenChildren(props.children);
  const childNodes = await Promise.all(childElements.map(buildLayoutTree));

  // Calculate automatic height for text elements based on font size
  // Line height is approximately 1.2x font size
  let height = props.height;
  if (type === "text" && height === undefined) {
    const textProps = props as TextProps;
    if (textProps.size !== undefined) {
      height = Math.ceil(textProps.size * 1.2);
    }
  }

  return {
    style: {
      width: props.width,
      height,
      minWidth: props.minWidth,
      maxWidth: props.maxWidth,
      minHeight: props.minHeight,
      maxHeight: props.maxHeight,
      padding: props.padding,
      gap: props.gap,
      flex: props.flex,
      flexGrow: props.flexGrow,
      flexShrink: props.flexShrink,
      flexWrap: props.flexWrap,
      direction: props.direction,
      align: props.align,
      alignSelf: props.alignSelf,
      justify: props.justify,
    },
    children: childNodes,
  };
}

/**
 * Draw a line chart to the canvas.
 *
 * @param props - LineChart props
 * @param box - The bounding box for the chart
 * @param canvas - The canvas to draw to
 */
function drawLineChart(
  props: LineChartProps,
  box: LayoutBox,
  canvas: Canvas,
): void {
  const {
    data,
    markedIndex,
    xLabelCount,
    yLabelCount,
    xLabels,
    showAxisLines = true,
    stepLine = false,
  } = props;

  if (!data || data.length === 0) return;

  // Chart dimensions and margins for labels
  const labelFont = buildFontString(12);
  const yLabelWidth = yLabelCount ? 40 : 0;
  const xLabelHeight = xLabelCount || xLabels ? 20 : 0;

  const chartX = box.x + yLabelWidth;
  const chartY = box.y;
  const chartWidth = box.width - yLabelWidth;
  const chartHeight = box.height - xLabelHeight;

  // Calculate data bounds
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Helper to convert data index to X coordinate
  const indexToX = (index: number): number => {
    return chartX + (index / (data.length - 1)) * chartWidth;
  };

  // Helper to convert value to Y coordinate (inverted, since Y grows downward)
  const valueToY = (value: number): number => {
    return (
      chartY + chartHeight - ((value - minValue) / valueRange) * chartHeight
    );
  };

  // Draw Y-axis labels
  if (yLabelCount && yLabelCount > 0) {
    canvas.setFont(labelFont);
    canvas.setFillColor(resolveColor("darkGray"));

    for (let i = 0; i < yLabelCount; i++) {
      const value = minValue + (valueRange * i) / (yLabelCount - 1);
      const y = valueToY(value);
      const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
      canvas.fillText(label, box.x, y + 4); // +4 for vertical centering
    }
  }

  // Draw X-axis labels
  if (xLabels || xLabelCount) {
    canvas.setFont(labelFont);
    canvas.setFillColor(resolveColor("darkGray"));

    const labelsToShow = xLabels || [];
    const count = xLabels ? xLabels.length : xLabelCount!;

    for (let i = 0; i < count; i++) {
      // Calculate which data index this label corresponds to
      const dataIndex = xLabels
        ? Math.floor((i / (count - 1)) * (data.length - 1))
        : Math.floor((i / (count - 1)) * (data.length - 1));

      const x = indexToX(dataIndex);
      const label = xLabels ? labelsToShow[i] : String(dataIndex);

      // Center the label under the data point
      canvas.fillText(label, x - 10, box.y + box.height - 4);
    }
  }

  // Draw axis lines
  if (showAxisLines) {
    canvas.setStrokeColor(resolveColor("darkGray"));
    canvas.setLineWidth(1);
    canvas.beginPath();
    // Y-axis
    canvas.moveTo(chartX, chartY);
    canvas.lineTo(chartX, chartY + chartHeight);
    // X-axis
    canvas.lineTo(chartX + chartWidth, chartY + chartHeight);
    canvas.stroke();
  }

  // Draw the line graph
  canvas.setStrokeColor(resolveColor("black"));
  canvas.setLineWidth(2);
  canvas.beginPath();
  canvas.moveTo(indexToX(0), valueToY(data[0]));

  if (stepLine) {
    for (let i = 1; i < data.length; i++) {
      // Horizontal line at previous value to current x
      canvas.lineTo(indexToX(i), valueToY(data[i - 1]));
      // Vertical jump to new value
      canvas.lineTo(indexToX(i), valueToY(data[i]));
    }
  } else {
    for (let i = 1; i < data.length; i++) {
      canvas.lineTo(indexToX(i), valueToY(data[i]));
    }
  }
  canvas.stroke();

  // Draw marked point (larger, filled circle)
  if (
    markedIndex !== undefined &&
    markedIndex >= 0 &&
    markedIndex < data.length
  ) {
    const x = indexToX(markedIndex);
    const y = valueToY(data[markedIndex]);

    // Outer circle (dark gray ring)
    canvas.setFillColor(resolveColor("darkGray"));
    canvas.beginPath();
    canvas.arc(x, y, 8, 0, Math.PI * 2);
    canvas.fill();

    // Inner circle (white)
    canvas.setFillColor(resolveColor("white"));
    canvas.beginPath();
    canvas.arc(x, y, 5, 0, Math.PI * 2);
    canvas.fill();

    // Center dot (black)
    canvas.setFillColor(resolveColor("black"));
    canvas.beginPath();
    canvas.arc(x, y, 2, 0, Math.PI * 2);
    canvas.fill();
  }
}

/**
 * Draw an element and its children to the canvas.
 *
 * @param element - The resolved JSX element to draw
 * @param layout - The computed layout for this element
 * @param canvas - The canvas to draw to
 */
async function drawElement(
  element: JSXElement,
  layout: LayoutResult,
  canvas: Canvas,
): Promise<void> {
  const resolved = await resolveElement(element);
  const { type, props } = resolved;
  const { box } = layout;

  // Handle fragment - just draw children
  if (type === "fragment") {
    const childElements = await flattenChildren(props.children);
    for (let i = 0; i < childElements.length; i++) {
      await drawElement(childElements[i], layout.children[i], canvas);
    }
    return;
  }

  // Draw background (applies to all elements)
  if (props.background) {
    canvas.setFillColor(resolveColor(props.background));
    canvas.fillRect(box.x, box.y, box.width, box.height);
  }

  // Draw element-specific content
  switch (type) {
    case "view": {
      // View is just a container - draw children
      const childElements = await flattenChildren(props.children);
      for (let i = 0; i < childElements.length; i++) {
        await drawElement(childElements[i], layout.children[i], canvas);
      }
      break;
    }

    case "text": {
      // Set text styles using theme
      const textProps = props as TextProps;
      const fontString = buildFontString(
        textProps.size,
        textProps.font,
        textProps.weight,
      );
      canvas.setFont(fontString);
      canvas.setFillColor(resolveColor(textProps.color ?? "black"));

      // Get text content and draw
      const text = getTextContent(props.children);
      const padding = props.padding ?? 0;

      // Vertically center text within its box
      canvas.setTextBaseline("middle");

      // Horizontal alignment
      const align = textProps.textAlign ?? "left";
      canvas.setTextAlign(align);
      let textX: number;
      if (align === "center") {
        textX = box.x + box.width / 2;
      } else if (align === "right") {
        textX = box.x + box.width - padding;
      } else {
        textX = box.x + padding;
      }
      canvas.fillText(text, textX, box.y + box.height / 2);
      canvas.setTextAlign("left");
      break;
    }

    case "image": {
      const imageProps = props as { src?: string };
      if (imageProps.src) {
        canvas.drawImage(imageProps.src, box.x, box.y, box.width, box.height);
      }
      break;
    }

    case "linechart": {
      drawLineChart(props as LineChartProps, box, canvas);
      break;
    }

    default: {
      // Unknown element type - try to render children anyway
      console.warn(`[Render] Unknown element type: ${type}`);
      const childElements = await flattenChildren(props.children);
      for (let i = 0; i < childElements.length; i++) {
        if (layout.children[i]) {
          await drawElement(childElements[i], layout.children[i], canvas);
        }
      }
    }
  }
}

/**
 * Render a JSX element tree to a canvas.
 * Designed for low-resource environments like Raspberry Pi Zero.
 *
 * This is the main entry point for rendering. It:
 * 1. Resolves all component functions
 * 2. Calculates layout for all elements
 * 3. Draws elements to the canvas
 *
 * The function is async because image loading may be asynchronous.
 *
 * @param element - The root JSX element to render
 * @param canvas - The canvas to render to
 *
 * @example
 * ```typescript
 * import { render, Canvas } from "./lib/mod.ts";
 *
 * function App() {
 *   return (
 *     <view direction="row" gap={20} padding={20}>
 *       <view flex={1} background="lightGray">
 *         <text font="24px sans-serif">Left Panel</text>
 *       </view>
 *       <view flex={2}>
 *         <text font="32px sans-serif">Main Content</text>
 *       </view>
 *     </view>
 *   );
 * }
 *
 * const canvas = new Canvas(800, 480);
 * await render(<App />, canvas);
 *
 * // Save to file or send to display
 * fs.writeFileSync("output.png", canvas.toPng());
 * ```
 */
export async function render(
  element: JSXElement | Promise<JSXElement>,
  canvas: Canvas,
): Promise<void> {
  // Phase 1: Resolve components
  const resolved = await resolveElement(await element);

  // Phase 2: Build layout tree and calculate positions
  const layoutTree = await buildLayoutTree(resolved);
  const engine = getLayoutEngine();
  const container: LayoutBox = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  };
  const layout = engine.calculate(layoutTree, container);

  // Phase 3: Draw to canvas
  await drawElement(resolved, layout, canvas);
}
