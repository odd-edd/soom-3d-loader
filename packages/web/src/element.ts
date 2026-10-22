import { Loader } from "./renderer.js";
import type { Variant } from "./presets.js";
import type { ShaderVariant } from "./shader.js";

const ATTRS = ["variant", "size", "color", "count", "speed", "label"] as const;
const COLOR_REFRESH_MS = 500;
// Lets this module be imported during SSR, where HTMLElement does not exist.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * `<soom-3d-loader variant="orbit" size="48" color="#000000"></soom-3d-loader>`
 */
export class Soom3DLoaderElement extends Base {
  static observedAttributes = [...ATTRS];
  private loader?: Loader;
  private canvas = document.createElement("canvas");
  private cachedColor = "";
  private colorStamp = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:inline-block;line-height:0;vertical-align:middle}canvas{display:block}";
    this.canvas.setAttribute("aria-hidden", "true");
    root.append(style, this.canvas);
  }

  connectedCallback(): void {
    if (!this.hasAttribute("role")) this.setAttribute("role", "status");
    this.syncLabel();
    this.loader ??= new Loader(this.canvas, this.readOptions(), () => this.currentColor());
  }

  disconnectedCallback(): void {
    this.loader?.destroy();
    this.loader = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "label") return this.syncLabel();
    this.loader?.update(this.readOptions());
  }

  private syncLabel(): void {
    this.setAttribute("aria-label", this.getAttribute("label") ?? "Loading");
  }

  private readOptions() {
    const num = (n: string) => {
      const v = this.getAttribute(n);
      return v === null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
    };
    const opts: Record<string, unknown> = {
      variant: (this.getAttribute("variant") as Variant | ShaderVariant | null) ?? undefined,
      size: num("size"),
      color: this.getAttribute("color") ?? undefined,
      count: num("count"),
      speed: num("speed"),
    };
    for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
    return opts;
  }

  private currentColor(): string {
    const now = performance.now();
    if (now - this.colorStamp > COLOR_REFRESH_MS) {
      this.cachedColor = getComputedStyle(this).color;
      this.colorStamp = now;
    }
    return this.cachedColor;
  }
}

export function define(tag = "soom-3d-loader"): void {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, class extends Soom3DLoaderElement {});
  }
}
