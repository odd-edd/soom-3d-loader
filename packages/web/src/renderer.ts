import { computeFrame, STRIDE } from "./core.js";
import { DEFAULTS, VARIANTS, type Variant } from "./presets.js";
import { drawShaderFrame, isShaderVariant, type ShaderVariant } from "./shader.js";

export interface LoaderOptions {
  variant?: Variant | ShaderVariant;
  size?: number;
  /** Dot variants default to #000000; shader variants default to their own palette. */
  color?: string;
  count?: number;
  speed?: number;
}

const REDUCED_MOTION_T = 0.6;

/** Draws one frame onto a 2D context sized `size` css px (already DPR-scaled). */
export function drawFrame(ctx: CanvasRenderingContext2D, frame: Float64Array, size: number, color: string): void {
  const half = size / 2;
  const base = size * 0.022 * DEFAULTS.dotScale;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  for (let j = 0; j < frame.length; j += STRIDE) {
    const depth = frame[j + 2];
    const fade = frame[j + 3];
    ctx.globalAlpha = (DEFAULTS.minAlpha + (1 - DEFAULTS.minAlpha) * depth) * fade;
    ctx.beginPath();
    ctx.arc(half + frame[j] * half, half + frame[j + 1] * half, base * (0.45 + 0.75 * depth) * (0.5 + 0.5 * fade), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Framework-agnostic controller around a canvas. The custom element uses it,
 * and React/Vue wrappers can too.
 */
export class Loader {
  private ctx: CanvasRenderingContext2D;
  private opts: Required<Omit<LoaderOptions, "color">> & Pick<LoaderOptions, "color">;
  private raf = 0;
  private elapsed = 0;
  private last = 0;
  private visible = true;
  private frame?: Float64Array;
  private io?: IntersectionObserver;
  private motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;

  constructor(private canvas: HTMLCanvasElement, options: LoaderOptions = {}, private resolveColor?: () => string) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("soom: 2D canvas is not available");
    this.ctx = ctx;
    this.opts = { variant: "orbit", size: 48, count: DEFAULTS.count, speed: DEFAULTS.speed, ...options };
    this.resize();
    if (typeof IntersectionObserver === "function") {
      this.io = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.visible ? this.start() : this.stop();
      });
      this.io.observe(canvas);
    }
    this.motion?.addEventListener("change", this.onMotionChange);
    this.start();
  }

  update(options: LoaderOptions): void {
    const sizeChanged = options.size !== undefined && options.size !== this.opts.size;
    Object.assign(this.opts, options);
    if (!(this.opts.variant in VARIANTS) && !isShaderVariant(this.opts.variant)) this.opts.variant = "orbit";
    if (sizeChanged) this.resize();
    if (this.reducedMotion) this.renderStill();
  }

  destroy(): void {
    this.stop();
    this.io?.disconnect();
    this.motion?.removeEventListener("change", this.onMotionChange);
  }

  private get reducedMotion(): boolean {
    return !!this.motion?.matches;
  }

  private onMotionChange = () => {
    this.stop();
    this.start();
  };

  private resize(): void {
    const dpr = Math.min(2, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
    const { size } = this.opts;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private start(): void {
    if (this.raf || !this.visible) return;
    if (this.reducedMotion) return this.renderStill();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    this.elapsed += ((now - this.last) / 1000) * this.opts.speed;
    this.last = now;
    this.render(this.elapsed);
    this.raf = requestAnimationFrame(this.tick);
  };

  private renderStill(): void {
    this.render(REDUCED_MOTION_T);
  }

  private render(t: number): void {
    const { variant, count, size } = this.opts;
    const color = this.opts.color === "currentColor" && this.resolveColor ? this.resolveColor() : this.opts.color;
    let dotVariant: Variant = "orbit";
    if (isShaderVariant(variant)) {
      if (!shaderUnavailable) {
        try {
          drawShaderFrame(this.ctx, variant, t, this.canvas.width, color, count / DEFAULTS.count);
          return;
        } catch (error) {
          // No WebGL (or a driver that rejects the shader): fall back to dots for good.
          shaderUnavailable = true;
          console.warn("soom: WebGL is unavailable, showing the orbit dots instead.", error);
        }
      }
    } else {
      dotVariant = variant;
    }
    this.frame = computeFrame(dotVariant, count, t, this.frame);
    drawFrame(this.ctx, this.frame, size, color ?? "#000000");
  }
}

let shaderUnavailable = false;
