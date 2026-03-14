import { jsx } from "#lib";

export function App() {
  return (
    <view width={800} height={480} padding={40} direction="column" gap={20} background="white">
      <view direction="column" gap={8}>
        <text size={48} weight="bold" color="black">
          Hej Emma!
        </text>
        <text size={24} color="darkGray">
          Dark gray
        </text>
        <text size={24} color="lightGray">
          Light gray
        </text>
      </view>
    </view>
  );
}
