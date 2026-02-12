/**
 * Dishes section — weekly meal plan as a bulleted list.
 */

import { jsx } from "#jsx/mod.js";

export function DishesSection({ dishes }: { dishes: string[] }) {
  if (dishes.length === 0) {
    return (
      <view>
        <text size={16} color="darkGray">
          Ingen matsedel
        </text>
      </view>
    );
  }

  return (
    <view direction="column" gap={4}>
      <text size={16} color="black">
        Veckans mat
      </text>
      {dishes.map((dish) => (
        <text size={14} color="black">
          - {dish}
        </text>
      ))}
    </view>
  );
}
