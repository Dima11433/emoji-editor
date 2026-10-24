import { hexToHsl, hslToHex, mapColors } from './colors';
import { collectTransitiveAssets } from './layers';
import { fixed, hexToRgb, layerTransform, rgbToHex, type Asset, type Layer, type LottieDoc, type ShapeItem } from './lottie';

/**
 * Effects are stored on the document (doc.fx) and applied on top of it when
 * previewing and exporting, so they can be switched off at any time.
 * Telegram ignores Lottie layer effects, masks and blend modes, so every
 * effect here rewrites shapes and colors instead.
 */

export type PixelGrid = 24 | 32 | 48;

export interface Effects {
  pixel: { on: boolean; grid: PixelGrid };
  metal: { on: boolean; target: number | null };
  glitch: { on: boolean; target: number | null; strength: number };
  hologram: { on: boolean; target: number | null };
}

export const DEFAULT_EFFECTS: Effects = {
  pixel: { on: false, grid: 32 },
  metal: { on: false, target: null },
  glitch: { on: false, target: null, strength: 12 },
  hologram: { on: false, target: null },
};

export function getEffects(doc: LottieDoc): Effects {
  const fx = (doc.fx ?? {}) as Partial<Effects>;
  return {
    pixel: { ...DEFAULT_EFFECTS.pixel, ...fx.pixel },
    metal: { ...DEFAULT_EFFECTS.metal, ...fx.metal },
    glitch: { ...DEFAULT_EFFECTS.glitch, ...fx.glitch },
    hologram: { ...DEFAULT_EFFECTS.hologram, ...fx.hologram },
  };
}

export const hasEffects = (fx: Effects) => fx.pixel.on || fx.metal.on || fx.glitch.on || fx.hologram.on;

/**
 * Applies metal, hologram and glitch. Pixelation needs a browser canvas and
 * runs afterwards (see pixelate.ts). The result has no fx field.
 */
export function applyShapeEffects(doc: LottieDoc): LottieDoc {
  const fx = getEffects(doc);
  const out = structuredClone(doc);
  delete out.fx;
  if (fx.metal.on) metal(out, fx.metal.target);
  if (fx.hologram.on) hologram(out, fx.hologram.target);
  if (fx.glitch.on) glitch(out, fx.glitch.target, fx.glitch.strength);
  return out;
}

/** A layer plus every layer parented to it (directly or not), in document order. */
export function layerFamily(layers: Layer[], target: number | null): Layer[] {
  if (target === null) return [...layers];
  const inFamily = new Set<number>([target]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of layers) {
      if (l.ind !== undefined && l.parent !== undefined && inFamily.has(l.parent) && !inFamily.has(l.ind)) {
        inFamily.add(l.ind);
        grew = true;
      }
    }
  }
  return layers.filter((l) => l.ind !== undefined && inFamily.has(l.ind));
}

/** Layers and all transitive precomp assets they use, so effects reach nested animations too. */
function familyNodes(doc: LottieDoc, target: number | null): unknown[] {
  const family = layerFamily(doc.layers, target);
  const seen = new Set<string>();
  const assets: Asset[] = [];
  for (const l of family) {
    for (const a of collectTransitiveAssets(doc, l.refId)) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        assets.push(a);
      }
    }
  }
  return [...family, ...assets];
}

// ---------- Metal ----------

function metal(doc: LottieDoc, target: number | null) {
  for (const node of familyNodes(doc, target)) {
    const n = node as Layer & Asset;
    if (Array.isArray(n.shapes)) metalList(n.shapes);
    if (Array.isArray(n.layers)) for (const l of n.layers) if (l.shapes) metalList(l.shapes);
  }
}

/** Replaces flat fills in a shape list with a moving metallic gradient. */
function metalList(items: ShapeItem[]) {
  const box = bounds(items);
  items.forEach((item, idx) => {
    if (item.ty === 'gr' && item.it) metalList(item.it);
    if (item.ty === 'fl') items[idx] = metalFill(item, box);
  });
}

function metalFill(fl: ShapeItem, box: Box): ShapeItem {
  const rgb = firstColor(fl.c);
  const [h, s, l] = hexToHsl(rgbToHex(rgb));
  const sat = s * 0.55;
  const shade = (light: number) => hexToRgb(hslToHex(h, sat, Math.max(0, Math.min(1, light)))).slice(0, 3);
  const light = shade(l + 0.28);
  const base = shade(l);
  const dark = shade(l * 0.5);
  const shine = shade(0.97);

  // Five stops: light edge, base, moving highlight, base, dark edge.
  const stops = (hl: number, glow: number[]) => [
    0, ...light,
    hl - 0.12, ...base,
    hl, ...glow,
    hl + 0.12, ...base,
    1, ...dark,
  ].map((x) => Math.round(x * 1000) / 1000);
  const pass = (t: number): [number, number[]][] => [
    [t, stops(0.15, base)],
    [t + 10, stops(0.22, shine)],
    [t + 50, stops(0.78, shine)],
    [t + 60, stops(0.85, base)],
  ];
  const keys = [...pass(0), ...pass(90), [180, stops(0.15, base)] as [number, number[]]];

  return {
    ty: 'gf',
    nm: 'Металл',
    o: fl.o ?? fixed(100),
    r: fl.r ?? 1,
    t: 1,
    s: fixed([box.x0, box.y0]),
    e: fixed([box.x1, box.y1]),
    g: { p: 5, k: { a: 1, k: keys.map(([t, s], i) => (i === keys.length - 1 ? { t, s } : { t, s, o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } })) } },
  };
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Rough bounds of the shapes in a list (first keyframe, group transforms ignored). */
function bounds(items: ShapeItem[]): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  const visit = (list: ShapeItem[]) => {
    for (const it of list) {
      const k = (p: unknown) => staticValue(p);
      if (it.ty === 'sh') {
        const path = k(it.ks) as unknown as { v?: number[][] } | undefined;
        path?.v?.forEach(([x, y]) => add(x, y));
      } else if (it.ty === 'el' || it.ty === 'rc') {
        const p = k(it.p) as number[] | undefined;
        const s = k(it.s) as number[] | undefined;
        if (p && s) {
          add(p[0] - s[0] / 2, p[1] - s[1] / 2);
          add(p[0] + s[0] / 2, p[1] + s[1] / 2);
        }
      } else if (it.ty === 'sr') {
        const p = k(it.p) as number[] | undefined;
        const r = k(it.or) as number | number[] | undefined;
        const rad = Array.isArray(r) ? r[0] : r;
        if (p && typeof rad === 'number') {
          add(p[0] - rad, p[1] - rad);
          add(p[0] + rad, p[1] + rad);
        }
      } else if (it.ty === 'gr' && it.it) {
        visit(it.it);
      }
    }
  };
  visit(items);
  if (!xs.length) return { x0: -150, y0: -150, x1: 150, y1: 150 };
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Value of a property at its first keyframe. */
function staticValue(prop: unknown): unknown {
  if (!prop || typeof prop !== 'object') return undefined;
  const p = prop as { a?: number; k?: unknown };
  if (p.a === 1 && Array.isArray(p.k)) {
    const first = p.k[0] as { s?: unknown };
    const s = first?.s;
    return Array.isArray(s) && s.length === 1 && typeof s[0] === 'object' ? s[0] : s;
  }
  return p.k;
}

function firstColor(prop: unknown): number[] {
  const v = staticValue(prop);
  return Array.isArray(v) && typeof v[0] === 'number' ? (v as number[]) : [0.6, 0.6, 0.6];
}

// ---------- Hologram ----------

const HOLO_STEPS = 6;

function hologram(doc: LottieDoc, target: number | null) {
  for (const node of familyNodes(doc, target)) holoNode(node);
}

/** Turns colors into pastel rainbow that cycles once per loop. Dark outlines stay as they are. */
function holoNode(node: unknown) {
  if (Array.isArray(node)) return node.forEach(holoNode);
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.ty === 'fl' || obj.ty === 'st') {
    obj.c = holoProp(firstColor(obj.c), [0]);
  } else if (obj.ty === 'gf' || obj.ty === 'gs') {
    const g = obj.g as { p: number; k: { a?: number; k: unknown } };
    holoGradient(g);
  }
  for (const [key, value] of Object.entries(obj)) if (key !== 'c' && key !== 'g') holoNode(value);
}

function holoColor(rgb: number[], shift: number): number[] {
  const [h, s, l] = hexToHsl(rgbToHex(rgb));
  if (l < 0.25) return rgb.slice(0, 3);
  // Light and mid tones get different hues and keep some contrast, so text stays readable.
  const hue = (h + shift + l * 150) % 360;
  const pastel = hexToRgb(hslToHex(hue, Math.max(s, 0.75), 0.52 + (l - 0.25) * 0.45));
  return pastel.slice(0, 3);
}

/** Animated value where the colors at the given offsets cycle through the rainbow. */
function holoProp(value: number[], offsets: number[]) {
  const keys = [];
  for (let step = 0; step <= HOLO_STEPS; step++) {
    const s = [...value];
    // Neighbouring parts start at different hues, which reads as a foil shimmer.
    offsets.forEach((off, n) => {
      const rgb = holoColor(value.slice(off, off + 3), step * (360 / HOLO_STEPS) + n * 50);
      s.splice(off, 3, ...rgb.map((x) => Math.round(x * 1000) / 1000));
    });
    const t = Math.round((step * 180) / HOLO_STEPS);
    keys.push(step === HOLO_STEPS ? { t, s } : { t, s, o: { x: [0.5], y: [0.5] }, i: { x: [0.5], y: [0.5] } });
  }
  return { a: 1, k: keys };
}

function holoGradient(g: { p: number; k: { a?: number; k: unknown } }) {
  if (g.k.a === 1 && Array.isArray(g.k.k)) {
    // Already animated (metal): shift each keyframe's colors by its time.
    for (const key of g.k.k as { t: number; s: number[] }[]) {
      for (let n = 0; n < g.p; n++) {
        const off = n * 4 + 1;
        key.s.splice(off, 3, ...holoColor(key.s.slice(off, off + 3), (key.t / 180) * 360 + n * 50));
      }
    }
    return;
  }
  const value = g.k.k as number[];
  g.k = holoProp(value, Array.from({ length: g.p }, (_, n) => n * 4 + 1));
}

// ---------- Glitch ----------

const BURSTS: [number, number][] = [
  [18, 30],
  [88, 96],
  [134, 150],
];

/** Small seeded random so the same sticker always glitches the same way. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hold = (keys: [number, number[]][]) => ({ a: 1, k: keys.map(([t, s]) => ({ t, s, h: 1 })) });

function jitterKeys(rand: () => number, dirX: number, strength: number): [number, number[]][] {
  const keys: [number, number[]][] = [[0, [0, 0, 0]]];
  for (const [a, b] of BURSTS) {
    for (let t = a; t < b; t += 2) {
      const dx = dirX * strength * (0.5 + rand());
      const dy = (rand() - 0.5) * strength * 0.5;
      keys.push([t, [Math.round(dx), Math.round(dy), 0]]);
    }
    keys.push([b, [0, 0, 0]]);
  }
  return keys;
}

function glitch(doc: LottieDoc, target: number | null, strength: number) {
  const family = layerFamily(doc.layers, target).filter((l) => !l.hd);
  if (!family.length) return;
  let nextInd = Math.max(0, ...doc.layers.map((l) => l.ind ?? 0)) + 1;
  const rand = random(1337);
  const lastIdx = Math.max(...family.map((l) => doc.layers.indexOf(l)));
  const nulls: Layer[] = [];
  const copies: Layer[] = [];

  /** A null layer that moves its children by jittering offsets. */
  const jitterNull = (name: string, parent: number | undefined, keys: [number, number[]][]): number => {
    const ind = nextInd++;
    const nl: Layer = {
      ddd: 0, ind, ty: 3, nm: name, sr: 1, ao: 0, ip: doc.ip, op: doc.op, st: 0, bm: 0,
      ks: layerTransform({ p: hold(keys), a: fixed([0, 0, 0]) }),
    };
    if (parent !== undefined) nl.parent = parent;
    nulls.push(nl);
    return ind;
  };

  const familyInds = new Set(family.map((l) => l.ind));
  const isRoot = (l: Layer) => l.parent === undefined || !familyInds.has(l.parent);

  const memo = new Map<string, string>();
  // Two tinted copies that jump sideways during short bursts.
  for (const [tint, dir, label] of [
    ['#ff2a6d', -1, 'красный'],
    ['#00e5ff', 1, 'голубой'],
  ] as const) {
    const keys = jitterKeys(rand, dir, strength);
    const nullFor = new Map<number | undefined, number>();
    const indMap = new Map<number, number>();
    for (const l of family) indMap.set(l.ind!, nextInd++);
    for (const l of family) {
      const copy = structuredClone(l);
      copy.nm = `${l.nm ?? 'Слой'} (глитч, ${label})`;
      copy.ind = indMap.get(l.ind!)!;
      if (isRoot(l)) {
        if (!nullFor.has(l.parent)) nullFor.set(l.parent, jitterNull(`Глитч ${label}`, l.parent, keys));
        copy.parent = nullFor.get(l.parent);
      } else {
        copy.parent = indMap.get(l.parent!);
      }
      copy.ks = { ...copy.ks, o: hold([[0, [0]], ...BURSTS.flatMap(([a, b]): [number, number[]][] => [[a, [80]], [b, [0]]])]) };
      if (copy.ty === 0 && copy.refId) copy.refId = tintedAsset(doc, copy.refId, tint, memo);
      mapColors(copy, () => tint);
      copies.push(copy);
    }
  }

  // The original shakes a little too.
  const mainKeys = jitterKeys(rand, 1, strength * 0.35).map(([t, [x, y]]): [number, number[]] => [t, [x * (rand() < 0.5 ? -1 : 1), y, 0]]);
  const mainNull = new Map<number | undefined, number>();
  for (const l of family) {
    if (!isRoot(l)) continue;
    if (!mainNull.has(l.parent)) mainNull.set(l.parent, jitterNull('Глитч тряска', l.parent, mainKeys));
    l.parent = mainNull.get(l.parent);
  }

  doc.layers.splice(lastIdx + 1, 0, ...copies);
  doc.layers.push(...nulls);
}

function tintedAsset(doc: LottieDoc, refId: string, tint: string, memo: Map<string, string>): string {
  const key = `${refId}:${tint}`;
  const existing = memo.get(key);
  if (existing) return existing;
  const asset = doc.assets?.find((a) => a.id === refId);
  if (!asset) return refId;
  const copy = structuredClone(asset);
  copy.id = `${refId}_glitch_${tint.slice(1)}`;
  memo.set(key, copy.id);
  for (const l of copy.layers ?? []) {
    if (l.ty === 0 && l.refId) l.refId = tintedAsset(doc, l.refId, tint, memo);
  }
  mapColors(copy, () => tint);
  if (!doc.assets) doc.assets = [];
  doc.assets.push(copy);
  return copy.id;
}
