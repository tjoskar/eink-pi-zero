/**
 * LineChart Component
 *
 * Renders an array of numeric data as a line graph.
 * Designed for e-ink displays with a limited color palette
 * (black, white, light gray, dark gray).
 *
 * @example Basic usage
 * ```tsx
 * <LineChart
 *   data={[10, 25, 18, 42, 35, 28]}
 *   width={400}
 *   height={200}
 * />
 * ```
 *
 * @example With marked point and labels
 * ```tsx
 * <LineChart
 *   data={[10, 25, 18, 42, 35, 28]}
 *   width={400}
 *   height={200}
 *   markedIndex={3}
 *   xLabelCount={3}
 *   yLabelCount={4}
 * />
 * ```
 *
 * @example With custom X labels
 * ```tsx
 * <LineChart
 *   data={prices}
 *   width={400}
 *   height={200}
 *   markedIndex={currentHour}
 *   xLabels={["00:00", "06:00", "12:00", "18:00", "24:00"]}
 *   yLabelCount={5}
 * />
 * ```
 */

import { jsx } from "../runtime/jsx-runtime.ts";

export interface LineChartProps {
  /** Array of numeric data values to plot */
  data: number[];

  /** Width of the chart in pixels */
  width: number;

  /** Height of the chart in pixels */
  height: number;

  /**
   * Index of the data point to highlight.
   * Renders as a larger, more visible marker.
   */
  markedIndex?: number;

  /**
   * Number of labels to show on the X axis.
   * Labels are evenly distributed across the data range.
   */
  xLabelCount?: number;

  /**
   * Number of labels to show on the Y axis.
   * Labels show values from min to max of the data.
   */
  yLabelCount?: number;

  /**
   * Custom labels for the X axis.
   * When provided, overrides xLabelCount.
   * Labels are evenly distributed across the chart width.
   */
  xLabels?: string[];

  /** Show axis lines (default: true). Labels are still shown when false. */
  showAxisLines?: boolean;

  /** Use step interpolation — flat lines with 90° jumps between points */
  stepLine?: boolean;

  /** Optional background color */
  background?: string;
}

export function LineChart({
  data,
  width,
  height,
  markedIndex,
  xLabelCount,
  yLabelCount,
  xLabels,
  showAxisLines,
  stepLine,
  background,
}: LineChartProps): JSX.Element {
  return (
    <linechart
      data={data}
      width={width}
      height={height}
      markedIndex={markedIndex}
      xLabelCount={xLabelCount}
      yLabelCount={yLabelCount}
      xLabels={xLabels}
      showAxisLines={showAxisLines}
      stepLine={stepLine}
      background={background}
    />
  );
}
