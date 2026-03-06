/**
 * Electricity section — price chart + consumption bar chart.
 *
 * Uses LineChart for hourly prices and manually constructed bar chart
 * (outlined rectangles) for daily consumption.
 */

import { jsx, LineChart } from "#lib";
import type { ElectricityData } from "../data/electricity-api.ts";

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

  const midValue = maxValue / 2;
  const labelWidth = 24;

  return (
    <view direction="column" gap={4}>
      {/* Y-axis labels + bars row */}
      <view direction="row" gap={4}>
        <view direction="column" height={80} width={labelWidth}>
          <text size={14} color="darkGray">
            {Math.round(maxValue)}
          </text>
          <view flex={1} justify="center">
            <text size={14} color="darkGray">
              {Math.round(midValue)}
            </text>
          </view>
        </view>
        <view direction="row" align="end" gap={4} height={80}>
          {consumption.map((value) => (
            <ConsumptionBar
              value={value}
              maxValue={maxValue}
              barWidth={barWidth}
            />
          ))}
        </view>
      </view>

      {/* Cost labels row */}
      <view direction="row" gap={4}>
        <view width={labelWidth} />
        {consumptionCosts.map((cost) => (
          <view width={barWidth + 2}>
            <text size={14} color="darkGray" textAlign="center">
              {Math.round(cost)}
            </text>
          </view>
        ))}
      </view>
    </view>
  );
}

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
        Elpris ({data.levelLabel} {data.currentPrice} öre/kWh)
      </text>

      {/* Price line chart */}
      <LineChart
        data={data.prices}
        width={240}
        height={100}
        markedIndex={data.highlightIndex}
        yLabelCount={3}
        showAxisLines={false}
        stepLine
      />

      {/* Consumption title */}
      <view height={8} />
      <text size={14} color="black">
        Förbrukning (kWh, kr)
      </text>

      {/* Consumption bar chart */}
      <ConsumptionChart data={data} />
    </view>
  );
}
