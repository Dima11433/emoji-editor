import type { Font } from 'opentype.js';
import type { FontId } from './fonts';
import { fill, groupTransform, rgbToHex, round, stroke, type Layer, type LottieDoc, type ShapeItem, type Vec } from './lottie';
import { commandsToPaths, pathPoints, transformPath } from './text';

export interface BrandSlotOptions {
  text: string;
  useOriginalGlyphs: boolean;
  fontId: FontId;
  fillHex: string;
  strokeHex: string | null;
  strokeWidth: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  letterSpacing: number;
  hidden: boolean;
}

export interface BrandSlotSnapshot {
  cx: number;
  cy: number;
  w: number;
  h: number;
  origHex: string;
  origFillRule: number;
  origOpacity?: unknown;
  origShapes: ShapeItem[];
}

export const DEFAULT_BRAND_OPTIONS: BrandSlotOptions = {
  text: 'MAGNAT',
  useOriginalGlyphs: true,
  fontId: 'montserrat',
  fillHex: '#ffffff',
  strokeHex: null,
  strokeWidth: 4,
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  letterSpacing: 0,
  hidden: false,
};

/** Checks whether a layer, asset, or shape group represents the MAGNAT brand text slot. */
export function isBrandSlotNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const obj = node as Record<string, unknown>;
  if (obj._brandSlot) return true;
  if (obj.nm === 'tier_text' || obj.id === 'mylogo' || obj.refId === 'mylogo') return true;
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
  if (gr._brandSlot) return true;
  const items = gr.it ?? [];
  const hasShapes = items.some((x) => x.ty === 'sh');
  if (!hasShapes) return false;
  return gr.nm === 'tier_text' || items.some((x) => x.ty === 'sh' && x.nm === 'tier_glyph');
}

/** Finds all MAGNAT brand text groups across root layers and nested precomp assets. */
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

function ensureSnapshot(gr: ShapeItem): BrandSlotSnapshot {
  if (gr._brandSlot) return gr._brandSlot as BrandSlotSnapshot;
  const items = gr.it ?? [];
  const shItems = items.filter((x) => x.ty === 'sh');
  const pts = shItems.flatMap((p) => {
    try {
      return pathPoints(p);
    } catch {
      return [];
    }
  });
  let minX = -80;
  let maxX = 80;
  let minY = -20;
  let maxY = 20;
  if (pts.length > 0) {
    minX = Math.min(...pts.map((p) => p[0]));
    maxX = Math.max(...pts.map((p) => p[0]));
    minY = Math.min(...pts.map((p) => p[1]));
    maxY = Math.max(...pts.map((p) => p[1]));
  }
  const fl = items.find((x) => x.ty === 'fl');
  const snap: BrandSlotSnapshot = {
    cx: round((minX + maxX) / 2, 2),
    cy: round((minY + maxY) / 2, 2),
    w: Math.max(8, round(maxX - minX, 2)),
    h: Math.max(6, round(maxY - minY, 2)),
    origHex: readFillColorHex(fl),
    origFillRule: typeof fl?.r === 'number' ? fl.r : 1,
    origOpacity: fl?.o ? structuredClone(fl.o) : undefined,
    origShapes: structuredClone(shItems),
  };
  gr._brandSlot = snap;
  return snap;
}

/** Reads the current brand slot info and options from a Lottie document. */
export function readBrandSlotInfo(doc: LottieDoc): { count: number; options: BrandSlotOptions } {
  const slots = findBrandSlots(doc);
  if (!slots.length) {
    return { count: 0, options: { ...DEFAULT_BRAND_OPTIONS } };
  }
  if (doc._brandState && typeof doc._brandState === 'object') {
    return {
      count: slots.length,
      options: { ...DEFAULT_BRAND_OPTIONS, ...(doc._brandState as Partial<BrandSlotOptions>) },
    };
  }
  const firstFl = (slots[0].it ?? []).find((x) => x.ty === 'fl');
  const origHex = slots[0]._brandSlot
    ? (slots[0]._brandSlot as BrandSlotSnapshot).origHex
    : readFillColorHex(firstFl);
  return {
    count: slots.length,
    options: {
      ...DEFAULT_BRAND_OPTIONS,
      fillHex: origHex,
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

/**
 * Replaces, recolors, outlines, scales, or shifts all MAGNAT brand text slots in `doc`
 * while preserving all animations, parent links, 3D extrusions, and precomp hierarchies.
 */
export function applyBrandSlot(
  doc: LottieDoc,
  opts: BrandSlotOptions,
  fonts: Font[] | null,
  options?: { keepStickerColor?: boolean },
): number {
  const slots = findBrandSlots(doc);
  if (!slots.length) return 0;

  for (const gr of slots) {
    const snap = ensureSnapshot(gr);
    const existingItems = gr.it ?? [];
    const trItem = existingItems.find((x) => x.ty === 'tr') ?? groupTransform();
    const otherMods = existingItems.filter((x) => !['sh', 'fl', 'st', 'gf', 'gs', 'tr'].includes(x.ty));

    gr.hd = opts.hidden;

    const userScale = Math.max(0.1, opts.scale / 100);
    const dx = (opts.offsetX / 100) * snap.w;
    const dy = (opts.offsetY / 100) * snap.h * 2;

    let paths: ShapeItem[] = [];
    const useOrig = opts.useOriginalGlyphs || !fonts;

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
    } else {
      const trimmed = opts.text.trim();
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

    const effectiveHex = options?.keepStickerColor ? snap.origHex : opts.fillHex;
    const fillItem: ShapeItem = {
      ...fill(effectiveHex),
      r: useOrig ? snap.origFillRule : 1,
    };
    if (snap.origOpacity !== undefined) {
      fillItem.o = structuredClone(snap.origOpacity);
    }

    const paintItems: ShapeItem[] = [fillItem];
    if (opts.strokeHex && opts.strokeWidth > 0) {
      const localStrokeWidth = round(opts.strokeWidth * Math.max(0.25, snap.h / 46) * 2, 2);
      paintItems.push(stroke(opts.strokeHex, localStrokeWidth));
    }

    gr.it = [...paths, ...otherMods, ...paintItems, trItem];
  }

  doc._brandState = {
    ...opts,
    fillHex: options?.keepStickerColor ? readBrandSlotInfo(doc).options.fillHex : opts.fillHex,
  };
  return slots.length;
}

/** Restores all MAGNAT brand slots in `doc` back to their exact original vector shapes and colors. */
export function resetBrandSlot(doc: LottieDoc): number {
  const slots = findBrandSlots(doc);
  if (!slots.length) return 0;
  for (const gr of slots) {
    const snap = ensureSnapshot(gr);
    const existingItems = gr.it ?? [];
    const trItem = existingItems.find((x) => x.ty === 'tr') ?? groupTransform();
    const otherMods = existingItems.filter((x) => !['sh', 'fl', 'st', 'gf', 'gs', 'tr'].includes(x.ty));
    const fillItem: ShapeItem = {
      ...fill(snap.origHex),
      r: snap.origFillRule,
    };
    if (snap.origOpacity !== undefined) fillItem.o = structuredClone(snap.origOpacity);
    const origPaths = structuredClone(snap.origShapes);
    gr.hd = false;
    gr.it = [...origPaths, ...otherMods, fillItem, trItem];
  }
  delete doc._brandState;
  return slots.length;
}
