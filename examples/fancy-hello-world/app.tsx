import { join } from "node:path";

export function App() {
  return (
    <view
      width={800}
      height={480}
      justify="center"
      align="center"
      direction="column"
      gap={20}
      background="white"
    >
      <text size={42} weight="bold">
        Very Nice!
      </text>
      <image src={join(import.meta.dirname, "borat.jpeg")} width={379} height={240} />
    </view>
  );
}
