"use client";
// React entry: `import { Soom3DLoader } from "@oddedd/soom-3d-loader/react"`.
// It registers <soom-3d-loader>, types the tag for React's JSX, and works from Next.js
// server components because this module is marked as a client component.
import type { CSSProperties } from "react";
import { define } from "./element.js";
import type { Variant } from "./presets.js";
import type { ShaderVariant } from "./shader.js";

/** Attributes of the `<soom-3d-loader>` element. */
export interface Soom3DLoaderAttributes {
  variant?: Variant | ShaderVariant;
  size?: number | string;
  color?: string;
  count?: number | string;
  speed?: number | string;
  label?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "soom-3d-loader": import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLElement>, HTMLElement> &
        Soom3DLoaderAttributes;
    }
  }
}

// Register the tag as soon as this module loads (it is listed in package.json "sideEffects",
// so bundlers keep it even for a bare `import "@oddedd/soom-3d-loader/react"`).
define();

export type Soom3DLoaderProps = Soom3DLoaderAttributes & {
  id?: string;
  className?: string;
  style?: CSSProperties;
};

export function Soom3DLoader(props: Soom3DLoaderProps) {
  return <soom-3d-loader {...props} />;
}
