// GPU loaders (web prototype). Unlike the dot variants these are not part of SPEC.md
// and have no golden frames yet: they ray-march a signed distance field per pixel.
//
// One WebGL context is shared by every loader on the page: each frame is rendered
// into a hidden canvas and copied onto the loader's own 2D canvas, so any number of
// loaders stays under the browser's WebGL context limit.

export const SHADER_VARIANTS = [
  "blob", "bubble", "swell", "twirl", "strand", "drift",
  "moons", "stack", "bloom", "gyro", "ripple", "halo", "ribbon", "jelly",
] as const;
export type ShaderVariant = (typeof SHADER_VARIANTS)[number];

export const isShaderVariant = (v: string): v is ShaderVariant => (SHADER_VARIANTS as readonly string[]).includes(v);

type RGB = [number, number, number];

// Two materials, matching the references: a dark glossy body with a blue-to-violet rim glow,
// and pale blue glass.
const GLOW: [RGB, RGB] = [[0.25, 0.45, 1.0], [0.62, 0.3, 1.0]];
const GLASS: [RGB, RGB] = [[0.45, 0.65, 1.0], [0.55, 0.95, 1.0]];

/** Default palettes per variant. */
const PALETTES: Record<ShaderVariant, [RGB, RGB]> = {
  blob: GLOW,
  bubble: GLASS,
  swell: GLASS,
  twirl: GLOW,
  strand: GLOW,
  drift: GLASS,
  moons: GLOW,
  stack: GLOW,
  bloom: GLOW,
  gyro: GLOW,
  ripple: GLASS,
  halo: GLASS,
  ribbon: GLASS,
  jelly: GLASS,
};

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Shared ray-marching helpers and the two materials; each variant supplies
// map(), shade(), miss() and overlay().
const COMMON = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec3 u_c1;
uniform vec3 u_c2;
// Complexity from the loader's count: 1.0 at the default count, more = busier shapes.
uniform float u_detail;

const float TAU = 6.28318;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdBox2(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// Clamp a count-driven integer: round(base * u_detail) within [lo, hi].
int countOf(float base, float lo, float hi) {
  return int(clamp(floor(base * u_detail + 0.5), lo, hi));
}

// Polynomial smooth minimum: merges shapes like liquid.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p);

// A map() that shrinks its distance to stay safe (twists) sets this to the factor it
// divided by, so the halo can use the undivided distance.
float g_lip = 1.0;

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

// Dark glossy body; the rim picks up the palette.
vec4 glowShade(vec3 n, vec3 rd) {
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  vec3 rim = mix(u_c1, u_c2, 0.5 + 0.5 * n.y);
  vec3 body = vec3(0.03, 0.035, 0.09) + 0.08 * u_c1 * max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
  float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.5, 0.7, 0.6))), 0.0), 80.0);
  return vec4(body + rim * fres * 1.6 + spec * 0.35, 1.0);
}

// Soft halo around a glow body, from the closest distance the ray passed.
vec4 glowMiss(float closest) {
  // Fade out before the canvas edge so the halo never shows the square's border.
  float g = exp(-closest * 9.0) * 0.55 * smoothstep(1.0, 0.75, length(v_uv));
  vec3 c = mix(u_c1, u_c2, 0.5 + 0.5 * sin(u_time * 0.8));
  return vec4(c * g, g);
}

// Thin glass with a flowing inner sheen; q orients the sheen.
vec4 glassShade(vec3 n, vec3 rd, vec3 q) {
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
  float swirl = 0.5 + 0.5 * sin(5.0 * (q.x + q.y * 0.7) + u_time * 1.8 + 3.0 * sin(q.z * 3.0 + u_time));
  vec3 glass = mix(vec3(0.93, 0.95, 1.0), u_c1, 0.35 + 0.45 * fres);
  glass = mix(glass, u_c2, swirl * 0.45);
  glass = mix(glass, u_c1 * 0.7, smoothstep(0.75, 1.0, swirl) * 0.35);
  float spec = pow(max(dot(reflect(rd, n), normalize(vec3(0.5, 0.6, 0.7))), 0.0), 25.0);
  float a = 0.35 + 0.55 * fres + 0.12 * swirl + spec;
  vec3 c = glass + spec * vec3(0.7, 1.0, 1.0);
  return vec4(c * a, a);
}

vec4 shade(vec3 p, vec3 n, vec3 rd);
vec4 miss(vec3 rd, float closest);
vec4 overlay(vec2 uv);

void main() {
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(v_uv * 0.42, -1.0));
  float t = 0.0;
  float closest = 1e3;
  vec4 col = vec4(0.0);
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    closest = min(closest, d * g_lip);
    if (d < 0.001) { hit = true; break; }
    // Under-step: twisted and displaced fields are not exact distances.
    t += d * 0.6;
    if (t > 6.0) break;
  }
  if (hit) {
    vec3 p = ro + rd * t;
    col = shade(p, normalAt(p), rd);
  } else {
    col = miss(rd, closest);
  }
  vec4 o = overlay(v_uv);
  col = o + col * (1.0 - o.a);
  gl_FragColor = col; // premultiplied alpha
}`;

const NO_OVERLAY = `vec4 overlay(vec2 uv) { return vec4(0.0); }`;
const GLOW_SURFACE = `
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glowShade(n, rd); }
vec4 miss(vec3 rd, float closest) { return glowMiss(closest); }
${NO_OVERLAY}`;

const SOURCES: Record<ShaderVariant, string> = {
  // Glossy dark body morphing between a rounded cube and a sphere.
  blob: `
float map(vec3 p) {
  p = rotY(u_time * 0.7) * rotX(0.6 + sin(u_time * 0.5) * 0.3) * rotZ(u_time * 0.4) * p;
  float m = 0.5 + 0.5 * sin(u_time * 1.1);
  float box = sdRoundBox(p, vec3(0.42), 0.28);
  float ball = length(p) - 0.78;
  float f = 3.0 * pow(u_detail, 0.8);
  float wobble = 0.035 * sqrt(u_detail) * sin(f * p.x + u_time * 1.7) * sin(f * p.y + u_time * 1.3) * sin(f * p.z + u_time);
  return mix(box, ball, m * 0.6) + wobble;
}
${GLOW_SURFACE}`,

  // Glass bubble with a wobbling surface and an orbiting arc.
  bubble: `
float map(vec3 p) {
  vec3 q = rotY(u_time * 0.5) * p;
  float f = 4.0 * pow(u_detail, 0.8);
  float wobble = 0.045 * sin(f * q.x + u_time * 2.1) * sin(f * q.y + u_time * 1.6) * sin(f * q.z + u_time * 1.2);
  return length(p) - 0.72 + wobble;
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, rotY(u_time * 0.5) * n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
vec4 overlay(vec2 uv) {
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float head = mod(-u_time * 1.6, TAU);
  float along = mod(ang - head + TAU, TAU);
  float tail = smoothstep(2.2, 0.0, along);
  float line = smoothstep(0.012, 0.0, abs(r - 0.93)) * tail * 0.6;
  return vec4(u_c1 * line, line);
}`,

  // surf in glass: a swell runs left to right around the equator.
  // The crest is measured against a direction in 3D (not longitude), so it stays smooth
  // at the poles: they swell gently and roundly instead of pinching into a point.
  swell: `
float map(vec3 p) {
  vec3 q = rotX(0.15) * p;
  vec3 nq = q / max(length(q), 1e-4);
  // 1 crest at the default count, up to 6; more crests are narrower so they stay apart.
  int waves = int(clamp(floor(u_detail * 1.5 + 0.5), 1.0, 6.0));
  float sharp = 3.0 * float(waves);
  float crest = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= waves) break;
    float a = u_time * 2.4 + TAU * float(k) / float(waves);
    crest = max(crest, pow(0.5 + 0.5 * dot(nq, vec3(cos(a), 0.0, -sin(a))), sharp));
  }
  return length(p) - 0.64 - 0.24 * crest;
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, rotY(u_time * 0.3) * n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,

  // twist in glow: a rounded column whose top and bottom wring in opposite directions.
  twirl: `
float map(vec3 p) {
  p = rotZ(0.35) * rotY(u_time * 0.5) * p;
  // Twisting around Y keeps the radius, so the column stays inside this sphere. Well
  // outside it (far enough that the halo is already faint) the sphere distance is enough.
  float bound = length(p) - 1.1;
  g_lip = 1.0;
  if (bound > 0.4) return bound;
  float k = 2.4 * u_detail * sin(u_time * 1.4);
  float a = k * p.y;
  float c = cos(a), s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  // Twisting stretches distances; divide by the twist's Lipschitz bound so rays don't overshoot.
  g_lip = sqrt(1.0 + k * k * 0.25);
  return sdRoundBox(p, vec3(0.36, 0.68, 0.36), 0.14) / g_lip;
}
${GLOW_SURFACE}`,

  // helix in glow: two smooth tubes winding around each other; more count, more turns.
  // Distance to a helix: unwind by the point's angle and fold y into one pitch. The two
  // strands sit half a pitch apart, so folding by half the pitch covers both.
  strand: `
float map(vec3 p) {
  p = rotZ(0.25) * rotY(u_time * 1.5) * p;
  float halfH = 0.85;
  float pitch = 2.0 * halfH / (0.9 * u_detail);
  float a = atan(p.z, p.x);
  float y = p.y - pitch * a / TAU;
  float fold = mod(y + pitch * 0.25, pitch * 0.5) - pitch * 0.25;
  float rad = 0.1 * (1.0 + 0.25 * sin(p.y * 6.0 - u_time * 3.0));
  // A vertical slice cuts the tube at the helix angle; cos of that angle restores its true width.
  float run = TAU * 0.4;
  float slope = run / sqrt(run * run + pitch * pitch);
  float tube = length(vec2(length(p.xz) - 0.4, fold * slope)) - rad;
  // Round off the ends.
  return max(tube, abs(p.y) - halfH);
}
${GLOW_SURFACE}`,

  // breathe in glass: droplets drift apart and merge back into one.
  drift: `
float map(vec3 p) {
  p = rotY(u_time * 0.4) * rotX(0.4) * p;
  float e = 0.5 + 0.5 * sin(u_time * 1.5);
  float d = length(p) - 0.5;
  // 6 droplets at the default count, from 2 up to 14.
  int drops = int(clamp(floor(6.0 * u_detail + 0.5), 2.0, 14.0));
  float size = 0.3 / pow(u_detail, 0.35);
  for (int i = 0; i < 14; i++) {
    if (i >= drops) break;
    float f = float(i);
    vec3 dir = normalize(vec3(sin(f * 2.4), cos(f * 1.7) * 0.8, sin(f * 3.1 + 1.0)));
    float spread = 0.25 + 0.5 * e * (0.7 + 0.3 * sin(f * 1.3 + u_time));
    d = smin(d, length(p - dir * spread) - size, 0.25);
  }
  return d;
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, rotY(u_time * 0.4) * n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,

  // Small moons on tilted orbits around a core; they cling to it as they pass close.
  moons: `
float map(vec3 p) {
  p = rotX(0.35) * p;
  float d = length(p) - 0.36;
  int n = countOf(3.0, 1.0, 9.0);
  for (int i = 0; i < 9; i++) {
    if (i >= n) break;
    float f = float(i);
    float ang = u_time * (1.2 + 0.25 * f) + TAU * f / float(n);
    vec3 c = rotZ(0.9 * sin(f * 2.3)) * rotX(f * 1.1) * vec3(cos(ang), 0.0, sin(ang)) * 0.66;
    d = smin(d, length(p - c) - 0.13, 0.2);
  }
  return d;
}
${GLOW_SURFACE}`,

  // Thin plates stacked like a deck, each swinging round in turn.
  stack: `
float map(vec3 p) {
  p = rotX(0.55) * rotY(u_time * 0.3) * p;
  int n = countOf(4.0, 2.0, 9.0);
  float gap = 0.62 / float(n);
  float d = 1e3;
  for (int i = 0; i < 9; i++) {
    if (i >= n) break;
    float f = float(i);
    vec3 q = p - vec3(0.0, (f - float(n - 1) * 0.5) * gap, 0.0);
    q = rotY(0.9 * sin(u_time * 1.6 - f * 0.55)) * q;
    d = min(d, sdRoundBox(q, vec3(0.44, gap * 0.18, 0.44), 0.06));
  }
  return d;
}
${GLOW_SURFACE}`,

  // Petals around a small core, opening and closing.
  bloom: `
float map(vec3 p) {
  // Lift so the flower's middle (not its stem end) sits at the centre.
  p = rotX(0.7) * rotY(u_time * 0.4) * (p + vec3(0.0, 0.18, 0.0));
  int n = countOf(6.0, 3.0, 14.0);
  float open = 0.2 + 0.9 * (0.5 + 0.5 * sin(u_time * 1.4));
  // Narrower petals when there are many, so they still read as separate.
  float width = 0.24 * min(1.0, 7.0 / float(n));
  float d = length(p) - 0.17;
  for (int i = 0; i < 14; i++) {
    if (i >= n) break;
    vec3 q = rotY(-TAU * float(i) / float(n)) * p;
    q = rotZ(-open) * q;
    vec3 r = vec3(0.46, 0.08, width);
    // Ellipsoid distance (a closer bound than scaling a sphere).
    vec3 e = q - vec3(0.44, 0.0, 0.0);
    float k0 = length(e / r);
    float k1 = length(e / (r * r));
    d = smin(d, k0 * (k0 - 1.0) / k1, 0.06);
  }
  return d;
}
${GLOW_SURFACE}`,

  // Nested rings, each spinning about its own axis.
  gyro: `
float map(vec3 p) {
  int n = countOf(3.0, 1.0, 7.0);
  float d = length(p) - 0.12;
  for (int i = 0; i < 7; i++) {
    if (i >= n) break;
    float f = float(i);
    float R = 0.86 - f * 0.6 / float(n);
    vec3 q = rotX(u_time * (0.9 + 0.35 * f) + f) * rotZ(u_time * (0.6 + 0.2 * f) + f * 2.0) * p;
    d = min(d, length(vec2(length(q.xz) - R, q.y)) - 0.045);
  }
  return d;
}
${GLOW_SURFACE}`,

  // A tilted glass disc with rings rippling out from the centre.
  ripple: `
float map(vec3 p) {
  p = rotX(1.0) * rotY(u_time * 0.25) * p;
  float r = length(p.xz);
  float freq = 22.0 * u_detail;
  float h = 0.05 * sin(r * freq - u_time * 4.0) * (1.0 - smoothstep(0.3, 0.9, r)) + 0.06 * exp(-r * r * 30.0);
  return max(r - 0.86, abs(p.y - h) - 0.035) - 0.03;
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, rotY(u_time * 0.25) * n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,

  // A glass ring with swollen beads travelling around it.
  halo: `
float map(vec3 p) {
  p = rotX(1.05) * rotZ(sin(u_time * 0.6) * 0.25) * p;
  float a = atan(p.z, p.x);
  float k = float(countOf(2.0, 1.0, 8.0));
  float bead = pow(0.5 + 0.5 * cos(k * a - u_time * 3.0), 4.0);
  return length(vec2(length(p.xz) - 0.62, p.y)) - (0.12 + 0.1 * bead);
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,

  // A flat glass band with half-twists (one half-twist is a Mobius strip), rolling along itself.
  ribbon: `
float map(vec3 p) {
  p = rotX(0.9) * rotY(u_time * 0.5) * p;
  float a = atan(p.z, p.x);
  float k = float(countOf(1.0, 1.0, 5.0));
  vec2 c = vec2(length(p.xz) - 0.6, p.y);
  float t = a * k * 0.5 + u_time * 1.2;
  c = mat2(cos(t), -sin(t), sin(t), cos(t)) * c;
  return (sdBox2(c, vec2(0.2, 0.028)) - 0.02) * 0.8;
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,

  // A glass jelly that bounces, squashing on landing and stretching as it rises.
  jelly: `
float map(vec3 p) {
  float s = abs(sin(u_time * 2.2));
  float squash = pow(1.0 - s, 4.0);
  vec3 scale = vec3(1.0 + 0.16 * squash, 1.0 - 0.26 * squash + 0.08 * s, 1.0 + 0.16 * squash);
  vec3 q = p - vec3(0.0, s * 0.28 - 0.14 - 0.12 * squash, 0.0);
  q = rotY(u_time * 0.6) * q / scale;
  float f = 5.0 * pow(u_detail, 0.8);
  float wob = 0.03 * sin(f * q.x + u_time * 3.0) * sin(f * q.y + u_time * 2.3) * sin(f * q.z + u_time * 2.7);
  return (sdRoundBox(q, vec3(0.3), 0.2) + wob) * min(scale.x, scale.y);
}
vec4 shade(vec3 p, vec3 n, vec3 rd) { return glassShade(n, rd, rotY(u_time * 0.6) * n); }
vec4 miss(vec3 rd, float closest) { return vec4(0.0); }
${NO_OVERLAY}`,
};

class SharedGL {
  readonly canvas = document.createElement("canvas");
  private gl: WebGLRenderingContext;
  private programs = new Map<ShaderVariant, { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }>();

  constructor() {
    const gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) throw new Error("soom-3d-loader: WebGL is not available");
    this.gl = gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  draw(variant: ShaderVariant, t: number, px: number, c1: RGB, c2: RGB, detail: number): HTMLCanvasElement {
    const gl = this.gl;
    if (this.canvas.width < px || this.canvas.height < px) {
      this.canvas.width = Math.max(this.canvas.width, px);
      this.canvas.height = Math.max(this.canvas.height, px);
    }
    const { program, uniforms } = this.program(variant);
    gl.useProgram(program);
    gl.viewport(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.u_time, t);
    gl.uniform3fv(uniforms.u_c1, c1);
    gl.uniform3fv(uniforms.u_c2, c2);
    gl.uniform1f(uniforms.u_detail, detail);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  private program(variant: ShaderVariant) {
    const cached = this.programs.get(variant);
    if (cached) return cached;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`soom-3d-loader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, COMMON + SOURCES[variant]));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`soom-3d-loader: ${gl.getProgramInfoLog(program)}`);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["u_time", "u_c1", "u_c2", "u_detail"].map((u) => [u, gl.getUniformLocation(program, u)]));
    const entry = { program, uniforms };
    this.programs.set(variant, entry);
    return entry;
  }
}

let shared: SharedGL | undefined;

function parseColor(ctx: CanvasRenderingContext2D, color: string): RGB {
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  const s = String(ctx.fillStyle);
  if (s.startsWith("#")) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as RGB;
  const m = s.match(/[\d.]+/g) ?? ["0", "0", "0"];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

/**
 * Draws a shader variant onto `ctx` (a 2D context whose canvas is `px` device pixels square).
 * Without `color` the variant's own palette is used; with it, the loader is tinted.
 * `detail` is the loader's count relative to the default count (1 = default): higher
 * values add waves, twists, droplets or ripples depending on the variant.
 */
export function drawShaderFrame(ctx: CanvasRenderingContext2D, variant: ShaderVariant, t: number, px: number, color?: string, detail = 1): void {
  shared ??= new SharedGL();
  let [c1, c2] = PALETTES[variant];
  if (color) {
    c1 = parseColor(ctx, color);
    c2 = c1.map((c) => c + (1 - c) * 0.45) as RGB;
  }
  const source = shared.draw(variant, t, px, c1, c2, Math.min(4, Math.max(0.2, detail)));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, px, px);
  // WebGL's origin is bottom-left; the viewport sits at the bottom of the shared canvas.
  ctx.drawImage(source, 0, source.height - px, px, px, 0, 0, px, px);
  ctx.restore();
}
