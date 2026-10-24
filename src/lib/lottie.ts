// Minimal Lottie types and builders. Lottie JSON is loose, so the types only
// describe the fields this editor reads or writes.

export interface LottieDoc {
  v?: string;
  nm?: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  ddd?: number;
  tgs?: number;
  layers: Layer[];
  assets?: Asset[];
  [key: string]: unknown;
}

export interface Asset {
  id: string;
  layers?: Layer[];
  [key: string]: unknown;
}

export interface Layer {
  ty: number;
  nm?: string;
  ind?: number;
  parent?: number;
  hd?: boolean;
  ip: number;
  op: number;
  st?: number;
  ks: Record<string, unknown>;
  shapes?: ShapeItem[];
  refId?: string;
  [key: string]: unknown;
}

export interface ShapeItem {
  ty: string;
  nm?: string;
  hd?: boolean;
  it?: ShapeItem[];
  [key: string]: unknown;
}

export type Vec = [number, number];
type Value = number | number[];

export const CANVAS = 512;
export const FPS = 60;
export const FRAMES = 180; // 3 seconds at 60 fps, the Telegram maximum

/** A static (not animated) property. */
export const fixed = (k: Value) => ({ a: 0, k });

const EASE = { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } };
const LINEAR = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };

/** An animated property from [frame, value] pairs. */
export function anim(keys: [number, Value][], easing: 'ease' | 'linear' = 'ease') {
  const curve = easing === 'ease' ? EASE : LINEAR;
  return {
    a: 1,
    k: keys.map(([t, v], idx) => {
      const s = Array.isArray(v) ? v : [v];
      return idx === keys.length - 1 ? { t, s } : { t, s, ...structuredClone(curve) };
    }),
  };
}

export interface TransformInput {
  p?: unknown;
  a?: unknown;
  s?: unknown;
  r?: unknown;
  o?: unknown;
}

export function layerTransform(t: TransformInput = {}) {
  return {
    o: t.o ?? fixed(100),
    r: t.r ?? fixed(0),
    p: t.p ?? fixed([CANVAS / 2, CANVAS / 2, 0]),
    a: t.a ?? fixed([0, 0, 0]),
    s: t.s ?? fixed([100, 100, 100]),
  };
}

export function groupTransform(t: TransformInput = {}): ShapeItem {
  return {
    ty: 'tr',
    p: t.p ?? fixed([0, 0]),
    a: t.a ?? fixed([0, 0]),
    s: t.s ?? fixed([100, 100]),
    r: t.r ?? fixed(0),
    o: t.o ?? fixed(100),
    sk: fixed(0),
    sa: fixed(0),
  };
}

export function shapeLayer(nm: string, shapes: ShapeItem[], ks: TransformInput = {}): Layer {
  return { ddd: 0, ind: 0, ty: 4, nm, sr: 1, ks: layerTransform(ks), ao: 0, shapes, ip: 0, op: FRAMES, st: 0, bm: 0 };
}

export function group(nm: string, items: ShapeItem[], tr: TransformInput = {}): ShapeItem {
  return { ty: 'gr', nm, it: [...items, groupTransform(tr)] };
}

export function fill(hex: string, opacity = 100): ShapeItem {
  return { ty: 'fl', nm: 'Заливка', c: fixed(hexToRgb(hex)), o: fixed(opacity), r: 1 };
}

export function stroke(hex: string, width: number, opacity = 100): ShapeItem {
  return { ty: 'st', nm: 'Обводка', c: fixed(hexToRgb(hex)), o: fixed(opacity), w: fixed(width), lc: 2, lj: 2 };
}

export function ellipse(cx: number, cy: number, w: number, h = w): ShapeItem {
  return { ty: 'el', nm: 'Эллипс', d: 1, p: fixed([cx, cy]), s: fixed([w, h]) };
}

export function rect(cx: number, cy: number, w: number, h: number, radius = 0): ShapeItem {
  return { ty: 'rc', nm: 'Прямоугольник', d: 1, p: fixed([cx, cy]), s: fixed([w, h]), r: fixed(radius) };
}

/** One cubic segment: [control 1, control 2, end point]. */
export type Segment = [Vec, Vec, Vec];

/**
 * Builds a Lottie path from a start point and cubic segments.
 * A closed path whose last segment ends at the start point is merged so the
 * start vertex is not duplicated.
 */
export function bezierPath(start: Vec, segments: Segment[], closed: boolean): ShapeItem {
  const v: Vec[] = [start];
  const i: Vec[] = [[0, 0]];
  const o: Vec[] = [[0, 0]];
  for (const [c1, c2, end] of segments) {
    const last = v.length - 1;
    o[last] = [c1[0] - v[last][0], c1[1] - v[last][1]];
    v.push(end);
    i.push([c2[0] - end[0], c2[1] - end[1]]);
    o.push([0, 0]);
  }
  const lastIdx = v.length - 1;
  if (closed && lastIdx > 0 && near(v[lastIdx], start)) {
    i[0] = i[lastIdx];
    v.pop();
    i.pop();
    o.pop();
  }
  return { ty: 'sh', nm: 'Контур', ks: fixed({ i, o, v, c: closed } as unknown as number[]) };
}

const near = (a: Vec, b: Vec) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;

export function emptyDoc(nm = 'Новый стикер'): LottieDoc {
  return { v: '5.7.0', nm, fr: FPS, ip: 0, op: FRAMES, w: CANVAS, h: CANVAS, ddd: 0, tgs: 1, assets: [], layers: [] };
}

/** Gives every layer a unique index, keeping parent links valid. */
export function reindexLayers(layers: Layer[]): void {
  // Existing indexes are kept first so parent links never point at a new layer.
  const used = new Set<number>();
  const missing: Layer[] = [];
  for (const layer of layers) {
    if (typeof layer.ind === 'number' && layer.ind > 0 && !used.has(layer.ind)) used.add(layer.ind);
    else missing.push(layer);
  }
  let next = 1;
  for (const layer of missing) {
    while (used.has(next)) next++;
    layer.ind = next;
    used.add(next);
  }
}

export function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1].map((x) => round(x, 4));
}

export function rgbToHex(rgb: number[]): string {
  const scale = rgb.slice(0, 3).some((x) => x > 1) ? 1 : 255;
  return (
    '#' +
    rgb
      .slice(0, 3)
      .map((x) => Math.max(0, Math.min(255, Math.round(x * scale))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};
