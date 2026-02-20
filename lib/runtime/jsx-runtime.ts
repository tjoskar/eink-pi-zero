/**
 * JSX Runtime Factory Functions
 *
 * These functions are called by the TypeScript JSX transform to create elements.
 *
 * We use the classic JSX transform with pragmas:
 *   /** @jsx jsx *\/
 *   /** @jsxFrag Fragment *\/
 *
 * When you write:
 *   <view padding={10}>Hello</view>
 *
 * TypeScript transforms it to:
 *   jsx("view", { padding: 10 }, "Hello")
 *
 * With multiple children:
 *   <view><text>A</text><text>B</text></view>
 *
 * Becomes:
 *   jsx("view", null, jsx("text", null, "A"), jsx("text", null, "B"))
 */

import type { JSXElement, ComponentFunction, JSXChildren } from "./types.ts";

/**
 * Create a JSX element.
 *
 * This is the main factory function called by the JSX transform.
 * It handles both intrinsic elements (like "view") and component functions.
 *
 * With the classic JSX transform, children are passed as additional arguments
 * after the props object.
 *
 * @param type - Element type: string for intrinsic, function for components
 * @param props - Element props (without children)
 * @param children - Child elements passed as additional arguments
 * @returns A JSXElement object
 */
export function jsx(
  type: string | ComponentFunction,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): JSXElement {
  const resolvedProps = props || {};

  // Flatten children - if there's only one child, unwrap it
  const flatChildren =
    children.length === 1
      ? children[0]
      : children.length > 0
        ? children
        : undefined;

  return {
    type,
    props: {
      ...resolvedProps,
      // Only add children if there are any
      ...(flatChildren !== undefined ? { children: flatChildren } : {}),
    } as JSXElement["props"],
  };
}

/**
 * Create a JSX element with static children.
 *
 * This is called instead of jsx() when children are known at compile time.
 * The implementation is identical - the distinction helps React optimize,
 * but we don't need that optimization.
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
