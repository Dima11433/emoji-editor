import type { Font } from 'opentype.js';
import type { FontId } from './fonts';
import type { VectorLogo } from './logoVector';
import {
  anim,
  CANVAS,
  fill,
  fixed,
  FRAMES,
  group,
  groupTransform,
  hexToRgb,
  layerTransform,
  rect,
  reindexLayers,
  rgbToHex,
  round,
  shapeLayer,
  stroke,
  type Layer,
  type LottieDoc,
  type ShapeItem,
  type Vec,
} from './lottie';
import { buildSlotLayerAnimation, commandsToPaths, pathPoints, transformPath } from './text';

export type BrandMode = 'text' | 'logo' | 'logo+text';
export type BrandPlateStyle = 'none' | 'dark' | 'gold' | 'neon' | 'light';
export type BrandSlotPosition = 'bottom' | 'center' | 'top';
export type BrandSlotAnim = 'none' | 'pulse' | 'float' | 'swing' | 'pop';
export type BrandGradientId =
  | 'none'
  | 'gold_3d'
  | 'chrome'
  | 'fire'
  | 'cyber_neon'
  | 'emerald_vip'
  | 'royal_violet'
  | 'ice_blue'
  | 'sunset_rose';

export interface BrandGradientSpec {
  id: BrandGradientId;
  label: string;
  css: string;
  angle: 'vertical' | 'diagonal';
  stops: [number, string][];
}

export const BRAND_GRADIENTS: BrandGradientSpec[] = [
  {
    id: 'none',
    label: 'Обычный',
    css: 'linear-gradient(135deg, #ffffff, #cbd5e1)',
    angle: 'vertical',
    stops: [],
  },
  {
    id: 'gold_3d',
    label: 'Золото',
    css: 'linear-gradient(180deg, #fffbeb 0%, #fbbf24 44%, #b45309 78%, #fde047 100%)',
    angle: 'vertical',
    stops: [
      [0, '#fffbeb'],
      [0.44, '#fbbf24'],
      [0.78, '#b45309'],
      [1, '#fde047'],
    ],
  },
  {
    id: 'chrome',
    label: 'Хром 3D',
    css: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 46%, #475569 72%, #f1f5f9 100%)',
    angle: 'vertical',
    stops: [
      [0, '#ffffff'],
      [0.46, '#cbd5e1'],
      [0.72, '#475569'],
      [1, '#f1f5f9'],
    ],
  },
  {
    id: 'fire',
    label: 'Огонь',
    css: 'linear-gradient(180deg, #fef08a 0%, #f97316 52%, #dc2626 100%)',
    angle: 'vertical',
    stops: [
      [0, '#fef08a'],
      [0.52, '#f97316'],
      [1, '#dc2626'],
    ],
  },
  {
    id: 'cyber_neon',
    label: 'Кибер',
    css: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 52%, #f43f5e 100%)',
    angle: 'diagonal',
    stops: [
      [0, '#22d3ee'],
      [0.52, '#a855f7'],
      [1, '#f43f5e'],
    ],
  },
  {
    id: 'emerald_vip',
    label: 'Изумруд',
    css: 'linear-gradient(180deg, #d1fae5 0%, #10b981 50%, #065f46 82%, #34d399 100%)',
    angle: 'vertical',
    stops: [
      [0, '#d1fae5'],
      [0.5, '#10b981'],
      [0.82, '#065f46'],
      [1, '#34d399'],
    ],
  },
  {
    id: 'royal_violet',
    label: 'Фиолет',
    css: 'linear-gradient(180deg, #fae8ff 0%, #a855f7 50%, #4c1d95 82%, #d8b4fe 100%)',
    angle: 'vertical',
    stops: [
      [0, '#fae8ff'],
      [0.5, '#a855f7'],
      [0.82, '#4c1d95'],
      [1, '#d8b4fe'],
    ],
  },
  {
    id: 'ice_blue',
    label: 'Алмаз',
    css: 'linear-gradient(180deg, #ffffff 0%, #38bdf8 52%, #0369a1 84%, #bae6fd 100%)',
    angle: 'vertical',
    stops: [
      [0, '#ffffff'],
      [0.52, '#38bdf8'],
      [0.84, '#0369a1'],
      [1, '#bae6fd'],
    ],
  },
  {
    id: 'sunset_rose',
    label: 'Рубин',
    css: 'linear-gradient(180deg, #ffe4e6 0%, #f43f5e 50%, #881337 84%, #fb7185 100%)',
    angle: 'vertical',
    stops: [
      [0, '#ffe4e6'],
      [0.5, '#f43f5e'],
      [0.84, '#881337'],
      [1, '#fb7185'],
    ],
  },
];

export type BrandSlotRole = 'main' | 'center' | 'plate';

export interface BrandSlotOptions {
  mode: BrandMode;
  text: string;
  plateText: string;
  plateTextEnabled: boolean;
  syncPlateText: boolean;
  hideBuiltInPlate: boolean;
  useOriginalGlyphs: boolean;
  fontId: FontId;
  fillHex: string;
  gradientId: BrandGradientId;
  gradientAnim: boolean;
  strokeHex: string | null;
  strokeWidth: number;
  plateStyle: BrandPlateStyle;
  slotPosition: BrandSlotPosition;
  slotAnim: BrandSlotAnim;
  scale: number;
  offsetX: number;
  offsetY: number;
  letterSpacing: number;
  hidden: boolean;
  logo: VectorLogo | null;
  tintLogo: boolean;
  logoGap: number;
}

export interface BrandSlotSnapshot {
  role?: BrandSlotRole;
  origName?: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  origHex: string;
  origStrokeHex: string | null;
  origStrokeWidth: number;
  origUiStrokeWidth: number;
  origFillRule: number;
  origOpacity?: unknown;
  origShapes: ShapeItem[];
  injected?: boolean;
}

export const DEFAULT_BRAND_OPTIONS: BrandSlotOptions = {
  mode: 'text',
  text: 'MAGNAT',
  plateText: 'platega',
  plateTextEnabled: true,
  syncPlateText: false,
  hideBuiltInPlate: false,
  useOriginalGlyphs: true,
  fontId: 'montserrat',
  fillHex: '#ffffff',
  gradientId: 'none',
  gradientAnim: false,
  strokeHex: null,
  strokeWidth: 4,
  plateStyle: 'none',
  slotPosition: 'bottom',
  slotAnim: 'float',
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  letterSpacing: 0,
  hidden: false,
  logo: null,
  tintLogo: false,
  logoGap: 18,
};

export const INJECTED_BRAND_LAYER_NAME = 'Бренд-слот';
const EXTRUDE_SHADOW_NAME = 'tier_extrude_shadow';

export function isInjectedBrandLayer(layer: Layer | undefined): boolean {
  if (!layer || typeof layer !== 'object') return false;
  return Boolean(layer._injectedBrand || layer.nm === INJECTED_BRAND_LAYER_NAME);
}

/** Checks whether a layer, asset, or shape group represents a MAGNAT / custom brand slot. */
export function isBrandSlotNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const obj = node as Record<string, unknown>;
  if (obj._brandSlot || obj._injectedBrand) return true;
  if (
    obj.nm === 'tier_text' ||
    obj.nm === 'tier_logo_slot' ||
    obj.nm === INJECTED_BRAND_LAYER_NAME ||
    obj.id === 'mylogo' ||
    obj.refId === 'mylogo'
  ) {
    return true;
  }
  if (obj.ty === 'gr' && Array.isArray(obj.it)) {
    return (obj.it as ShapeItem[]).some((x) => x.ty === 'sh' && x.nm === 'tier_glyph');
  }
  if (obj.ty === 4 && Array.isArray(obj.shapes)) {
    return (obj.shapes as ShapeItem[]).some((s) => isBrandSlotNode(s));
  }
  return false;
}

function isSlotGroup(gr: ShapeItem): boolean {
  if (gr.ty !== 'gr') return false;
  if (gr._brandSlot || gr.nm === 'tier_logo_slot') return true;
  if (gr.nm === 'TextGroup' || gr.nm === 'USERNAME' || gr.nm === 'tier_text') return true;
  const items = gr.it ?? [];
  const hasShapes = items.some((x) => x.ty === 'sh');
  if (!hasShapes) return false;
  return items.some((x) => x.ty === 'sh' && x.nm === 'tier_glyph');
}

/** Finds built-in background/glow plate layers (e.g. capsule templates 016..021). */
export function findBuiltInPlateLayers(doc: LottieDoc): Layer[] {
  const plateLayers: Layer[] = [];
  const checkLayers = (layers: Layer[] | undefined) => {
    if (!layers) return;
    for (const l of layers) {
      if (l.nm === 'USERNAME' || isInjectedBrandLayer(l)) continue;
      const hasRc = JSON.stringify(l.shapes ?? []).includes('"ty":"rc"');
      if (hasRc) {
        plateLayers.push(l);
      }
    }
  };
  checkLayers(doc.layers);
  for (const a of doc.assets ?? []) checkLayers(a.layers);
  return plateLayers;
}

function detectSlotRole(gr: ShapeItem): BrandSlotRole {
  if (gr.nm === 'USERNAME') return 'plate';
  if (gr.nm === 'TextGroup') return 'center';
  return 'main';
}

/** Finds all brand slots across root layers and nested precomp assets. */
export function findBrandSlots(doc: LottieDoc): ShapeItem[] {
  const slots: ShapeItem[] = [];
  const visitShapes = (items: ShapeItem[] | undefined) => {
    if (!items) return;
    for (const item of items) {
      if (item.ty === 'gr') {
        if (isSlotGroup(item)) {
          slots.push(item);
        } else {
          visitShapes(item.it);
        }
      }
    }
  };
  const visitLayers = (layers: Layer[] | undefined) => {
    if (!layers) return;
    for (const layer of layers) visitShapes(layer.shapes);
  };
  visitLayers(doc.layers);
  for (const asset of doc.assets ?? []) visitLayers(asset.layers);
  return slots;
}

/**
 * Computes effective horizontal-to-vertical scale ratio (`sx / sy`) inherited from
 * ancestor layers (e.g. `0.7879` on wide 3-tile banner templates) so replacement
 * fonts and circular logos render without horizontal distortion.
 */
function detectSlotAspectX(doc: LottieDoc, targetGr: ShapeItem): number {
  const containsGroup = (items: ShapeItem[] | undefined): boolean => {
    if (!items) return false;
    for (const it of items) {
      if (it === targetGr) return true;
      if (it.ty === 'gr' && containsGroup(it.it)) return true;
    }
    return false;
  };

  const checkLayerSet = (layers: Layer[] | undefined): number | null => {
    if (!layers) return null;
    const owner = layers.find((l) => containsGroup(l.shapes));
    if (!owner) return null;

    let ratio = 1;
    const visited = new Set<number>();
    let cur: Layer | undefined = owner;
    while (cur) {
      const sProp = cur.ks?.s as { a?: number; k?: unknown } | undefined;
      if (sProp && !sProp.a && Array.isArray(sProp.k)) {
        const sx = Number(sProp.k[0]);
        const sy = Number(sProp.k[1]);
        if (Number.isFinite(sx) && Number.isFinite(sy) && Math.abs(sx) > 1 && Math.abs(sy) > 1) {
          ratio *= Math.abs(sx / sy);
        }
      }
      if (cur.parent === undefined || visited.has(cur.parent)) break;
      visited.add(cur.parent);
      cur = layers.find((l) => l.ind === cur!.parent);
    }
    return ratio;
  };

  const fromRoot = checkLayerSet(doc.layers);
  if (fromRoot !== null) return fromRoot;
  for (const asset of doc.assets ?? []) {
    const fromAsset = checkLayerSet(asset.layers);
    if (fromAsset !== null) return fromAsset;
  }
  return 1;
}

/** Finds the sibling `tier_extrude_shadow` group next to `targetGr` if present (e.g. 3D badge templates). */
function findSiblingExtrudeShadow(doc: LottieDoc, targetGr: ShapeItem): ShapeItem | null {
  const searchItems = (items: ShapeItem[] | undefined): ShapeItem | null => {
    if (!items) return null;
    if (items.includes(targetGr)) {
      return items.find((x) => x.ty === 'gr' && x.nm === EXTRUDE_SHADOW_NAME) ?? null;
    }
    for (const it of items) {
      if (it.ty === 'gr') {
        const found = searchItems(it.it);
        if (found) return found;
      }
    }
    return null;
  };
  for (const l of doc.layers) {
    const found = searchItems(l.shapes);
    if (found) return found;
  }
  for (const a of doc.assets ?? []) {
    for (const l of a.layers ?? []) {
      const found = searchItems(l.shapes);
      if (found) return found;
    }
  }
  return null;
}

interface ExtrudeShadowSnap {
  dx: number;
  dy: number;
  fillHex: string;
  strokeHex: string | null;
  strokeWidth: number;
  origItems: ShapeItem[];
}

function ensureExtrudeShadowSnap(shadowGr: ShapeItem, mainSnap: BrandSlotSnapshot): ExtrudeShadowSnap {
  if (shadowGr._extrudeSnap) return shadowGr._extrudeSnap as ExtrudeShadowSnap;
  const items = shadowGr.it ?? [];
  const shs = collectAllShapes(items);
  const pts = shs.flatMap((p) => {
    try {
      return pathPoints(p);
    } catch {
      return [];
    }
  });
  let cx = mainSnap.cx + 28;
  let cy = mainSnap.cy;
  if (pts.length > 0) {
    cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
    cy = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  }
  const fl = items.find((x) => x.ty === 'fl');
  const st = items.find((x) => x.ty === 'st');
  const snap: ExtrudeShadowSnap = {
    dx: round(cx - mainSnap.cx, 2),
    dy: round(cy - mainSnap.cy, 2),
    fillHex: fl ? readFillColorHex(fl) : '#12141a',
    strokeHex: st ? readFillColorHex(st) : '#4e5769',
    strokeWidth: st ? readStrokeWidth(st) : 30,
    origItems: structuredClone(items),
  };
  shadowGr._extrudeSnap = snap;
  return snap;
}

function syncExtrudeShadow(
  doc: LottieDoc,
  slotGr: ShapeItem,
  mainSnap: BrandSlotSnapshot,
  opts: BrandSlotOptions,
  isExactOrig: boolean,
): void {
  const shadowGr = findSiblingExtrudeShadow(doc, slotGr);
  if (!shadowGr) return;
  const shSnap = ensureExtrudeShadowSnap(shadowGr, mainSnap);
  shadowGr.hd = opts.hidden;
  if (opts.hidden) return;

  if (isExactOrig) {
    shadowGr.it = structuredClone(shSnap.origItems);
    return;
  }

  const fgShapes = collectAllShapes(slotGr.it).map((s) => {
    const c = structuredClone(s);
    c.nm = 'shadow_glyph';
    transformPath(c, (pt) => [pt[0] + shSnap.dx, pt[1] + shSnap.dy]);
    return c;
  });

  const trItem = shadowGr.it?.find((x) => x.ty === 'tr') ?? groupTransform();
  const paints: ShapeItem[] = [fill(shSnap.fillHex, 100)];
  if (shSnap.strokeHex && shSnap.strokeWidth > 0) {
    const scaledStroke = round(shSnap.strokeWidth * Math.max(0.4, opts.scale / 100), 2);
    paints.push(stroke(shSnap.strokeHex, scaledStroke, 100));
  }
  shadowGr.it = [...fgShapes, ...paints, trItem];
}

function slotPositionY(pos: BrandSlotPosition): number {
  if (pos === 'top') return 90;
  if (pos === 'center') return CANVAS / 2;
  return 422;
}

function syncInjectedLayerTransform(doc: LottieDoc, layer: Layer, opts: BrandSlotOptions): void {
  const ip = doc.ip ?? 0;
  const op = doc.op ?? FRAMES;
  const baseY = slotPositionY(opts.slotPosition);
  layer.ip = ip;
  layer.op = op;
  layer.ks = layerTransform(buildSlotLayerAnimation(opts.slotAnim, [CANVAS / 2, baseY, 0], ip, op));
}

function createInjectedBrandLayer(doc: LottieDoc, opts: BrandSlotOptions): ShapeItem {
  const slotGr: ShapeItem = {
    ty: 'gr',
    nm: 'tier_logo_slot',
    it: [groupTransform()],
    _brandSlot: {
      origName: 'tier_logo_slot',
      cx: 0,
      cy: 0,
      w: 310,
      h: 64,
      origHex: '#ffffff',
      origStrokeHex: null,
      origStrokeWidth: 0,
      origUiStrokeWidth: 4,
      origFillRule: 1,
      origShapes: [],
      injected: true,
    } satisfies BrandSlotSnapshot,
  };
  const layer = shapeLayer(INJECTED_BRAND_LAYER_NAME, [slotGr]);
  layer._injectedBrand = true;
  syncInjectedLayerTransform(doc, layer, opts);
  doc.layers.unshift(layer);
  reindexLayers(doc.layers);
  return slotGr;
}

function readFillColorHex(fl: ShapeItem | undefined): string {
  if (!fl || !fl.c || typeof fl.c !== 'object') return '#ffffff';
  const c = fl.c as { a?: number; k?: unknown };
  if (Array.isArray(c.k) && typeof c.k[0] === 'number') {
    return rgbToHex(c.k as number[]);
  }
  if (Array.isArray(c.k) && c.k[0] && typeof c.k[0] === 'object') {
    const first = (c.k[0] as { s?: unknown }).s;
    if (Array.isArray(first) && typeof first[0] === 'number') return rgbToHex(first as number[]);
  }
  return '#ffffff';
}

function readStrokeWidth(st: ShapeItem | undefined): number {
  if (!st || !st.w || typeof st.w !== 'object') return 0;
  const w = (st.w as { k?: unknown }).k;
  if (typeof w === 'number') return w;
  if (Array.isArray(w) && typeof w[0] === 'number') return w[0];
  return 0;
}

function collectAllShapes(items: ShapeItem[] | undefined, out: ShapeItem[] = []): ShapeItem[] {
  if (!items) return out;
  for (const it of items) {
    if (it.ty === 'sh') out.push(it);
    else if (it.ty === 'gr' && it.nm !== 'brand_plate' && it.nm !== EXTRUDE_SHADOW_NAME) {
      collectAllShapes(it.it, out);
    }
  }
  return out;
}

function ensureSnapshot(gr: ShapeItem, parentInjected = false): BrandSlotSnapshot {
  if (gr._brandSlot) return gr._brandSlot as BrandSlotSnapshot;
  const items = gr.it ?? [];
  const directShapes = items.filter((x) => x.ty === 'sh');
  const allShapes = directShapes.length > 0 ? directShapes : collectAllShapes(items);
  const pts = allShapes.flatMap((p) => {
    try {
      return pathPoints(p);
    } catch {
      return [];
    }
  });
  let minX = -155;
  let maxX = 155;
  let minY = -32;
  let maxY = 32;
  if (pts.length > 0) {
    minX = Math.min(...pts.map((p) => p[0]));
    maxX = Math.max(...pts.map((p) => p[0]));
    minY = Math.min(...pts.map((p) => p[1]));
    maxY = Math.max(...pts.map((p) => p[1]));
  }
  const h = parentInjected ? 64 : Math.max(6, round(maxY - minY, 2));
  const fl = items.find((x) => x.ty === 'fl');
  const st = items.find((x) => x.ty === 'st');
  const origStrokeWidth = st ? readStrokeWidth(st) : 0;
  const strokeUnit = Math.max(0.25, h / 46) * 2;
  const origUiStrokeWidth =
    origStrokeWidth > 0
      ? Math.max(1, Math.min(16, round(origStrokeWidth / strokeUnit, 1)))
      : 4;

  const snap: BrandSlotSnapshot = {
    role: (gr._brandSlot as BrandSlotSnapshot | undefined)?.role ?? detectSlotRole(gr),
    origName: gr.nm,
    cx: parentInjected ? 0 : round((minX + maxX) / 2, 2),
    cy: parentInjected ? 0 : round((minY + maxY) / 2, 2),
    w: parentInjected ? 310 : Math.max(8, round(maxX - minX, 2)),
    h,
    origHex: readFillColorHex(fl),
    origStrokeHex: st && origStrokeWidth > 0 ? readFillColorHex(st) : null,
    origStrokeWidth,
    origUiStrokeWidth,
    origFillRule: typeof fl?.r === 'number' ? fl.r : 1,
    origOpacity: fl?.o ? structuredClone(fl.o) : undefined,
    origShapes: parentInjected ? [] : structuredClone(directShapes),
    injected: parentInjected,
  };
  gr._brandSlot = snap;
  return snap;
}

function detectOrigText(doc: LottieDoc): string {
  const nm = typeof doc.nm === 'string' ? doc.nm : '';
  if (/баннер/i.test(nm)) return 'BANNER';
  const slots = findBrandSlots(doc);
  if (slots.some((s) => s.nm === 'TextGroup' || (s._brandSlot as BrandSlotSnapshot)?.role === 'center')) {
    return 'platega';
  }
  return 'MAGNAT';
}

/** Reads the current brand slot info and options from a Lottie document. */
export function readBrandSlotInfo(doc: LottieDoc): {
  count: number;
  isInjected: boolean;
  origText: string;
  hasCenterSlot: boolean;
  hasPlateSlot: boolean;
  origPlateText: string;
  options: BrandSlotOptions;
} {
  const slots = findBrandSlots(doc);
  const hasInjected = doc.layers.some((l) => isInjectedBrandLayer(l));
  const origText = detectOrigText(doc);
  const hasCenterSlot = slots.some((s) => s.nm === 'TextGroup' || (s._brandSlot as BrandSlotSnapshot)?.role === 'center');
  const hasPlateSlot = slots.some((s) => s.nm === 'USERNAME' || (s._brandSlot as BrandSlotSnapshot)?.role === 'plate');
  const origPlateText = 'platega';

  if (!slots.length) {
    return {
      count: 0,
      isInjected: false,
      origText,
      hasCenterSlot: false,
      hasPlateSlot: false,
      origPlateText,
      options: {
        ...DEFAULT_BRAND_OPTIONS,
        plateStyle: 'dark',
        useOriginalGlyphs: false,
        ...(doc._brandState ? (doc._brandState as Partial<BrandSlotOptions>) : {}),
      },
    };
  }
  if (doc._brandState && typeof doc._brandState === 'object') {
    return {
      count: slots.length,
      isInjected: hasInjected,
      origText,
      hasCenterSlot,
      hasPlateSlot,
      origPlateText,
      options: { ...DEFAULT_BRAND_OPTIONS, ...(doc._brandState as Partial<BrandSlotOptions>) },
    };
  }
  const primarySlot = slots.find((s) => s.nm !== 'USERNAME') ?? slots[0];
  const snap = ensureSnapshot(primarySlot, hasInjected);
  return {
    count: slots.length,
    isInjected: hasInjected,
    origText,
    hasCenterSlot,
    hasPlateSlot,
    origPlateText,
    options: {
      ...DEFAULT_BRAND_OPTIONS,
      text: hasInjected ? DEFAULT_BRAND_OPTIONS.text : origText,
      plateText: 'platega',
      plateTextEnabled: true,
      syncPlateText: false,
      hideBuiltInPlate: false,
      fillHex: snap.origHex,
      strokeHex: snap.origStrokeHex,
      strokeWidth: snap.origUiStrokeWidth,
      useOriginalGlyphs: !hasInjected,
      hidden: Boolean(primarySlot.hd),
    },
  };
}

function layoutBrandGlyphs(text: string, fonts: Font[], letterSpacing: number): ShapeItem[] {
  const out: ShapeItem[] = [];
  const baseSize = 100;
  let x = 0;
  const chars = [...text];
  chars.forEach((char, idx) => {
    const font = fonts.find((f) => f.charToGlyphIndex(char) > 0) ?? fonts[0];
    const glyph = font.charToGlyph(char);
    const advance = ((glyph.advanceWidth ?? font.unitsPerEm * 0.5) * baseSize) / font.unitsPerEm;
    const paths = commandsToPaths(glyph.getPath(x, 0, baseSize).commands);
    for (const p of paths) {
      p.nm = 'tier_glyph';
      out.push(p);
    }
    x += advance + (idx < chars.length - 1 ? letterSpacing * 2.5 : 0);
  });
  return out;
}

function buildPlateGroup(
  style: BrandPlateStyle,
  cx: number,
  cy: number,
  contentW: number,
  contentH: number,
  aspectX = 1,
): ShapeItem | null {
  if (style === 'none' || contentW <= 0 || contentH <= 0) return null;
  const padX = Math.max(12, contentH * 0.54) / Math.max(0.3, aspectX);
  const padY = Math.max(7, contentH * 0.34);
  const w = round(contentW + padX * 2, 1);
  const h = round(contentH + padY * 2, 1);
  const radius = round(h / 2, 1);
  const rimW = Math.max(1.5, round(h * 0.068, 2));

  let bgHex = '#0d111a';
  let bgOp = 90;
  let rimHex = '#334155';
  let rimOp = 95;

  if (style === 'gold') {
    bgHex = '#141109';
    bgOp = 92;
    rimHex = '#fbbf24';
    rimOp = 100;
  } else if (style === 'neon') {
    bgHex = '#071526';
    bgOp = 90;
    rimHex = '#38bdf8';
    rimOp = 100;
  } else if (style === 'light') {
    bgHex = '#ffffff';
    bgOp = 95;
    rimHex = '#0f172a';
    rimOp = 88;
  }

  return group('brand_plate', [
    rect(round(cx, 1), round(cy, 1), w, h, radius),
    fill(bgHex, bgOp),
    stroke(rimHex, rimW, rimOp),
  ]);
}

interface PaintBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function measurePathsBox(paths: ShapeItem[], fallback: PaintBox): PaintBox {
  const pts = paths.flatMap((p) => {
    try {
      return pathPoints(p);
    } catch {
      return [];
    }
  });
  if (!pts.length) return fallback;
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

function detectSlotTimeline(doc: LottieDoc, targetGr: ShapeItem): [number, number] {
  const containsGroup = (items: ShapeItem[] | undefined): boolean => {
    if (!items) return false;
    for (const it of items) {
      if (it === targetGr) return true;
      if (it.ty === 'gr' && containsGroup(it.it)) return true;
    }
    return false;
  };
  const rootDur = Math.max(24, (doc.op ?? FRAMES) - (doc.ip ?? 0));
  for (const asset of doc.assets ?? []) {
    if (asset.layers?.some((l) => containsGroup(l.shapes))) {
      return [0, rootDur];
    }
  }
  return [doc.ip ?? 0, doc.op ?? FRAMES];
}

function buildBrandPaint(
  opts: BrandSlotOptions,
  effectiveHex: string,
  box: PaintBox,
  fillRule: number,
  opacity: number | unknown,
  timeline: [number, number],
  skipGradient = false,
): ShapeItem {
  const spec = skipGradient
    ? undefined
    : BRAND_GRADIENTS.find((g) => g.id === opts.gradientId && g.stops.length >= 2);

  if (!spec) {
    const fl: ShapeItem = {
      ...fill(effectiveHex, typeof opacity === 'number' ? opacity : 100),
      r: fillRule,
    };
    if (opacity !== undefined && typeof opacity === 'object') {
      fl.o = structuredClone(opacity);
    }
    return fl;
  }

  const cx = (box.minX + box.maxX) / 2;
  const w = Math.max(12, box.maxX - box.minX);
  const h = Math.max(8, box.maxY - box.minY);

  const flatStops: number[] = [];
  for (const [offset, hex] of spec.stops) {
    const [r, g, b] = hexToRgb(hex);
    flatStops.push(round(offset, 3), round(r, 4), round(g, 4), round(b, 4));
  }

  let sProp: unknown;
  let eProp: unknown;
  const [ip, op] = timeline;
  const mid = Math.round((ip + op) / 2);

  if (spec.angle === 'diagonal') {
    const p0: [number, number] = [round(box.minX, 1), round(box.minY, 1)];
    const p1: [number, number] = [round(box.maxX, 1), round(box.maxY, 1)];
    if (opts.gradientAnim) {
      const shiftX = round(w * 0.45, 1);
      const shiftY = round(h * 0.35, 1);
      sProp = anim([
        [ip, [round(p0[0] - shiftX, 1), round(p0[1] - shiftY, 1)]],
        [mid, [round(p0[0] + shiftX, 1), round(p0[1] + shiftY, 1)]],
        [op, [round(p0[0] - shiftX, 1), round(p0[1] - shiftY, 1)]],
      ]);
      eProp = anim([
        [ip, [round(p1[0] - shiftX, 1), round(p1[1] - shiftY, 1)]],
        [mid, [round(p1[0] + shiftX, 1), round(p1[1] + shiftY, 1)]],
        [op, [round(p1[0] - shiftX, 1), round(p1[1] - shiftY, 1)]],
      ]);
    } else {
      sProp = fixed(p0);
      eProp = fixed(p1);
    }
  } else {
    const p0: [number, number] = [round(cx, 1), round(box.minY, 1)];
    const p1: [number, number] = [round(cx, 1), round(box.maxY, 1)];
    if (opts.gradientAnim) {
      const tilt = round(Math.min(w * 0.22, h * 0.65), 1);
      const bounceY = round(h * 0.22, 1);
      sProp = anim([
        [ip, [round(cx - tilt, 1), round(box.minY - bounceY, 1)]],
        [mid, [round(cx + tilt, 1), round(box.minY + bounceY, 1)]],
        [op, [round(cx - tilt, 1), round(box.minY - bounceY, 1)]],
      ]);
      eProp = anim([
        [ip, [round(cx + tilt, 1), round(box.maxY + bounceY, 1)]],
        [mid, [round(cx - tilt, 1), round(box.maxY - bounceY, 1)]],
        [op, [round(cx + tilt, 1), round(box.maxY + bounceY, 1)]],
      ]);
    } else {
      sProp = fixed(p0);
      eProp = fixed(p1);
    }
  }

  return {
    ty: 'gf',
    nm: 'Градиент бренда',
    o:
      opacity !== undefined && typeof opacity === 'object'
        ? structuredClone(opacity)
        : fixed(typeof opacity === 'number' ? opacity : 100),
    r: fillRule,
    t: 1,
    s: sProp,
    e: eProp,
    g: {
      p: spec.stops.length,
      k: fixed(flatStops),
    },
  };
}

function buildLogoGroups(
  logo: VectorLogo,
  mapPt: (pt: Vec) => Vec,
  scaleFactor: number,
  opts: BrandSlotOptions,
  effectiveHex: string,
  localOutlineWidth: number,
  timeline: [number, number],
  skipGradient = false,
): ShapeItem[] {
  const groups: ShapeItem[] = [];
  const allMappedBox: PaintBox = (() => {
    const p0 = mapPt([logo.minX, logo.minY]);
    const p1 = mapPt([logo.minX + logo.width, logo.minY + logo.height]);
    return {
      minX: Math.min(p0[0], p1[0]),
      maxX: Math.max(p0[0], p1[0]),
      minY: Math.min(p0[1], p1[1]),
      maxY: Math.max(p0[1], p1[1]),
    };
  })();

  for (let i = 0; i < logo.layers.length; i++) {
    const layer = logo.layers[i];
    const paths = structuredClone(layer.paths);
    for (const p of paths) {
      p.nm = 'logo_path';
      transformPath(p, mapPt);
    }

    const paints: ShapeItem[] = [];
    const op = layer.opacity ?? 100;

    if (opts.tintLogo) {
      paints.push(
        buildBrandPaint(
          opts,
          effectiveHex,
          allMappedBox,
          layer.fillRule ?? 1,
          op,
          timeline,
          skipGradient,
        ),
      );
      if (opts.strokeHex && opts.strokeWidth > 0) {
        paints.push(stroke(opts.strokeHex, localOutlineWidth, op));
      }
    } else {
      if (layer.fillHex) {
        paints.push({ ...fill(layer.fillHex, op), r: layer.fillRule ?? 1 });
      }
      if (layer.strokeHex && (layer.strokeWidth ?? 0) > 0) {
        paints.push(
          stroke(
            layer.strokeHex,
            Math.max(0.5, round((layer.strokeWidth ?? 1) * scaleFactor, 2)),
            op,
          ),
        );
      }
      if (opts.strokeHex && opts.strokeWidth > 0) {
        paints.push(stroke(opts.strokeHex, localOutlineWidth, op));
      }
    }

    if (paints.length > 0 && paths.length > 0) {
      groups.push(group(`logo_${i + 1}`, [...paths, ...paints]));
    }
  }

  return groups.reverse();
}

/**
 * Replaces, recolors, outlines, scales, or shifts all brand slots in `doc`
 * with custom text, a custom vector/traced logo, or `[Logo + Text]` side-by-side.
 * If `doc` has no built-in brand slot and `autoCreate !== false`, injects a clean
 * top-level `Бренд-слот` overlay layer so any template can be branded!
 */
export function applyBrandSlot(
  doc: LottieDoc,
  opts: BrandSlotOptions,
  fonts: Font[] | null,
  options?: { keepStickerColor?: boolean; autoCreate?: boolean },
): number {
  let slots = findBrandSlots(doc);
  if (!slots.length) {
    if (options?.autoCreate === false) return 0;
    slots = [createInjectedBrandLayer(doc, opts)];
  } else {
    for (const layer of doc.layers) {
      if (isInjectedBrandLayer(layer)) {
        syncInjectedLayerTransform(doc, layer, opts);
      }
    }
  }

  const injectedSlots = new Set<ShapeItem>();
  for (const layer of doc.layers) {
    if (isInjectedBrandLayer(layer)) {
      for (const sh of layer.shapes ?? []) {
        if (sh.ty === 'gr') injectedSlots.add(sh);
      }
    }
  }

  const prevBrand = readBrandSlotInfo(doc).options;
  const origText = detectOrigText(doc);
  const hasLogo = (opts.mode === 'logo' || opts.mode === 'logo+text') && Boolean(opts.logo);

  for (const gr of slots) {
    const snap = ensureSnapshot(gr, injectedSlots.has(gr));
    const role: BrandSlotRole = snap.role ?? detectSlotRole(gr);
    const aspectX = snap.injected ? 1 : detectSlotAspectX(doc, gr);
    const visW = snap.w * aspectX;
    const timeline = detectSlotTimeline(doc, gr);
    const skipGrad = Boolean(options?.keepStickerColor && !snap.injected);

    const existingItems = gr.it ?? [];
    const trItem = existingItems.find((x) => x.ty === 'tr') ?? groupTransform();
    const otherMods = existingItems.filter(
      (x) => !['sh', 'fl', 'st', 'gf', 'gs', 'tr', 'gr'].includes(x.ty),
    );

    if (role === 'plate') {
      if (opts.hideBuiltInPlate || !opts.plateTextEnabled || opts.hidden) {
        gr.hd = true;
        continue;
      }
      gr.hd = false;
    } else {
      gr.hd = opts.hidden;
    }

    const userScale = Math.max(0.1, opts.scale / 100);
    const dx = (opts.offsetX / 100) * snap.w;
    const dy = (opts.offsetY / 100) * snap.h * 2;
    const effectiveHex =
      options?.keepStickerColor && !snap.injected ? snap.origHex : opts.fillHex;
    const localStrokeWidth = round(opts.strokeWidth * Math.max(0.25, snap.h / 46) * 2, 2);

    // MODE 1: LOGO ONLY
    if (opts.mode === 'logo' && hasLogo && opts.logo) {
      const logo = opts.logo;
      const lCx = logo.minX + logo.width / 2;
      const lCy = logo.minY + logo.height / 2;
      const fitY = Math.min(visW / logo.width, (snap.h * 1.55) / logo.height) * userScale;
      const fitX = fitY / aspectX;

      const logoGroups = buildLogoGroups(
        logo,
        (pt): Vec => [
          (pt[0] - lCx) * fitX + snap.cx + dx,
          (pt[1] - lCy) * fitY + snap.cy + dy,
        ],
        fitY,
        opts,
        effectiveHex,
        localStrokeWidth,
        timeline,
        skipGrad,
      );

      const plate = buildPlateGroup(
        opts.plateStyle,
        snap.cx + dx,
        snap.cy + dy,
        logo.width * fitX,
        logo.height * fitY,
        aspectX,
      );

      gr.nm = 'tier_logo_slot';
      gr.it = [...logoGroups, ...(plate ? [plate] : []), ...otherMods, trItem];
      syncExtrudeShadow(doc, gr, snap, opts, false);
      continue;
    }

    // MODE 2: LOGO + TEXT SIDE-BY-SIDE
    if (opts.mode === 'logo+text' && hasLogo && opts.logo && fonts && opts.text.trim().length > 0) {
      const logo = opts.logo;
      const rawTextPaths = layoutBrandGlyphs(opts.text.trim(), fonts, opts.letterSpacing);
      const tPts = rawTextPaths.flatMap((p) => pathPoints(p));
      if (tPts.length > 0) {
        const tMinX = Math.min(...tPts.map((p) => p[0]));
        const tMaxX = Math.max(...tPts.map((p) => p[0]));
        const tMinY = Math.min(...tPts.map((p) => p[1]));
        const tMaxY = Math.max(...tPts.map((p) => p[1]));
        const tH = Math.max(1, tMaxY - tMinY);
        const tCy = (tMinY + tMaxY) / 2;

        const logoRawScale = (tH * 1.28) / logo.height;
        const logoRawW = logo.width * logoRawScale;
        const logoRawH = logo.height * logoRawScale;
        const gapRaw = (opts.logoGap / 100) * tH * 1.6;

        const combMinX = tMinX - gapRaw - logoRawW;
        const combMaxX = tMaxX;
        const combW = Math.max(1, combMaxX - combMinX);
        const combH = Math.max(tH, logoRawH);
        const combCx = (combMinX + combMaxX) / 2;

        const fitY = Math.min(visW / combW, (snap.h * 1.28) / combH) * userScale;
        const fitX = fitY / aspectX;

        const logoRawCx = combMinX + logoRawW / 2;
        const lOrigCx = logo.minX + logo.width / 2;
        const lOrigCy = logo.minY + logo.height / 2;

        const logoGroups = buildLogoGroups(
          logo,
          (pt): Vec => {
            const rx = (pt[0] - lOrigCx) * logoRawScale + logoRawCx;
            const ry = (pt[1] - lOrigCy) * logoRawScale + tCy;
            return [
              (rx - combCx) * fitX + snap.cx + dx,
              (ry - tCy) * fitY + snap.cy + dy,
            ];
          },
          logoRawScale * fitY,
          opts,
          effectiveHex,
          localStrokeWidth,
          timeline,
          skipGrad,
        );

        for (const p of rawTextPaths) {
          transformPath(p, (pt): Vec => [
            (pt[0] - combCx) * fitX + snap.cx + dx,
            (pt[1] - tCy) * fitY + snap.cy + dy,
          ]);
        }

        const textBox = measurePathsBox(rawTextPaths, {
          minX: snap.cx - 80,
          maxX: snap.cx + 80,
          minY: snap.cy - 20,
          maxY: snap.cy + 20,
        });
        const textFill = buildBrandPaint(
          opts,
          effectiveHex,
          textBox,
          1,
          snap.origOpacity ?? 100,
          timeline,
          skipGrad,
        );
        const textPaints: ShapeItem[] = [textFill];
        if (opts.strokeHex && opts.strokeWidth > 0) {
          textPaints.push(stroke(opts.strokeHex, localStrokeWidth));
        }
        const textGroup = group('tier_text_part', [...rawTextPaths, ...textPaints]);

        const plate = buildPlateGroup(
          opts.plateStyle,
          snap.cx + dx,
          snap.cy + dy,
          combW * fitX,
          combH * fitY,
          aspectX,
        );

        gr.nm = 'tier_logo_slot';
        gr.it = [textGroup, ...logoGroups, ...(plate ? [plate] : []), ...otherMods, trItem];
        syncExtrudeShadow(doc, gr, snap, opts, false);
        continue;
      }
    }

    // MODE 3: TEXT ONLY (or fallback when no logo chosen yet)
    let paths: ShapeItem[] = [];
    const canUseOrig = snap.origShapes.length > 0 && !snap.injected;
    const targetText = role === 'plate'
      ? (opts.syncPlateText ? opts.text : (opts.plateText || 'platega'))
      : (opts.text || (snap.injected ? 'MAGNAT' : ''));
    const isExactOrigName = role === 'plate'
      ? (targetText === 'platega' || targetText === 'USERNAME')
      : (targetText === (snap.injected ? 'MAGNAT' : origText));
    const useOrig = opts.mode === 'text' && canUseOrig && (opts.useOriginalGlyphs || !fonts) && isExactOrigName;

    if (useOrig) {
      paths = structuredClone(snap.origShapes);
      for (const p of paths) {
        p.nm = 'tier_glyph';
        if (userScale !== 1 || dx !== 0 || dy !== 0) {
          transformPath(p, (pt): Vec => [
            (pt[0] - snap.cx) * userScale + snap.cx + dx,
            (pt[1] - snap.cy) * userScale + snap.cy + dy,
          ]);
        }
      }
    } else if (fonts) {
      const trimmed = targetText.trim();
      if (trimmed.length > 0) {
        const rawPaths = layoutBrandGlyphs(trimmed, fonts, opts.letterSpacing);
        const pts = rawPaths.flatMap((p) => pathPoints(p));
        if (pts.length > 0) {
          const minX = Math.min(...pts.map((p) => p[0]));
          const maxX = Math.max(...pts.map((p) => p[0]));
          const minY = Math.min(...pts.map((p) => p[1]));
          const maxY = Math.max(...pts.map((p) => p[1]));
          const rW = Math.max(1, maxX - minX);
          const rH = Math.max(1, maxY - minY);
          const rCx = (minX + maxX) / 2;
          const rCy = (minY + maxY) / 2;
          const fitY = Math.min(visW / rW, (snap.h * (role === 'plate' ? 1.05 : 1.14)) / rH) * userScale;
          const fitX = fitY / aspectX;

          for (const p of rawPaths) {
            transformPath(p, (pt): Vec => [
              (pt[0] - rCx) * fitX + snap.cx + dx,
              (pt[1] - rCy) * fitY + snap.cy + dy,
            ]);
          }
          paths = rawPaths;
        }
      }
    }

    const textBox = measurePathsBox(paths, {
      minX: snap.cx - snap.w / 2,
      maxX: snap.cx + snap.w / 2,
      minY: snap.cy - snap.h / 2,
      maxY: snap.cy + snap.h / 2,
    });
    const fillItem = buildBrandPaint(
      opts,
      effectiveHex,
      textBox,
      useOrig ? snap.origFillRule : 1,
      snap.origOpacity ?? 100,
      timeline,
      skipGrad,
    );

    const paintItems: ShapeItem[] = [fillItem];
    if (opts.strokeHex && opts.strokeWidth > 0) {
      paintItems.push(stroke(opts.strokeHex, localStrokeWidth));
    }

    if (opts.plateStyle !== 'none' && paths.length > 0) {
      const pts = paths.flatMap((p) => pathPoints(p));
      const bMinX = Math.min(...pts.map((p) => p[0]));
      const bMaxX = Math.max(...pts.map((p) => p[0]));
      const bMinY = Math.min(...pts.map((p) => p[1]));
      const bMaxY = Math.max(...pts.map((p) => p[1]));
      const plate = buildPlateGroup(
        opts.plateStyle,
        (bMinX + bMaxX) / 2,
        (bMinY + bMaxY) / 2,
        Math.max(8, bMaxX - bMinX),
        Math.max(6, bMaxY - bMinY),
        aspectX,
      );
      const textGroup = group('tier_text_part', [...paths, ...paintItems]);
      gr.nm = 'tier_logo_slot';
      gr.it = [textGroup, ...(plate ? [plate] : []), ...otherMods, trItem];
    } else {
      gr.nm = snap.injected ? 'tier_logo_slot' : snap.origName ?? 'tier_text';
      gr.it = [...paths, ...otherMods, ...paintItems, trItem];
    }

    const isExactOrig =
      useOrig && opts.gradientId === 'none' && userScale === 1 && dx === 0 && dy === 0;
    syncExtrudeShadow(doc, gr, snap, opts, isExactOrig);
  }

  const plateLayers = findBuiltInPlateLayers(doc);
  for (const pl of plateLayers) {
    pl.hd = Boolean(opts.hideBuiltInPlate);
  }

  const preserveOrigColor =
    Boolean(options?.keepStickerColor) && !doc.layers.some((l) => isInjectedBrandLayer(l));
  doc._brandState = {
    ...opts,
    fillHex: preserveOrigColor ? prevBrand.fillHex : opts.fillHex,
    gradientId: preserveOrigColor ? prevBrand.gradientId : opts.gradientId,
  };
  return slots.length;
}

/**
 * Restores built-in brand slots back to their exact original vector shapes,
 * or removes dynamically injected brand overlay layers from unbranded templates.
 */
export function resetBrandSlot(doc: LottieDoc): number {
  const injectedCount = doc.layers.filter((l) => isInjectedBrandLayer(l)).length;
  if (injectedCount > 0) {
    doc.layers = doc.layers.filter((l) => !isInjectedBrandLayer(l));
    reindexLayers(doc.layers);
    delete doc._brandState;
    return injectedCount;
  }

  const slots = findBrandSlots(doc);
  if (!slots.length) return 0;
  for (const gr of slots) {
    const snap = ensureSnapshot(gr);
    const existingItems = gr.it ?? [];
    const trItem = existingItems.find((x) => x.ty === 'tr') ?? groupTransform();
    const otherMods = existingItems.filter(
      (x) => !['sh', 'fl', 'st', 'gf', 'gs', 'tr', 'gr'].includes(x.ty),
    );
    const fillItem: ShapeItem = {
      ...fill(snap.origHex),
      r: snap.origFillRule,
    };
    if (snap.origOpacity !== undefined) fillItem.o = structuredClone(snap.origOpacity);
    const paints: ShapeItem[] = [fillItem];
    if (snap.origStrokeHex && snap.origStrokeWidth > 0) {
      paints.push(stroke(snap.origStrokeHex, snap.origStrokeWidth));
    }
    const origPaths = structuredClone(snap.origShapes);
    if (snap.origName !== undefined) gr.nm = snap.origName;
    gr.hd = false;
    gr.it = [...origPaths, ...otherMods, ...paints, trItem];

    const shadowGr = findSiblingExtrudeShadow(doc, gr);
    if (shadowGr) {
      shadowGr.hd = false;
      if (shadowGr._extrudeSnap) {
        shadowGr.it = structuredClone((shadowGr._extrudeSnap as ExtrudeShadowSnap).origItems);
      }
    }
  }

  const plateLayers = findBuiltInPlateLayers(doc);
  for (const pl of plateLayers) {
    pl.hd = false;
  }

  delete doc._brandState;
  return slots.length;
}
