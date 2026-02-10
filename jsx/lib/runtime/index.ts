/**
 * JSX Runtime Exports
 *
 * This module re-exports everything needed for the JSX runtime.
 * It serves as the entry point for jsxImportSource.
 */

// JSX factory functions (used by TypeScript transform)
export { jsx, jsxs, Fragment } from "./jsx-runtime.ts";

// Types
export type {
  JSXElement,
  JSXChildren,
  JSXChild,
  ComponentFunction,
  ViewProps,
  TextProps,
  ImageProps,
  ElementProps,
} from "./types.ts";

// Render function
export { render } from "./render.ts";
