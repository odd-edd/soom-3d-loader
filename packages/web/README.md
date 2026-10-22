# soom-3d-loader

Minimal 3D loading animations for the web. Drop in one tag, no dependencies, ~18 kB.

- **15 dot loaders** drawn on a 2D canvas: spheres, rings, beads and atoms made of dots that rotate in 3D.
- **14 shader loaders** drawn with WebGL: glossy glowing bodies and pale glass.
- Works with any framework (it is a standard custom element), pauses when off screen,
  respects reduced motion, and is announced to screen readers as a loading status.

## Install

```bash
npm install @oddedd/soom-3d-loader
```

## Quick start

```js
import "@oddedd/soom-3d-loader/auto"; // registers <soom-3d-loader>
```

```html
<soom-3d-loader variant="orbit" size="48"></soom-3d-loader>
```

Without a bundler:

```html
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@oddedd/soom-3d-loader@0.1.1/dist/auto.js";
</script>
<soom-3d-loader variant="atom" size="64"></soom-3d-loader>
```

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `variant` | `orbit` | Which loader (see below) |
| `size` | `48` | Width and height in CSS pixels |
| `color` | `#000000` for dots, own palette for shaders | Any CSS color; `currentColor` follows the text color |
| `count` | `180` | Dot loaders: number of dots. Shader loaders: complexity (more waves, twists, petals…) |
| `speed` | `1` | Animation speed multiplier |
| `label` | `Loading` | Accessible name |

## Variants

**Dots** (2D canvas, any browser)

`orbit` · `wave` · `morph` · `breathe` · `surf` · `helix` · `twist` · `chase` · `comet` ·
`bounce` · `pulse` · `beat` · `cube` · `trio` · `atom`

**Shaders** (WebGL; falls back to `orbit` dots if WebGL is unavailable)

- Glow: `blob` · `twirl` · `strand` · `moons` · `stack` · `bloom` · `gyro`
- Glass: `bubble` · `swell` · `drift` · `ripple` · `halo` · `ribbon` · `jelly`

## React and Next.js

Use the React component. It registers the element, types its props, and is marked
`"use client"`, so it works straight from Next.js server components.

```tsx
import { Soom3DLoader } from "@oddedd/soom-3d-loader/react";

export default function Page() {
  return <Soom3DLoader variant="chase" size={32} color="currentColor" />;
}
```

Prefer the raw tag? Importing the React entry once also types `<soom-3d-loader>` in JSX:

```tsx
"use client";
import "@oddedd/soom-3d-loader/react";

export function Spinner() {
  return <soom-3d-loader variant="atom" size={48} />;
}
```

Needs React 18 or later; tested with React 19.2 and Next.js 16 (dev, production build and
server rendering, with no hydration warnings).

## Other frameworks

`<soom-3d-loader>` is a standard custom element, so it works anywhere HTML does (Vue, Svelte,
Angular, plain HTML). Import `@oddedd/soom-3d-loader/auto` once on the client, then use the tag.
Importing the package during server rendering is safe; drawing starts in the browser.

## Canvas API

To draw into your own canvas instead of using the tag:

```js
import { Loader } from "@oddedd/soom-3d-loader";

const loader = new Loader(canvas, { variant: "comet", size: 64, color: "#7c5cff" });
loader.update({ speed: 1.5 });
loader.destroy();
```

## Behaviour

- Pauses when scrolled off screen or when the tab is hidden.
- With "reduce motion" enabled in the OS, shows a single still frame.
- Announced as a loading status (`role="status"`, label "Loading" by default), set through
  `ElementInternals` so the element's own attributes stay untouched for server rendering.
- All shader loaders on a page share one WebGL context, so many loaders never hit the browser's context limit.

## License

MIT © Odd Edd
