# soom-3d-loader

Minimal 3D dot-sphere loading animations for web, iOS, and Android.
One spec, three native implementations, identical frames.

Variants: `orbit` · `wave` · `morph` · `breathe` · `surf` · `helix` · `twist` · `chase` · `comet` · `bounce` · `pulse` · `beat` · `cube` · `trio` · `atom`

Web-only prototypes (WebGL shaders, not in SPEC yet), in two materials:

- Glow (dark glossy body, blue-to-violet rim): `blob` (cube-to-sphere morph) ·
  `twirl` (wringing column, like `twist`) · `strand` (double helix, like `helix`) ·
  `moons` (moons orbiting a core) · `stack` (a deck of plates swinging in turn) ·
  `bloom` (petals opening and closing) · `gyro` (nested spinning rings)
- Glass (pale blue, flowing sheen): `bubble` (wobbling bubble with an orbiting arc) ·
  `swell` (a swell running around the equator, like `surf`) · `drift` (droplets
  parting and merging, like `breathe`) · `ripple` (rings spreading over a disc) ·
  `halo` (beads travelling around a ring) · `ribbon` (a half-twisted band) ·
  `jelly` (a bouncing, squashing jelly)

Without `color` they use their own palette; with `color` they are tinted.
For these, `count` sets complexity instead of dot count (180 = default look): more
waves (`swell`), twists (`twirl`), turns (`strand`), droplets (`drift`), moons, plates,
petals, rings, ripples, beads or half-twists, or finer wobble (`blob`, `bubble`, `jelly`).

## Install and use

### Web

```bash
npm install @odd-edd/soom-3d-loader
```

```html
<script type="module">import "@odd-edd/soom-3d-loader/auto";</script>
<soom-3d-loader variant="orbit" size="48"></soom-3d-loader>
```

Attributes: `variant`, `size` (px), `color` (defaults to `#000000`; `currentColor` follows the text color), `count`, `speed`, `label`.
For frameworks, `new Loader(canvas, options)` is exported too.

### iOS (Swift Package Manager)

Add `https://github.com/odd-edd/soom-3d-loader` as a package dependency.

```swift
import Soom3DLoader

Soom3DLoaderView(variant: .orbit)
    .frame(width: 48, height: 48)
```

UIKit: `Soom3DLoaderUIView(variant: .wave)`.

### Android (Jetpack Compose)

```kotlin
Soom3DLoader(modifier = Modifier.size(48.dp), variant = Variant.Orbit)
```

XML layouts: `io.github.oddedd.soom3dloader.Soom3DLoaderView`.

## Repository layout

```
SPEC.md                 the math every platform implements
presets/presets.json    single source of numeric constants
spec/golden.json        reference frames all three cores must match
packages/web/           npm package "@odd-edd/soom-3d-loader" (TypeScript)
Package.swift, ios/     Swift package "Soom3DLoader" (SwiftUI)
android/                Android library (Kotlin, Compose)
playground/             local tuning page
scripts/                code generation, golden frames, versioning
```

## Development

```bash
npm install
npm run dev        # playground at http://localhost:5173
npm test           # build web + check against golden frames
swift test         # iOS core vs golden frames (needs Xcode)
gradle -p android :soom-3d-loader:testDebugUnitTest
```

Changing behaviour:

1. Edit `presets/presets.json` and/or `SPEC.md`.
2. `npm run gen` writes the constants into all three platforms.
3. Update the web core, then `npm run golden` to regenerate reference frames.
4. Port the change to Swift and Kotlin until their golden tests pass.

## Releasing

All platforms share one version.

```bash
npm run version:set -- 0.2.0
git commit -am "Release 0.2.0"
git tag v0.2.0 && git push --follow-tags
```

The tag publishes to npm and creates a GitHub release; Swift Package Manager picks up the tag directly.

## License

MIT
