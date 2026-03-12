import { jsx } from "#lib";
import { getDishes } from "./dishes-api.ts";

export async function DishesSection() {
  const dishes = await getDishes().catch((err) => {
    console.error("Dishes fetch failed:", err);
    return [] as string[];
  });

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
