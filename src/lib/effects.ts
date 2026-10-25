import { hexToHsl, hslToHex, mapColors } from './colors';
import { collectTransitiveAssets } from './layers';
import {
  anim,
  bezierPath,
  CANVAS,
  ellipse,
  fill,
  fixed,
  FRAMES,
  group,
  hexToRgb,
  layerTransform,
  reindexLayers,
  rgbToHex,
  round,
  shapeLayer,
  stroke,
  type Asset,
  type Layer,
  type LottieDoc,
  type ShapeItem,
  type Vec,
} from './lottie';

/**
 * Effects are stored on the document (doc.fx) and applied on top of it when
 * previewing and exporting, so they can be switched off at any time.
 * Telegram ignores Lottie layer effects, masks and blend modes, so every
 * effect here rewrites shapes and colors instead.
 */

export type PixelGrid = 24 | 32 | 48;
export type ShimmerTint = 'white' | 'gold' | 'neon';
export type ParticleStyle = 'sparks' | 'stars' | 'fire' | 'neon';
export type ParticlePlacement = 'front' | 'back';

export interface Effects {
  pixel: { on: boolean; grid: PixelGrid };
  metal: { on: boolean; target: number | null };
  shimmer: { on: boolean; target: number | null; tint: ShimmerTint };
  particles: { on: boolean; style: ParticleStyle; placement: ParticlePlacement; count: number };
  glitch: { on: boolean; target: number | null; strength: number };
  hologram: { on: boolean; target: number | null };
}

export const DEFAULT_EFFECTS: Effects = {
  pixel: { on: false, grid: 32 },
  metal: { on: false, target: null },
  shimmer: { on: false, target: null, tint: 'white' },
  particles: { on: false, style: 'sparks', placement: 'front', count: 12 },
  glitch: { on: false, target: null, strength: 12 },
  hologram: { on: false, target: null },
};

export function getEffects(doc: LottieDoc): Effects {
  const fx = (doc.fx ?? {}) as Partial<Effects>;
  return {
    pixel: { ...DEFAULT_EFFECTS.pixel, ...fx.pixel },
    metal: { ...DEFAULT_EFFECTS.metal, ...fx.metal },
    shimmer: { ...DEFAULT_EFFECTS.shimmer, ...fx.shimmer },
    particles: { ...DEFAULT_EFFECTS.particles, ...fx.particles },
    glitch: { ...DEFAULT_EFFECTS.glitch, ...fx.glitch },
    hologram: { ...DEFAULT_EFFECTS.hologram, ...fx.hologram },
  };
}

export const hasEffects = (fx: Effects) =>
  fx.pixel.on ||
  fx.metal.on ||
  fx.shimmer.on ||
  fx.particles.on ||
  fx.glitch.on ||
  fx.hologram.on;

/**
 * Applies vector effects (metal, hologram, shimmer, glitch, particles).
 * Pixelation needs a browser canvas and runs afterwards (see pixelate.ts).
 * The result has no fx field.
 */
export function applyShapeEffects(doc: LottieDoc): LottieDoc {
  const fx = getEffects(doc);
  const out = structuredClone(doc);
  delete out.fx;
  if (fx.metal.on) metal(out, fx.metal.target);
  if (fx.hologram.on) hologram(out, fx.hologram.target);
  if (fx.shimmer.on) shimmer(out, fx.shimmer.target, fx.shimmer.tint);
  if (fx.glitch.on) glitch(out, fx.glitch.target, fx.glitch.strength);
  if (fx.particles.on) {
    particles(out, fx.particles.style, fx.particles.placement, fx.particles.count);
  }
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
function familyNodes(doc: LottieDoc, target: number | null): { layers: Layer[]; assets: Asset[] } {
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
  return { layers: family, assets };
}

// ---------- Metal ----------

function metal(doc: LottieDoc, target: number | null) {
  const { layers, assets } = familyNodes(doc, target);
  const rootIp = doc.ip ?? 0;
  const rootOp = doc.op ?? FRAMES;
  for (const l of layers) {
    if (Array.isArray(l.shapes)) metalList(l.shapes, rootIp, rootOp);
  }
  for (const a of assets) {
    for (const l of a.layers ?? []) {
      const aIp = typeof l.ip === 'number' ? Math.min(0, l.ip) : 0;
      const aOp = typeof l.op === 'number' && l.op > aIp ? l.op : rootOp - rootIp;
      if (Array.isArray(l.shapes)) metalList(l.shapes, aIp, aOp);
    }
  }
}

/** Replaces flat fills in a shape list with a moving metallic gradient. */
function metalList(items: ShapeItem[], ip: number, op: number) {
  const box = bounds(items);
  items.forEach((item, idx) => {
    if (item.ty === 'gr' && item.it) metalList(item.it, ip, op);
    if (item.ty === 'fl') items[idx] = metalFill(item, box, ip, op);
  });
}

function metalFill(fl: ShapeItem, box: Box, ip: number, op: number): ShapeItem {
  const rgb = firstColor(fl.c);
  const [h, s, l] = hexToHsl(rgbToHex(rgb));
  const sat = s * 0.55;
  const shade = (light: number) => hexToRgb(hslToHex(h, sat, Math.max(0, Math.min(1, light)))).slice(0, 3);
  const light = shade(l + 0.28);
  const base = shade(l);
  const dark = shade(l * 0.5);
  const shine = shade(0.97);

  const dur = Math.max(24, op - ip);
  const at = (frac: number) => Math.round(ip + dur * frac);

  const stops = (hl: number, glow: number[]) =>
    [0, ...light, hl - 0.12, ...base, hl, ...glow, hl + 0.12, ...base, 1, ...dark].map(
      (x) => Math.round(x * 1000) / 1000,
    );
  const pass = (f0: number): [number, number[]][] => [
    [at(f0), stops(0.15, base)],
    [at(f0 + 10 / 180), stops(0.22, shine)],
    [at(f0 + 50 / 180), stops(0.78, shine)],
    [at(f0 + 60 / 180), stops(0.85, base)],
  ];
  const keys = [...pass(0), ...pass(0.5), [op, stops(0.15, base)] as [number, number[]]];

  return {
    ty: 'gf',
    nm: 'Металл',
    o: fl.o ?? fixed(100),
    r: fl.r ?? 1,
    t: 1,
    s: fixed([box.x0, box.y0]),
    e: fixed([box.x1, box.y1]),
    g: {
      p: 5,
      k: {
        a: 1,
        k: keys.map(([t, stp], i) =>
          i === keys.length - 1 ? { t, s: stp } : { t, s: stp, o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } },
        ),
      },
    },
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
  const { layers, assets } = familyNodes(doc, target);
  const rootIp = doc.ip ?? 0;
  const rootOp = doc.op ?? FRAMES;
  for (const l of layers) holoNode(l, rootIp, rootOp);
  for (const a of assets) {
    const aDur = Math.max(24, rootOp - rootIp);
    holoNode(a, 0, aDur);
  }
}

/** Turns colors into pastel rainbow that cycles once per loop. Dark outlines stay as they are. */
function holoNode(node: unknown, ip: number, op: number) {
  if (Array.isArray(node)) {
    node.forEach((n) => holoNode(n, ip, op));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.ty === 'fl' || obj.ty === 'st') {
    obj.c = holoProp(firstColor(obj.c), [0], ip, op);
  } else if (obj.ty === 'gf' || obj.ty === 'gs') {
    const g = obj.g as { p: number; k: { a?: number; k: unknown } };
    holoGradient(g, ip, op);
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key !== 'c' && key !== 'g') holoNode(value, ip, op);
  }
}

function holoColor(rgb: number[], shift: number): number[] {
  const [h, s, l] = hexToHsl(rgbToHex(rgb));
  if (l < 0.25) return rgb.slice(0, 3);
  const hue = (h + shift + l * 150) % 360;
  const pastel = hexToRgb(hslToHex(hue, Math.max(s, 0.75), 0.52 + (l - 0.25) * 0.45));
  return pastel.slice(0, 3);
}

function holoProp(value: number[], offsets: number[], ip: number, op: number) {
  const dur = Math.max(12, op - ip);
  const keys = [];
  for (let step = 0; step <= HOLO_STEPS; step++) {
    const s = [...value];
    offsets.forEach((off, n) => {
      const rgb = holoColor(value.slice(off, off + 3), step * (360 / HOLO_STEPS) + n * 50);
      s.splice(off, 3, ...rgb.map((x) => Math.round(x * 1000) / 1000));
    });
    const t = Math.round(ip + (step * dur) / HOLO_STEPS);
    keys.push(
      step === HOLO_STEPS
        ? { t, s }
        : { t, s, o: { x: [0.5], y: [0.5] }, i: { x: [0.5], y: [0.5] } },
    );
  }
  return { a: 1, k: keys };
}

function holoGradient(g: { p: number; k: { a?: number; k: unknown } }, ip: number, op: number) {
  const dur = Math.max(12, op - ip);
  if (g.k.a === 1 && Array.isArray(g.k.k)) {
    for (const key of g.k.k as { t: number; s: number[] }[]) {
      const phase = ((key.t - ip) / dur) * 360;
      for (let n = 0; n < g.p; n++) {
        const off = n * 4 + 1;
        key.s.splice(off, 3, ...holoColor(key.s.slice(off, off + 3), phase + n * 50));
      }
    }
    return;
  }
  const value = g.k.k as number[];
  g.k = holoProp(value, Array.from({ length: g.p }, (_, n) => n * 4 + 1), ip, op);
}

// ---------- Glitch ----------

const BURST_FRACS: [number, number][] = [
  [18 / 180, 30 / 180],
  [88 / 180, 96 / 180],
  [134 / 180, 150 / 180],
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

function computeBursts(ip: number, op: number): [number, number][] {
  const dur = Math.max(24, op - ip);
  return BURST_FRACS.map(([fa, fb]) => [
    Math.round(ip + dur * fa),
    Math.max(Math.round(ip + dur * fa) + 2, Math.round(ip + dur * fb)),
  ]);
}

function jitterKeys(
  rand: () => number,
  dirX: number,
  strength: number,
  ip: number,
  bursts: [number, number][],
): [number, number[]][] {
  const keys: [number, number[]][] = [[ip, [0, 0, 0]]];
  for (const [a, b] of bursts) {
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
  const ip = doc.ip ?? 0;
  const op = doc.op ?? FRAMES;
  const bursts = computeBursts(ip, op);

  let nextInd = Math.max(0, ...doc.layers.map((l) => l.ind ?? 0)) + 1;
  const rand = random(1337);
  const lastIdx = Math.max(...family.map((l) => doc.layers.indexOf(l)));
  const nulls: Layer[] = [];
  const copies: Layer[] = [];

  const jitterNull = (name: string, parent: number | undefined, keys: [number, number[]][]): number => {
    const ind = nextInd++;
    const nl: Layer = {
      ddd: 0,
      ind,
      ty: 3,
      nm: name,
      sr: 1,
      ao: 0,
      ip,
      op,
      st: 0,
      bm: 0,
      ks: layerTransform({ p: hold(keys), a: fixed([0, 0, 0]) }),
    };
    if (parent !== undefined) nl.parent = parent;
    nulls.push(nl);
    return ind;
  };

  const familyInds = new Set(family.map((l) => l.ind));
  const isRoot = (l: Layer) => l.parent === undefined || !familyInds.has(l.parent);

  const memo = new Map<string, string>();
  for (const [tint, dir, label] of [
    ['#ff2a6d', -1, 'красный'],
    ['#00e5ff', 1, 'голубой'],
  ] as const) {
    const keys = jitterKeys(rand, dir, strength, ip, bursts);
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
      copy.ks = {
        ...copy.ks,
        o: hold([
          [ip, [0]],
          ...bursts.flatMap(([a, b]): [number, number[]][] => [
            [a, [80]],
            [b, [0]],
          ]),
        ]),
      };
      if (copy.ty === 0 && copy.refId) copy.refId = tintedAsset(doc, copy.refId, tint, memo);
      mapColors(copy, () => tint);
      copies.push(copy);
    }
  }

  const mainKeys = jitterKeys(rand, 1, strength * 0.35, ip, bursts).map(
    ([t, [x, y]]): [number, number[]] => [t, [x * (rand() < 0.5 ? -1 : 1), y, 0]],
  );
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

// ---------- Shimmer (Бегущий диагональный блик) ----------

function shimmerStops(tint: ShimmerTint): number[] {
  let edgeA = '#e0f2fe';
  let core = '#ffffff';
  let edgeB = '#e0f2fe';

  if (tint === 'gold') {
    edgeA = '#fbbf24';
    core = '#fffbeb';
    edgeB = '#f59e0b';
  } else if (tint === 'neon') {
    edgeA = '#22d3ee';
    core = '#fdf4ff';
    edgeB = '#a855f7';
  }

  const cA = hexToRgb(edgeA).slice(0, 3);
  const cCore = hexToRgb(core).slice(0, 3);
  const cB = hexToRgb(edgeB).slice(0, 3);

  // 5 RGB stops (5 * 4 = 20 floats) followed by 5 matching opacity stops (5 * 2 = 10 floats).
  // Exact matching offsets [0, 0.25, 0.5, 0.75, 1] make lottie-web's checkCollapsable === true
  // (pure <stop stop-opacity="..."> with zero SVG masks) and rlottie VGradientStops native.
  return [
    0, ...cA,
    0.25, ...cA,
    0.5, ...cCore,
    0.75, ...cB,
    1, ...cB,
    0, 0,
    0.25, 0,
    0.5, 0.88,
    0.75, 0,
    1, 0,
  ].map((v) => round(v, 4));
}

function staticNumber(prop: unknown): number | null {
  if (!prop || typeof prop !== 'object') return null;
  const p = prop as { a?: number; k?: unknown };
  if (p.a === 1) return null;
  if (typeof p.k === 'number') return p.k;
  if (Array.isArray(p.k) && typeof p.k[0] === 'number') return p.k[0];
  return null;
}

function staticVec2(prop: unknown, fallback: [number, number]): [number, number] | null {
  if (!prop || typeof prop !== 'object') return fallback;
  const p = prop as { a?: number; k?: unknown };
  if (p.a === 1) return null;
  if (Array.isArray(p.k) && typeof p.k[0] === 'number' && typeof p.k[1] === 'number') {
    return [p.k[0], p.k[1]];
  }
  return fallback;
}

function mapBoxThroughGroupTr(parentBox: Box, grItems: ShapeItem[]): Box | null {
  const tr = grItems.find((x) => x.ty === 'tr');
  if (!tr) return parentBox;
  const rot = staticNumber(tr.r);
  if (rot === null || Math.abs(rot) > 1) return null;
  const pos = staticVec2(tr.p, [0, 0]);
  const anc = staticVec2(tr.a, [0, 0]);
  const scl = staticVec2(tr.s, [100, 100]);
  if (!pos || !anc || !scl || Math.abs(scl[0]) < 5 || Math.abs(scl[1]) < 5) return null;

  const invX = (x: number) => ((x - pos[0]) * 100) / scl[0] + anc[0];
  const invY = (y: number) => ((y - pos[1]) * 100) / scl[1] + anc[1];
  const lx0 = invX(parentBox.x0);
  const lx1 = invX(parentBox.x1);
  const ly0 = invY(parentBox.y0);
  const ly1 = invY(parentBox.y1);
  return {
    x0: Math.min(lx0, lx1),
    x1: Math.max(lx0, lx1),
    y0: Math.min(ly0, ly1),
    y1: Math.max(ly0, ly1),
  };
}

function buildShimmerFill(
  box: Box,
  basePaint: ShapeItem,
  stopsData: number[],
  ip: number,
  op: number,
): ShapeItem {
  const w = Math.max(36, box.x1 - box.x0);
  const h = Math.max(36, box.y1 - box.y0);
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;

  // Unit normal u = (cos 32°, sin 32°) perpendicular to a crisp ~58° diagonal light beam
  const ux = 0.848;
  const uy = 0.53;
  const halfSpan = (w / 2) * ux + (h / 2) * uy;
  const beamW = Math.max(88, Math.min(260, Math.min(w, h) * 0.58));
  const pad = 16;

  // At t = ip: entire shape has proj >= -halfSpan > eProj0, so offset >= 1 (alpha = 0).
  // At t = sweepEnd..op: entire shape has proj <= +halfSpan < sProj1, so offset <= 0 (alpha = 0).
  const eProj0 = -halfSpan - pad;
  const sProj0 = eProj0 - beamW;
  const sProj1 = halfSpan + pad;
  const eProj1 = sProj1 + beamW;

  const ptAt = (proj: number): [number, number] => [
    round(cx + ux * proj, 1),
    round(cy + uy * proj, 1),
  ];

  const dur = Math.max(24, op - ip);
  const sweepEnd = Math.max(ip + 12, Math.min(op - 2, Math.round(ip + dur * 0.72)));

  const s0 = ptAt(sProj0);
  const e0 = ptAt(eProj0);
  const s1 = ptAt(sProj1);
  const e1 = ptAt(eProj1);

  return {
    ty: 'gf',
    nm: 'Блик',
    o: basePaint.o ? structuredClone(basePaint.o) : fixed(100),
    r: typeof basePaint.r === 'number' ? basePaint.r : 1,
    t: 1,
    s: anim([
      [ip, s0],
      [sweepEnd, s1],
      [op, s1],
    ]),
    e: anim([
      [ip, e0],
      [sweepEnd, e1],
      [op, e1],
    ]),
    g: {
      p: 5,
      k: fixed(stopsData),
    },
  };
}

function shimmerList(items: ShapeItem[], currentBox: Box, stopsData: number[], ip: number, op: number) {
  for (const item of items) {
    if (item.hd) continue;
    if (item.ty === 'gr' && Array.isArray(item.it)) {
      const subBox = mapBoxThroughGroupTr(currentBox, item.it) ?? bounds(item.it);
      shimmerList(item.it, subBox, stopsData, ip, op);
    }
  }

  const hasDirectGeom = items.some(
    (x) => !x.hd && (x.ty === 'sh' || x.ty === 'rc' || x.ty === 'el' || x.ty === 'sr'),
  );
  if (!hasDirectGeom || items.some((x) => x.nm === 'Блик')) return;

  const paintIdx = items.findIndex((x) => !x.hd && (x.ty === 'fl' || x.ty === 'gf'));
  if (paintIdx < 0) return;

  const basePaint = items[paintIdx];
  if (staticNumber(basePaint.o) === 0) return;

  const gleam = buildShimmerFill(currentBox, basePaint, stopsData, ip, op);
  items.splice(paintIdx, 0, gleam);
}

function shimmer(doc: LottieDoc, target: number | null, tint: ShimmerTint) {
  const { layers, assets } = familyNodes(doc, target);
  const stopsData = shimmerStops(tint);
  const rootIp = doc.ip ?? 0;
  const rootOp = doc.op ?? FRAMES;

  for (const l of layers) {
    if (l.hd || !Array.isArray(l.shapes)) continue;
    const box = bounds(l.shapes);
    shimmerList(l.shapes, box, stopsData, rootIp, rootOp);
  }

  for (const a of assets) {
    for (const l of a.layers ?? []) {
      if (l.hd || !Array.isArray(l.shapes)) continue;
      const aIp = typeof l.ip === 'number' ? Math.min(0, l.ip) : 0;
      const aOp = typeof l.op === 'number' && l.op > aIp ? l.op : rootOp - rootIp;
      const box = bounds(l.shapes);
      shimmerList(l.shapes, box, stopsData, aIp, aOp);
    }
  }
}

// ---------- Particles (Искры / Звёзды / Огоньки / Неон) ----------

function polygonShape(nm: string, pts: Vec[]): ShapeItem {
  const v = pts.map(([x, y]): Vec => [round(x, 2), round(y, 2)]);
  const zeros = v.map((): Vec => [0, 0]);
  return {
    ty: 'sh',
    nm,
    ks: fixed({ c: true, v, i: zeros, o: zeros } as unknown as number[]),
  };
}

function star4Shape(r: number): ShapeItem {
  const w = r * 0.2;
  const rx = r * 0.86;
  return polygonShape('Искра 4', [
    [0, -r],
    [w, -w],
    [rx, 0],
    [w, w],
    [0, r],
    [-w, w],
    [-rx, 0],
    [-w, -w],
  ]);
}

function star5Shape(r: number): ShapeItem {
  const inner = r * 0.42;
  const pts: Vec[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
  }
  return polygonShape('Звезда 5', pts);
}

function diamondShape(r: number): ShapeItem {
  return polygonShape('Кристалл', [
    [0, -r],
    [r * 0.62, 0],
    [0, r],
    [-r * 0.62, 0],
  ]);
}

function emberShape(r: number): ShapeItem {
  const tipY = -round(r * 1.38, 2);
  const botY = round(r * 0.85, 2);
  const sideX = round(r * 0.76, 2);
  return bezierPath(
    [0, tipY],
    [
      [
        [round(sideX * 0.55, 2), round(tipY * 0.35, 2)],
        [sideX, round(-r * 0.12, 2)],
        [sideX, round(r * 0.25, 2)],
      ],
      [
        [sideX, round(r * 0.65, 2)],
        [round(sideX * 0.48, 2), botY],
        [0, botY],
      ],
      [
        [round(-sideX * 0.48, 2), botY],
        [-sideX, round(r * 0.65, 2)],
        [-sideX, round(r * 0.25, 2)],
      ],
      [
        [-sideX, round(-r * 0.12, 2)],
        [round(-sideX * 0.55, 2), round(tipY * 0.35, 2)],
        [0, tipY],
      ],
    ],
    true,
  );
}

function evalPeriodic(knots: [number, number[]][], uRaw: number): number[] {
  const u = ((uRaw % 1) + 1) % 1;
  for (let i = 0; i < knots.length - 1; i++) {
    const [u0, v0] = knots[i];
    const [u1, v1] = knots[i + 1];
    if (u >= u0 && u <= u1) {
      const span = u1 - u0;
      const f = span > 1e-6 ? (u - u0) / span : 0;
      return v0.map((a, idx) => round(a + (v1[idx] - a) * f, 2));
    }
  }
  return [...knots[0][1]];
}

/**
 * Evaluates a periodic keyframe profile `P((t + phase) mod 1)` across `[ip..op]`
 * so every particle is staggered in phase AND `val(ip) === val(op)` with C1 loop continuity.
 */
function periodicAnim(knots: [number, number[]][], phase: number, ip: number, op: number) {
  const dur = Math.max(24, op - ip);
  const shift = ((phase % 1) + 1) % 1;
  const vBoundary = evalPeriodic(knots, shift);

  const interior: [number, number[]][] = [];
  for (let i = 0; i < knots.length - 1; i++) {
    const [uk, vk] = knots[i];
    const tk = (((uk - shift) % 1) + 1) % 1;
    if (tk > 0.02 && tk < 0.98) {
      interior.push([tk, vk.map((x) => round(x, 2))]);
    }
  }
  interior.sort((a, b) => a[0] - b[0]);

  const rawFrames: [number, number[]][] = [
    [ip, vBoundary],
    ...interior.map(([t, v]): [number, number[]] => [Math.round(ip + t * dur), v]),
    [op, [...vBoundary]],
  ];

  const deduped: [number, number[]][] = [];
  for (const [frame, val] of rawFrames) {
    if (deduped.length > 0 && deduped[deduped.length - 1][0] === frame) {
      if (frame === op) deduped[deduped.length - 1] = [op, [...vBoundary]];
      continue;
    }
    deduped.push([frame, val]);
  }
  return anim(deduped, 'linear');
}

function particles(
  doc: LottieDoc,
  style: ParticleStyle,
  placement: ParticlePlacement,
  rawCount: number,
) {
  const count = Math.max(4, Math.min(24, Math.round(rawCount)));
  const ip = doc.ip ?? 0;
  const op = doc.op ?? FRAMES;
  const rand = random(
    style === 'fire' ? 4099 : style === 'stars' ? 7919 : style === 'neon' ? 6151 : 2741,
  );

  const palettes: Record<ParticleStyle, string[]> = {
    sparks: ['#ffffff', '#fef08a', '#fbbf24', '#fde68a'],
    stars: ['#fffbeb', '#fde047', '#38bdf8', '#c084fc'],
    fire: ['#fef08a', '#fb923c', '#f97316', '#ef4444'],
    neon: ['#22d3ee', '#a855f7', '#f43f5e', '#00f59b'],
  };
  const colors = palettes[style];
  const groups: ShapeItem[] = [];

  for (let i = 0; i < count; i++) {
    const phase = (i / count + rand() * 0.08) % 1;
    const color = colors[i % colors.length];

    if (style === 'fire') {
      const lane = (i + 0.5) / count;
      const x0 = round(66 + lane * (CANVAS - 132) + (rand() - 0.5) * 28, 1);
      const y0 = round(355 + rand() * 115, 1);
      const rise = round(125 + rand() * 85, 1);
      const sway = round((i % 2 === 0 ? 1 : -1) * (14 + rand() * 18), 1);
      const r = round(6.5 + rand() * 6.5, 1);

      const geom = i % 3 === 2 ? ellipse(0, 0, r * 1.35, r * 1.35) : emberShape(r);
      const posAnim = periodicAnim(
        [
          [0, [x0, y0]],
          [0.24, [x0 + sway, y0 - rise * 0.28]],
          [0.56, [x0 - sway * 0.75, y0 - rise * 0.68]],
          [0.84, [x0 + sway * 0.35, y0 - rise]],
          [0.92, [x0, y0]],
          [1, [x0, y0]],
        ],
        phase,
        ip,
        op,
      );
      const scaleAnim = periodicAnim(
        [
          [0, [30, 30]],
          [0.16, [108, 108]],
          [0.58, [84, 84]],
          [0.84, [18, 18]],
          [0.92, [30, 30]],
          [1, [30, 30]],
        ],
        phase,
        ip,
        op,
      );
      const opAnim = periodicAnim(
        [
          [0, [0]],
          [0.14, [96]],
          [0.58, [82]],
          [0.84, [0]],
          [0.92, [0]],
          [1, [0]],
        ],
        phase,
        ip,
        op,
      );

      groups.push(
        group(`Огонёк ${i + 1}`, [geom, fill(color, 100)], {
          p: posAnim,
          s: scaleAnim,
          o: opAnim,
          r: fixed(round((rand() - 0.5) * 22, 1)),
        }),
      );
      continue;
    }

    // Golden-angle spiral around canvas so sparkles frame the sticker naturally
    const golden = i * 2.39996 + rand() * 0.32;
    const ringFrac = (i + 0.5) / count;
    const rad = 108 + ringFrac * 118 + (rand() - 0.5) * 22;
    const cx = Math.max(36, Math.min(CANVAS - 36, round(CANVAS / 2 + Math.cos(golden) * rad, 1)));
    const cy = Math.max(36, Math.min(CANVAS - 36, round(CANVAS / 2 + Math.sin(golden) * rad, 1)));
    const driftX = round((rand() - 0.5) * 24, 1);
    const driftY = round(-10 - rand() * 16, 1);
    const baseSize = round(10 + rand() * 11, 1);

    let paintsAndGeom: ShapeItem[];
    if (style === 'stars') {
      const geom = i % 2 === 0 ? star5Shape(baseSize) : star4Shape(baseSize * 0.92);
      paintsAndGeom = [geom, fill(color, 100)];
    } else if (style === 'neon') {
      if (i % 3 === 1) {
        paintsAndGeom = [ellipse(0, 0, baseSize * 1.4, baseSize * 1.4), stroke(color, 3.2, 100)];
      } else if (i % 3 === 2) {
        paintsAndGeom = [diamondShape(baseSize * 0.95), fill(color, 100)];
      } else {
        paintsAndGeom = [star4Shape(baseSize * 1.05), fill(color, 100)];
      }
    } else {
      // 'sparks'
      const geom =
        i % 4 === 3
          ? ellipse(0, 0, baseSize * 0.85, baseSize * 0.85)
          : star4Shape(baseSize * 1.12);
      paintsAndGeom = [geom, fill(color, 100)];
    }

    const posAnim = periodicAnim(
      [
        [0, [cx, cy]],
        [0.5, [cx + driftX, cy + driftY]],
        [1, [cx, cy]],
      ],
      phase,
      ip,
      op,
    );
    const scaleAnim = periodicAnim(
      [
        [0, [0, 0]],
        [0.22, [112, 112]],
        [0.46, [18, 18]],
        [0.7, [86, 86]],
        [0.92, [0, 0]],
        [1, [0, 0]],
      ],
      phase,
      ip,
      op,
    );
    const opAnim = periodicAnim(
      [
        [0, [0]],
        [0.2, [100]],
        [0.46, [25]],
        [0.7, [92]],
        [0.92, [0]],
        [1, [0]],
      ],
      phase,
      ip,
      op,
    );
    const rotBase = round((rand() - 0.5) * 30, 1);
    const rotSwing = style === 'stars' ? 42 : 24;
    const rotAnim = periodicAnim(
      [
        [0, [rotBase]],
        [0.5, [rotBase + (i % 2 === 0 ? rotSwing : -rotSwing)]],
        [1, [rotBase]],
      ],
      phase,
      ip,
      op,
    );

    groups.push(
      group(`Частица ${i + 1}`, paintsAndGeom, {
        p: posAnim,
        s: scaleAnim,
        o: opAnim,
        r: rotAnim,
      }),
    );
  }

  const pLayer = shapeLayer('Частицы', groups, {
    p: fixed([CANVAS / 2, CANVAS / 2, 0]),
    a: fixed([CANVAS / 2, CANVAS / 2, 0]),
  });
  pLayer.ind = -1;
  pLayer.ip = ip;
  pLayer.op = op;

  if (placement === 'front') {
    doc.layers.unshift(pLayer);
  } else {
    // Insert behind sticker layers, but in front of any full-canvas background layer at bottom,
    // without ever splitting an adjacent track-matte pair (layer[idx - 1] -> layer[idx].tt).
    let insertIdx = doc.layers.length;
    while (
      insertIdx > 0 &&
      (Boolean(doc.layers[insertIdx]?.tt) ||
        doc.layers[insertIdx - 1].ty === 1 ||
        /^(фон|bg|background)/i.test(doc.layers[insertIdx - 1].nm ?? ''))
    ) {
      insertIdx--;
    }
    doc.layers.splice(insertIdx, 0, pLayer);
  }
  reindexLayers(doc.layers);
}
