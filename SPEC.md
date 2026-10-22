# soom spec

Every platform (web, iOS, Android) implements this document exactly.
The shader variants (`blob`, `bubble`, `swell`, `twirl`, `strand`, `drift`, `moons`,
`stack`, `bloom`, `gyro`, `ripple`, `halo`, `ribbon`, `jelly`) are a web-only prototype
(`packages/web/src/shader.ts`) and are not covered here yet.
Numeric constants live in [`presets/presets.json`](presets/presets.json) and are
generated into each platform with `npm run gen`. Never hard-code them.

Correctness is checked against [`spec/golden.json`](spec/golden.json): every
platform's core must reproduce those frames within `1e-6`.

## Inputs

| Name | Type | Default | Meaning |
|---|---|---|---|
| `variant` | `orbit` `wave` `morph` `breathe` `surf` `helix` `twist` `chase` `comet` `bounce` `pulse` `beat` `cube` `trio` `atom` | `orbit` | Shape motion |
| `count` | int | `defaults.count` | Requested dots (`morph` and `cube` round down to a full lattice) |
| `t` | seconds | — | Elapsed time **already multiplied by `speed`** |

## 1. Dot layout (Fibonacci sphere)

`fib(i, n)` is point `i` of `n` on the unit Fibonacci sphere:

```
GA        = π · (3 − √5)
y         = 1 − 2 · (i + 0.5) / n
r         = √(1 − y²)
θ         = GA · i
fib(i, n) = (cos θ · r, y, sin θ · r)
```

For dot `i` of `count`, the sphere variants start from `p = fib(i, count)` and use
its `r` and `θ`; `u = i / count`. All `÷` on integers below is integer division,
`⌈a / b⌉` on integers is `(a + b − 1) ÷ b`, and `frac(x) = x − ⌊x⌋`.
`rotX`, `rotY`, `rotZ` rotate a point about that axis (right-handed, as in §4).

## 2. Per-dot hash (deterministic, integer-only)

32-bit unsigned arithmetic with wrap-around:

```
x = (i + 1) * 2654435761
x = x ^ (x >>> 16)
x = x * 0x45d9f3b
x = x ^ (x >>> 16)
hash(i) = x / 4294967296          // [0, 1)
```

## 3. Variant positions

`smooth(a) = a² · (3 − 2a)`, `crest(φ) = ((1 + cos(φ − rate · t)) / 2) ^ sharpness`.

Sphere variants (start from `p = fib(i, count)`):

- **orbit**: `p`.
- **wave**: `p · (1 + amplitude · sin(p.y · frequency + 3t) · cos(0.5θ + t))`.
- **breathe**: `e = smooth(max(0, sin(rate · t)))`, `p · (1 + e · spread · (0.5 + hash(i)))`.
- **surf**: `p · (1 + amplitude · crest(−θ) · (poleSwell + (1 − poleSwell) · r ^ equatorBias))`;
  the crest runs left to right across the front.
- **twist**: `a = amount · sin(rate · t) · p.y`; `(p.x cos a − p.z sin a, p.y, p.x sin a + p.z cos a)`.

Variants with their own layout:

- **morph** (cube surface lattice, `6n² + 2` dots, `n` = largest integer ≥ 1 with
  `6n² + 2 ≤ count`, found by counting up): scan `a`, then `b`, then `c` over `0 … n`
  (nested in that order) and keep the points where at least one of `a, b, c` is `0` or `n`;
  dot `i` is the `i`-th kept point, `q = (−1 + 2a/n, −1 + 2b/n, −1 + 2c/n)`.
  `m = smooth((sin(rate · t) + 1) / 2)`, `p = q · (1/|q| + (cubeSize − 1/|q|) · m)`.
- **helix**: `half = ⌈count / 2⌉`, `w = (i ÷ 2) / half`, `a = 2π · turns · w + (i mod 2) · π`,
  `ρ = radius · (1 + pulse · sin(4π w − rate · t))`, `p = (cos a · ρ, 0.9 · (2w − 1), sin a · ρ)`.
- **chase** (beads on a ring): `B = beads`, `b = i mod B`, `a = 2π b / B`, `c = crest(a)`,
  `q = fib(i ÷ B, ⌈count / B⌉)`, `ρ = beadRadius · (0.55 + 0.6c)`;
  `p = (cos a · radius + q.x ρ, sin a · radius + q.y ρ, lift · (2c − 1) + q.z ρ)`.
- **comet**: `s = u ^ 1.6`, `a = rate · t − 2π · length · s`, `ρ = headRadius · (1 − s) ^ 1.2 + 0.01`,
  `R = radius + cos θ · ρ`; `p = (R cos a, sin θ · ρ, R sin a)`.
- **bounce** (three balls): `b = i mod 3`, `q = rotY(fib(i ÷ 3, ⌈count / 3⌉), rate · t)`,
  `hop = height · max(0, sin(rate · t − b · delay))`;
  `p = (q.x · ballRadius + (b − 1) · gap, q.y · ballRadius − hop, q.z · ballRadius)`.
- **pulse** (expanding rings): `K = rings`, `k = i mod K`, `f = frac(rate · t + k / K)`,
  `ρ = 0.12 + 0.88f`, `a = 2π (i ÷ K) / ⌈count / K⌉`; `p = (cos a · ρ, sink · f², sin a · ρ)`.
- **beat** (equaliser bars): `B = bars`, `b = i mod B`, `k = i ÷ B`, `per = ⌈count / B / 4⌉`
  (real division, then ceiling), `s = ((k ÷ 4) + 0.5) / per − 0.5`,
  `level = (0.5 + 0.5 sin(rate · t − b · phase))²`, `h = minHeight + (maxHeight − minHeight) · level`,
  `x = (b − (B − 1) / 2) · gap`, `ox = ∓thickness` for even/odd `k`, `oz = ∓thickness` for even/odd `k ÷ 2`;
  `p = (x + ox, s · h, −arc · x² + oz)`.
- **cube** (puzzle cube, `n³` dots, `n` = largest integer ≥ 2 with `n³ ≤ count`, found by counting up):
  `g(k) = size · (−1 + 2(k + 0.5) / n)`, `q = (g(i ÷ n²), g((i ÷ n) mod n), g(i mod n))`.
  `step = ⌊rate · t⌋`, `turn = smooth(rate · t − step) · π/2`, `axis = step mod 3`,
  `layer = g((step ÷ 3) mod n)`. If `q[axis] ≠ layer` (beyond `1e-9`), `p = q`; otherwise `p` is
  `q` rotated by `turn` about that axis.
- **trio** (three balls on a circle): `b = i mod 3`, `q = fib(i ÷ 3, ⌈count / 3⌉)`,
  `a = rate · t + 2π b / 3`, `ρ = ballRadius · (1 + pulse · sin(2 rate · t + 2b))`;
  `p = (q.x ρ + cos a · radius, q.y ρ, q.z ρ + sin a · radius)`.
- **atom**: `N = ⌊count · nucleusShare⌋`.
  - Nucleus, `i < N`: `m = i mod 8`, `j = 1 + 0.08 sin(3 rate · t + 1.7m)`;
    `p = fib(m, 8) · nucleusRadius · j + fib(i ÷ 8, ⌈N / 8⌉) · nucleonRadius`.
  - Electrons, `i ≥ N`: `j = i − N`, `e = j mod 3`, `k = j ÷ 3`, `P = ⌈(count − N) / 3⌉`,
    `ball = max(1, round(P · electronShare))`, `head = rate · t · (1 + 0.15e) + 2π e / 3`,
    `O(a) = rotZ(rotX((cos a · orbitRadius, 0, sin a · orbitRadius), orbitTilt), e · π/3)`.
    If `k ≥ ball` (trail): `p = O(head − 2π · trailLength · ((k − ball + 1) / max(1, P − ball)) ^ 1.7)`;
    else `p = O(head) + fib(k, ball) · electronRadius`.

## 4. Rotation

```
a = spin · t                      // around Y
b = tilt                          // around X
// Every variant has its own `spin` / `tilt` (presets.json, falling back to the defaults).
X  =  p.x cos a + p.z sin a
Z  = −p.x sin a + p.z cos a
Y  =  p.y cos b − Z sin b
Z' =  p.y sin b + Z cos b
```

## 5. Projection and output

```
k     = 1 / (1 − Z' · perspective)
x_out = X · k / extent            // ≈ [−1, 1]
y_out = Y · k / extent            // +y is down on screen
depth = clamp((Z' / extent + 1) / 2, 0, 1)   // 0 = back, 1 = front
```

Each dot is `(x_out, y_out, depth, fade)`, **sorted by depth ascending** (stable:
ties keep index order), so renderers draw back to front.

`fade` is 1 except on **atom** trail dots (`k ≥ ball` above), where
`fade = 1 − trailFade · (k − ball + 1) / max(1, P − ball)`.

## 6. Rendering

For a square of side `size` px:

```
cx, cy = size / 2
px     = cx + x_out · size / 2
py     = cy + y_out · size / 2
radius = size · 0.022 · dotScale · (0.45 + 0.75 · depth) · (0.5 + 0.5 · fade)
alpha  = (minAlpha + (1 − minAlpha) · depth) · fade
```

Fill each dot as a circle in the single `color` at `alpha`. The default
color is `#000000` on every platform.

## 7. Behaviour every renderer must have

- Pause when off screen or when the app/tab is hidden.
- Reduced motion (OS setting): draw one still frame at `t = 0.6`.
- Accessibility: expose as a status/progress element labelled `"Loading"`
  (overridable).
- Cap device pixel ratio at 2 on the web.
