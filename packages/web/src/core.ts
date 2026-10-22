// Pure frame math. Mirrors SPEC.md section by section; keep it in sync with
// ios/Sources/Soom/Core.swift and android/.../Core.kt.
import { DEFAULTS, VARIANTS, type Variant } from "./presets.js";

const GA = Math.PI * (3 - Math.sqrt(5));
const TAU = 2 * Math.PI;
const smooth = (a: number) => a * a * (3 - 2 * a);

export function hash01(i: number): number {
  let x = Math.imul(i + 1, 2654435761) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x45d9f3b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

/** Numbers per dot in a frame: x, y, depth, fade. */
export const STRIDE = 4;

type Vec = [number, number, number];
type Params = Record<string, number>;

/** Point `i` of `n` on a Fibonacci sphere (unit radius). */
function fib(i: number, n: number): Vec {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const th = GA * i;
  return [Math.cos(th) * r, y, Math.sin(th) * r];
}

const rotX = ([x, y, z]: Vec, b: number): Vec => [x, y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)];
const rotY = ([x, y, z]: Vec, g: number): Vec => [x * Math.cos(g) + z * Math.sin(g), y, -x * Math.sin(g) + z * Math.cos(g)];
const rotZ = ([x, y, z]: Vec, g: number): Vec => [x * Math.cos(g) - y * Math.sin(g), x * Math.sin(g) + y * Math.cos(g), z];

/** Largest n ≥ 2 with n³ ≤ count (integer-only so every platform agrees). */
function cubeSide(count: number): number {
  let n = 2;
  while ((n + 1) * (n + 1) * (n + 1) <= count) n++;
  return n;
}

/** Grid divisions per cube edge for morph: largest n ≥ 1 with 6n² + 2 ≤ count. */
function morphSide(count: number): number {
  let n = 1;
  while (6 * (n + 1) * (n + 1) + 2 <= count) n++;
  return n;
}

/** How many dots a variant draws for a requested count (grid variants round down). */
export function dotCount(variant: Variant, requested: number): number {
  if (variant === "morph") {
    const n = morphSide(requested);
    return 6 * n * n + 2;
  }
  if (variant === "cube") {
    const n = cubeSide(requested);
    return n * n * n;
  }
  return requested;
}

/** Position of dot `i` (of `count`) before the shared rotation. */
function place(variant: Variant, v: Params, i: number, count: number, t: number): Vec {
  const u = i / count;
  const [sx, sy, sz] = fib(i, count);
  const r = Math.sqrt(1 - sy * sy);
  const th = GA * i;
  const crest = (angle: number) => Math.pow((1 + Math.cos(angle - v.rate * t)) / 2, v.sharpness);

  switch (variant) {
    case "orbit":
      return [sx, sy, sz];
    case "wave": {
      const s = 1 + v.amplitude * Math.sin(sy * v.frequency + 3 * t) * Math.cos(0.5 * th + t);
      return [sx * s, sy * s, sz * s];
    }
    case "morph": {
      // Lattice points on the cube's surface, edges and corners included (each once), in
      // a fixed scan order; blends between the normalised (sphere) and flat (cube) point.
      const n = morphSide(count);
      let q: Vec = [0, 0, 0];
      let seen = -1;
      scan: for (let a = 0; a <= n; a++) {
        for (let b = 0; b <= n; b++) {
          for (let c = 0; c <= n; c++) {
            if (a % n !== 0 && b % n !== 0 && c % n !== 0) continue;
            if (++seen === i) {
              q = [-1 + (2 * a) / n, -1 + (2 * b) / n, -1 + (2 * c) / n];
              break scan;
            }
          }
        }
      }
      const len = Math.hypot(...q);
      const m = smooth((Math.sin(v.rate * t) + 1) / 2);
      const s = 1 / len + (v.cubeSize - 1 / len) * m;
      return [q[0] * s, q[1] * s, q[2] * s];
    }
    case "breathe": {
      const e = smooth(Math.max(0, Math.sin(v.rate * t)));
      const s = 1 + e * v.spread * (0.5 + hash01(i));
      return [sx * s, sy * s, sz * s];
    }
    case "surf": {
      // Crest sweeps left to right around the sphere; swells most at the equator, a little at the poles.
      const s = 1 + v.amplitude * crest(-th) * (v.poleSwell + (1 - v.poleSwell) * Math.pow(r, v.equatorBias));
      return [sx * s, sy * s, sz * s];
    }
    case "helix": {
      const half = Math.ceil(count / 2);
      const w = Math.floor(i / 2) / half;
      const a = TAU * v.turns * w + (i % 2) * Math.PI;
      const rad = v.radius * (1 + v.pulse * Math.sin(2 * TAU * w - v.rate * t));
      return [Math.cos(a) * rad, 0.9 * (2 * w - 1), Math.sin(a) * rad];
    }
    case "twist": {
      const a = v.amount * Math.sin(v.rate * t) * sy;
      return [sx * Math.cos(a) - sz * Math.sin(a), sy, sx * Math.sin(a) + sz * Math.cos(a)];
    }
    case "chase": {
      // Beads (little dotted balls) round a ring, like a classic spinner. A crest runs round:
      // the bead under it comes forward and grows, the rest sit back, small and faint.
      const beads = Math.round(v.beads);
      const bead = i % beads;
      const per = Math.ceil(count / beads);
      const a = (TAU * bead) / beads;
      const c = crest(a);
      const [x, y, z] = fib(Math.floor(i / beads), per);
      const br = v.beadRadius * (0.55 + 0.6 * c);
      return [Math.cos(a) * v.radius + x * br, Math.sin(a) * v.radius + y * br, v.lift * (2 * c - 1) + z * br];
    }
    case "comet": {
      // A comet on a tilted orbit: thick head, thinning tail; more dots near the head.
      const s = Math.pow(u, 1.6);
      const a = v.rate * t - TAU * v.length * s;
      const rho = v.headRadius * Math.pow(1 - s, 1.2) + 0.01;
      const ring = v.radius + Math.cos(th) * rho;
      return [ring * Math.cos(a), Math.sin(th) * rho, ring * Math.sin(a)];
    }
    case "bounce": {
      // Three dotted balls hopping one after another, each slowly turning.
      const ball = i % 3;
      const per = Math.ceil(count / 3);
      const [x, y, z] = rotY(fib(Math.floor(i / 3), per), v.rate * t);
      const hop = v.height * Math.max(0, Math.sin(v.rate * t - ball * v.delay));
      return [x * v.ballRadius + (ball - 1) * v.gap, y * v.ballRadius - hop, z * v.ballRadius];
    }
    case "pulse": {
      // Rings of dots spreading from the centre and sinking back as they widen.
      const rings = Math.round(v.rings);
      const k = i % rings;
      const per = Math.ceil(count / rings);
      const phase = v.rate * t + k / rings;
      const p = phase - Math.floor(phase);
      const rr = 0.12 + 0.88 * p;
      const a = (TAU * Math.floor(i / rings)) / per;
      return [Math.cos(a) * rr, v.sink * p * p, Math.sin(a) * rr];
    }
    case "beat": {
      // A row of bars on a gentle arc, each a 2x2 column of dots, rising and falling like an
      // equaliser; bars grow up and down from the middle.
      const bars = Math.round(v.bars);
      const b = i % bars;
      const k = Math.floor(i / bars);
      const per = Math.ceil(count / bars / 4);
      const s = (Math.floor(k / 4) + 0.5) / per - 0.5;
      const level = Math.pow(0.5 + 0.5 * Math.sin(v.rate * t - b * v.phase), 2);
      const h = v.minHeight + (v.maxHeight - v.minHeight) * level;
      const x = (b - (bars - 1) / 2) * v.gap;
      const ox = (k % 2 === 0 ? -1 : 1) * v.thickness;
      const oz = (Math.floor(k / 2) % 2 === 0 ? -1 : 1) * v.thickness;
      return [x + ox, s * h, -v.arc * x * x + oz];
    }
    case "cube": {
      // A grid cube whose layers turn a quarter turn one after another, like a puzzle cube.
      const n = cubeSide(count);
      const g = (k: number) => v.size * (-1 + (2 * (k + 0.5)) / n);
      const q: Vec = [g(Math.floor(i / (n * n))), g(Math.floor(i / n) % n), g(i % n)];
      const step = Math.floor(v.rate * t);
      const turn = smooth(v.rate * t - step) * (Math.PI / 2);
      const axis = step % 3;
      const layer = g(Math.floor(step / 3) % n);
      if (Math.abs(q[axis] - layer) > 1e-9) return q;
      const [c, sn] = [Math.cos(turn), Math.sin(turn)];
      if (axis === 0) return [q[0], q[1] * c - q[2] * sn, q[1] * sn + q[2] * c];
      if (axis === 1) return [q[0] * c + q[2] * sn, q[1], -q[0] * sn + q[2] * c];
      return [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c, q[2]];
    }
    case "trio": {
      // Three dotted balls chasing each other round a tilted circle.
      const ball = i % 3;
      const per = Math.ceil(count / 3);
      const [x, y, z] = fib(Math.floor(i / 3), per);
      const a = v.rate * t + (ball * TAU) / 3;
      const rr = v.ballRadius * (1 + v.pulse * Math.sin(v.rate * 2 * t + ball * 2));
      return [x * rr + Math.cos(a) * v.radius, y * rr, z * rr + Math.sin(a) * v.radius];
    }
    case "atom": {
      // A nucleus of jiggling nucleons and three electrons (dense little balls) flying round
      // it on crossed orbits, like the classic atom symbol without the drawn orbits.
      const nucleusN = Math.floor(count * v.nucleusShare);
      if (i < nucleusN) {
        const nucleon = i % 8;
        const per = Math.ceil(nucleusN / 8);
        const jiggle = 1 + 0.08 * Math.sin(v.rate * 3 * t + nucleon * 1.7);
        const [cx, cy, cz] = fib(nucleon, 8);
        const [x, y, z] = fib(Math.floor(i / 8), per);
        return [
          cx * v.nucleusRadius * jiggle + x * v.nucleonRadius,
          cy * v.nucleusRadius * jiggle + y * v.nucleonRadius,
          cz * v.nucleusRadius * jiggle + z * v.nucleonRadius,
        ];
      }
      // Each electron's dots are split between its ball and a trail along its orbit behind it,
      // packed tight near the electron and thinning out further back.
      const j = i - nucleusN;
      const e = j % 3;
      const k = Math.floor(j / 3);
      const perElectron = Math.ceil((count - nucleusN) / 3);
      const ballN = Math.max(1, Math.round(perElectron * v.electronShare));
      const head = v.rate * t * (1 + 0.15 * e) + (e * TAU) / 3;
      const orbitPoint = (a: number) =>
        rotZ(rotX([Math.cos(a) * v.orbitRadius, 0, Math.sin(a) * v.orbitRadius], v.orbitTilt), (e * Math.PI) / 3);
      if (k >= ballN) {
        const q = (k - ballN + 1) / Math.max(1, perElectron - ballN);
        return orbitPoint(head - TAU * v.trailLength * Math.pow(q, 1.7));
      }
      const [cx, cy, cz] = orbitPoint(head);
      const [x, y, z] = fib(k, ballN);
      return [cx + x * v.electronRadius, cy + y * v.electronRadius, cz + z * v.electronRadius];
    }
  }
}

/**
 * How strongly dot `i` is drawn, 0–1 (1 for almost every dot). Trails use it to thin out:
 * renderers multiply the dot's alpha by it and shrink it a little.
 */
function fade(variant: Variant, v: Params, i: number, count: number): number {
  if (variant !== "atom") return 1;
  const nucleusN = Math.floor(count * v.nucleusShare);
  if (i < nucleusN) return 1;
  const k = Math.floor((i - nucleusN) / 3);
  const perElectron = Math.ceil((count - nucleusN) / 3);
  const ballN = Math.max(1, Math.round(perElectron * v.electronShare));
  if (k < ballN) return 1;
  return 1 - v.trailFade * ((k - ballN + 1) / Math.max(1, perElectron - ballN));
}

/**
 * Returns STRIDE numbers per dot (x, y, depth, fade), sorted back to front.
 * `t` is elapsed seconds already multiplied by speed.
 * Draws `dotCount(variant, requested)` dots.
 */
export function computeFrame(variant: Variant, requested: number, t: number, out?: Float64Array): Float64Array {
  const d = DEFAULTS;
  const v = VARIANTS[variant] as Params;
  const count = dotCount(variant, requested);
  const extent = v.extent;
  const spin = v.spin ?? d.spin;
  const ca = Math.cos(spin * t), sa = Math.sin(spin * t);
  const tilt = v.tilt ?? d.tilt;
  const cb = Math.cos(tilt), sb = Math.sin(tilt);
  const raw = new Float64Array(count * STRIDE);

  for (let i = 0; i < count; i++) {
    const [px, py, pz] = place(variant, v, i, count, t);
    const X = px * ca + pz * sa;
    const Z = -px * sa + pz * ca;
    const Y = py * cb - Z * sb;
    const Z2 = py * sb + Z * cb;
    const k = 1 / (1 - Z2 * d.perspective);
    raw[i * STRIDE] = (X * k) / extent;
    raw[i * STRIDE + 1] = (Y * k) / extent;
    raw[i * STRIDE + 2] = Math.min(1, Math.max(0, (Z2 / extent + 1) / 2));
    raw[i * STRIDE + 3] = fade(variant, v, i, count);
  }

  const order = Array.from({ length: count }, (_, i) => i);
  order.sort((a, b) => raw[a * STRIDE + 2] - raw[b * STRIDE + 2] || a - b);
  const result = out && out.length === count * STRIDE ? out : new Float64Array(count * STRIDE);
  for (let j = 0; j < count; j++) {
    result.set(raw.subarray(order[j] * STRIDE, order[j] * STRIDE + STRIDE), j * STRIDE);
  }
  return result;
}
