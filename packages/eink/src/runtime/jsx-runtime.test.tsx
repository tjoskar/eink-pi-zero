import { test, expect } from "vitest";
import { jsx, Fragment } from "./jsx-runtime.ts";

test("jsx creates element with type and props", () => {
  const el = jsx("view", { padding: 10 });
  expect(el.type).toBe("view");
  expect(el.props.padding).toBe(10);
});

test("jsx with null props creates element with empty props", () => {
  const el = jsx("text", null);
  expect(el.type).toBe("text");
  expect(el.props).toEqual({});
});

test("jsx keeps children in props.children", () => {
  const child = jsx("text", { children: "content" });
  const parent = jsx("view", { padding: 5, children: child });
  expect(parent.props.children).toBe(child);
  expect((parent.props.children as { type: string }).type).toBe("text");
});

test("jsx with no children does not add children prop", () => {
  const el = jsx("view", { color: "black" });
  expect("children" in el.props).toBe(false);
});

test("the JSX transform produces the same elements", () => {
  const el = (
    <view padding={5}>
      <text>a</text>
      {"b"}
    </view>
  );
  expect(el).toEqual({
    type: "view",
    props: { padding: 5, children: [{ type: "text", props: { children: "a" } }, "b"] },
  });
});

test("Fragment creates element with type fragment", () => {
  const frag = Fragment({ children: ["a", "b"] });
  expect(frag.type).toBe("fragment");
  expect(frag.props.children).toEqual(["a", "b"]);
});

test("Fragment with no children", () => {
  const frag = Fragment({});
  expect(frag.type).toBe("fragment");
  expect(frag.props.children).toBeUndefined();
});
