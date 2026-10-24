import type { Font } from 'opentype.js';
import type { FontId } from './fonts';
import type { VectorLogo } from './logoVector';
import {
  CANVAS,
  fill,
  FRAMES,
  group,
  groupTransform,
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

export interface BrandSlotOptions {
  mode: BrandMode;
  text: string;
  useOriginalGlyphs: boolean;
  fontId: FontId;
  fillHex: string;
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
  origName?: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  origHex: string;
  origFillRule: number;
  origOpacity?: unknown;
  origShapes: ShapeItem[];
  injected?: boolean;
}

export const DEFAULT_BRAND_OPTIONS: BrandSlotOptions = {
  mode: 'text',
  text: 'MAGNAT',
  useOriginalGlyphs: true,
  fontId: 'montserrat',
  fillHex: '#ffffff',
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
  const items = gr.it ?? [];
  const hasShapes = items.some((x) => x.ty === 'sh');
  if (!hasShapes) return false;
  return gr.nm === 'tier_text' || items.some((x) => x.ty === 'sh' && x.nm === 'tier_glyph');
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

function collectAllShapes(items: ShapeItem[] | undefined, out: ShapeItem[] = []): ShapeItem[] {
  if (!items) return out;
  for (const it of items) {
    if (it.ty === 'sh') out.push(it);
    else if (it.ty === 'gr' && it.nm !== 'brand_plate') collectAllShapes(it.it, out);
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
  const fl = items.find((x) => x.ty === 'fl');
  const snap: BrandSlotSnapshot = {
    origName: gr.nm,
    cx: parentInjected ? 0 : round((minX + maxX) / 2, 2),
    cy: parentInjected ? 0 : round((minY + maxY) / 2, 2),
    w: parentInjected ? 310 : Math.max(8, round(maxX - minX, 2)),
    h: parentInjected ? 64 : Math.max(6, round(maxY - minY, 2)),
    origHex: readFillColorHex(fl),
    origFillRule: typeof fl?.r === 'number' ? fl.r : 1,
    origOpacity: fl?.o ? structuredClone(fl.o) : undefined,
    origShapes: parentInjected ? [] : structuredClone(directShapes),
    injected: parentInjected,
  };
  gr._brandSlot = snap;
  return snap;
}

/** Reads the current brand slot info and options from a Lottie document. */
export function readBrandSlotInfo(doc: LottieDoc): {
  count: number;
  isInjected: boolean;
  options: BrandSlotOptions;
} {
  const slots = findBrandSlots(doc);
  const hasInjected = doc.layers.some((l) => isInjectedBrandLayer(l));

  if (!slots.length) {
    return {
      count: 0,
      isInjected: false,
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
      options: { ...DEFAULT_BRAND_OPTIONS, ...(doc._brandState as Partial<BrandSlotOptions>) },
    };
  }
  const firstFl = (slots[0].it ?? []).find((x) => x.ty === 'fl');
  const origHex = slots[0]._brandSlot
    ? (slots[0]._brandSlot as BrandSlotSnapshot).origHex
    : readFillColorHex(firstFl);
  return {
    count: slots.length,
    isInjected: hasInjected,
    options: {
      ...DEFAULT_BRAND_OPTIONS,
      fillHex: origHex,
      useOriginalGlyphs: !hasInjected,
      hidden: Boolean(slots[0].hd),
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
): ShapeItem | null {
  if (style === 'none' || contentW <= 0 || contentH <= 0) return null;
  const padX = Math.max(12, contentH * 0.54);
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

function buildLogoGroups(
  logo: VectorLogo,
  mapPt: (pt: Vec) => Vec,
  scaleFactor: number,
  opts: BrandSlotOptions,
  effectiveHex: string,
  localOutlineWidth: number,
): ShapeItem[] {
  const groups: ShapeItem[] = [];

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
      paints.push({ ...fill(effectiveHex, op), r: layer.fillRule ?? 1 });
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

  // Lottie renders group items from end (bottom) to start (top), so reverse DOM painter's order!
  return groups.reverse();
}

/**
 * Replaces, recolors, outlines, scales, or shifts all MAGNAT brand slots in `doc`
 * with custom text, a custom vector/traced logo, or `[Logo + Text]` side-by-side.
 * If `doc` has no built-in MAGNAT slot and `autoCreate !== false`, injects a clean
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

  const hasLogo = (opts.mode === 'logo' || opts.mode === 'logo+text') && Boolean(opts.logo);

  for (const gr of slots) {
    const snap = ensureSnapshot(gr, injectedSlots.has(gr));
    const existingItems = gr.it ?? [];
    const trItem = existingItems.find((x) => x.ty === 'tr') ?? groupTransform();
    const otherMods = existingItems.filter(
      (x) => !['sh', 'fl', 'st', 'gf', 'gs', 'tr', 'gr'].includes(x.ty),
    );

    gr.hd = opts.hidden;

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
      const fitScale = Math.min(snap.w / logo.width, (snap.h * 1.55) / logo.height) * userScale;

      const logoGroups = buildLogoGroups(
        logo,
        (pt): Vec => [
          (pt[0] - lCx) * fitScale + snap.cx + dx,
          (pt[1] - lCy) * fitScale + snap.cy + dy,
        ],
        fitScale,
        opts,
        effectiveHex,
        localStrokeWidth,
      );

      const plate = buildPlateGroup(
        opts.plateStyle,
        snap.cx + dx,
        snap.cy + dy,
        logo.width * fitScale,
        logo.height * fitScale,
      );

      gr.nm = 'tier_logo_slot';
      gr.it = [...logoGroups, ...(plate ? [plate] : []), ...otherMods, trItem];
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

        const fitScale = Math.min(snap.w / combW, (snap.h * 1.28) / combH) * userScale;

        const logoRawCx = combMinX + logoRawW / 2;
        const lOrigCx = logo.minX + logo.width / 2;
        const lOrigCy = logo.minY + logo.height / 2;

        const logoGroups = buildLogoGroups(
          logo,
          (pt): Vec => {
            const rx = (pt[0] - lOrigCx) * logoRawScale + logoRawCx;
            const ry = (pt[1] - lOrigCy) * logoRawScale + tCy;
            return [
              (rx - combCx) * fitScale + snap.cx + dx,
              (ry - tCy) * fitScale + snap.cy + dy,
            ];
          },
          logoRawScale * fitScale,
          opts,
          effectiveHex,
          localStrokeWidth,
        );

        for (const p of rawTextPaths) {
          transformPath(p, (pt): Vec => [
            (pt[0] - combCx) * fitScale + snap.cx + dx,
            (pt[1] - tCy) * fitScale + snap.cy + dy,
          ]);
        }

        const textFill: ShapeItem = { ...fill(effectiveHex), r: 1 };
        if (snap.origOpacity !== undefined) textFill.o = structuredClone(snap.origOpacity);
        const textPaints: ShapeItem[] = [textFill];
        if (opts.strokeHex && opts.strokeWidth > 0) {
          textPaints.push(stroke(opts.strokeHex, localStrokeWidth));
        }
        const textGroup = group('tier_text_part', [...rawTextPaths, ...textPaints]);

        const plate = buildPlateGroup(
          opts.plateStyle,
          snap.cx + dx,
          snap.cy + dy,
          combW * fitScale,
          combH * fitScale,
        );

        gr.nm = 'tier_logo_slot';
        gr.it = [textGroup, ...logoGroups, ...(plate ? [plate] : []), ...otherMods, trItem];
        continue;
      }
    }

    // MODE 3: TEXT ONLY (or fallback when no logo chosen yet)
    let paths: ShapeItem[] = [];
    const canUseOrig = snap.origShapes.length > 0 && !snap.injected;
    const useOrig = opts.mode === 'text' && canUseOrig && (opts.useOriginalGlyphs || !fonts);

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
      const trimmed = (opts.text || (snap.injected ? 'MAGNAT' : '')).trim();
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
          const fitScale = Math.min(snap.w / rW, (snap.h * 1.14) / rH) * userScale;

          for (const p of rawPaths) {
            transformPath(p, (pt): Vec => [
              (pt[0] - rCx) * fitScale + snap.cx + dx,
              (pt[1] - rCy) * fitScale + snap.cy + dy,
            ]);
          }
          paths = rawPaths;
        }
      }
    }

    const fillItem: ShapeItem = {
      ...fill(effectiveHex),
      r: useOrig ? snap.origFillRule : 1,
    };
    if (snap.origOpacity !== undefined) {
      fillItem.o = structuredClone(snap.origOpacity);
    }

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
      );
      const textGroup = group('tier_text_part', [...paths, ...paintItems]);
      gr.nm = 'tier_logo_slot';
      gr.it = [textGroup, ...(plate ? [plate] : []), ...otherMods, trItem];
    } else {
      gr.nm = snap.injected ? 'tier_logo_slot' : snap.origName ?? 'tier_text';
      gr.it = [...paths, ...otherMods, ...paintItems, trItem];
    }
  }

  doc._brandState = {
    ...opts,
    fillHex:
      options?.keepStickerColor && !doc.layers.some((l) => isInjectedBrandLayer(l))
        ? readBrandSlotInfo(doc).options.fillHex
        : opts.fillHex,
  };
  return slots.length;
}

/**
 * Restores built-in MAGNAT brand slots back to their exact original vector shapes,
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
    const origPaths = structuredClone(snap.origShapes);
    if (snap.origName !== undefined) gr.nm = snap.origName;
    gr.hd = false;
    gr.it = [...origPaths, ...otherMods, fillItem, trItem];
  }
  delete doc._brandState;
  return slots.length;
}
