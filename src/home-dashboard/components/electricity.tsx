/**
 * Electricity section — price chart + consumption bar chart.
 *
 * Uses LineChart for hourly prices and manually constructed bar chart
 * (outlined rectangles) for daily consumption.
 */

import { jsx, LineChart } from "#jsx/mod.js";
import type { ElectricityData } from "../data/electricity-api.ts";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConsumptionBar({
  value,
  maxValue,
  barWidth,
}: {
  value: number;
  maxValue: number;
  barWidth: number;
}) {
  const barHeight = maxValue > 0 ? Math.max(2, Math.round((value / maxValue) * 80)) : 2;

  return (
    <view direction="column" justify="end" height={80}>
      {/* Outlined rectangle: black outer, white inner */}
      <view
        width={barWidth + 2}
        height={barHeight + 2}
        background="black"
        padding={1}
      >
        <view width={barWidth} height={barHeight} background="white" />
      </view>
    </view>
  );
}

function ConsumptionChart({ data }: { data: ElectricityData }) {
  const { consumption, consumptionCosts } = data;
  if (consumption.length === 0) return <view />;

  const maxValue = Math.max(...consumption, 1);
  const barWidth = Math.floor(240 / consumption.length) - 6;

  return (
    <view direction="column" gap={4}>
      {/* Bars row */}
      <view direction="row" align="end" gap={4} height={80}>
        {consumption.map((value) => (
          <ConsumptionBar
            value={value}
            maxValue={maxValue}
            barWidth={barWidth}
          />
        ))}
      </view>

      {/* Cost labels row */}
      <view direction="row" gap={4}>
        {consumptionCosts.map((cost) => (
          <view width={barWidth + 2}>
            <text size={10} color="darkGray" textAlign="center">
              {Math.round(cost)}
            </text>
          </view>
        ))}
      </view>
    </view>
  );
}

// ---------------------------------------------------------------------------
// Exported section
// ---------------------------------------------------------------------------

export function ElectricitySection({
  data,
}: {
  data: ElectricityData | null;
}) {
  if (!data) {
    return (
      <view>
        <text size={16} color="darkGray">
          Elprisdata saknas
        </text>
      </view>
    );
  }

  return (
    <view direction="column" gap={8} width={260}>
      {/* Price title */}
      <text size={14} color="black">
        Elpris ({data.levelLabel} {data.currentPrice} \u00f6re)
      </text>

      {/* Price line chart */}
      <LineChart
        data={data.prices}
        width={240}
        height={100}
        markedIndex={data.highlightIndex}
        yLabelCount={3}
      />

      {/* Consumption title */}
      <view height={8} />
      <text size={14} color="black">
        F\u00f6rbrukning (kWh, kr)
      </text>

      {/* Consumption bar chart */}
      <ConsumptionChart data={data} />
    </view>
  );
}
