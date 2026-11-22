/**
 * JSX Runtime
 *
 * The functions the automatic JSX transform calls. An app opts in with
 *
 *   "jsx": "react-jsx",
 *   "jsxImportSource": "@tjoskar/eink"
 *
 * in its tsconfig, and TypeScript (or esbuild/tsx) imports them from
 * `@tjoskar/eink/jsx-runtime` on its own.
 *
 * When you write:
 *   <view padding={10}>Hello</view>
 *
 * It becomes:
 *   jsx("view", { padding: 10, children: "Hello" })
 *
 * With several children, `children` is an array and the call is `jsxs`:
 *   <view><text>A</text><text>B</text></view>
 *   jsxs("view", { children: [jsx("text", { children: "A" }), jsx("text", { children: "B" })] })
 */

import type { JSXElement, ComponentFunction, JSXChildren } from "./types.ts";

export type { JSX } from "./types.ts";

/**
 * Create a JSX element.
 *
 * @param type - Element type: string for intrinsic, function for components
 * @param props - Element props, children included
 * @returns A JSXElement object
 *
 * The transform passes `key` as a third argument; it is ignored, since
 * nothing here reconciles lists.
 */
export function jsx(
  type: string | ComponentFunction,
  props: Record<string, unknown> | null,
): JSXElement {
  return { type, props: { ...props } };
}

/**
 * Create a JSX element with static children.
 *
 * Called instead of jsx() when there are several children. The distinction
 * helps React optimize; we don't need it.
 */
export const jsxs = jsx;

/**
 * Fragment component for grouping elements without a container.
 *
 * @example
 * ```tsx
 * function List() {
 *   return (
 *     <>
 *       <text>Item 1</text>
 *       <text>Item 2</text>
 *     </>
 *   );
 * }
 * ```
 */
export function Fragment({ children }: { children?: JSXChildren }): JSXElement {
  return {
    type: "fragment",
    props: { children },
  };
}
