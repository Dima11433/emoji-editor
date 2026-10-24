import { rgbToHex, hexToRgb } from './lottie';

/** Returns a new hex for a color, or null to leave it as is. */
export type ColorMapper = (hex: string) => string | null;

/**
 * Visits every color in a Lottie subtree: fills, strokes, gradients and solid
 * layers, static or animated. The mapper may replace colors in place.
 */
export function mapColors(node: unknown, mapper: ColorMapper): void {
  if (Array.isArray(node)) {
    node.forEach((child) => mapColors(child, mapper));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if ((obj.ty === 'fl' || obj.ty === 'st') && isProp(obj.c)) {
    mapProp(obj.c, (value) => mapRgb(value, 0, mapper));
  }
  if ((obj.ty === 'gf' || obj.ty === 'gs') && obj.g && typeof obj.g === 'object') {
    const g = obj.g as { p?: number; k?: unknown };
    const stops = typeof g.p === 'number' ? g.p : 0;
    if (isProp(g.k)) {
      mapProp(g.k, (value) => {
        for (let s = 0; s < stops; s++) mapRgb(value, s * 4 + 1, mapper);
      });
    }
  }
  if (obj.ty === 1 && typeof obj.sc === 'string') {
    const next = mapper(normalize(obj.sc));
    if (next) obj.sc = next;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key !== 'c' && value && typeof value === 'object') mapColors(value, mapper);
  }
}

export interface PaletteEntry {
  hex: string;
  count: number;
}

export function collectColors(node: unknown): PaletteEntry[] {
  const counts = new Map<string, number>();
  mapColors(node, (hex) => {
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
    return null;
  });
  return [...counts.entries()].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count);
}

export function replaceColor(node: unknown, from: string, to: string): void {
  const target = normalize(from);
  mapColors(node, (hex) => (hex === target ? normalize(to) : null));
}

export function shiftHue(node: unknown, degrees: number): void {
  mapColors(node, (hex) => {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex((h + degrees + 360) % 360, s, l);
  });
}

export function grayscale(node: unknown): void {
  mapColors(node, (hex) => {
    const [r, g, b] = hexToRgb(hex);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    return rgbToHex([y, y, y]);
  });
}

export function invert(node: unknown): void {
  mapColors(node, (hex) => rgbToHex(hexToRgb(hex).slice(0, 3).map((x) => 1 - x)));
}

const isProp = (p: unknown): p is { a?: number; k: unknown } => !!p && typeof p === 'object' && 'k' in p;

/** Runs fn on each concrete value of a property (one if static, one per keyframe if animated). */
function mapProp(prop: { a?: number; k: unknown }, fn: (value: number[]) => void) {
  const k = prop.k;
  if (Array.isArray(k) && typeof k[0] === 'number') {
    fn(k as number[]);
    return;
  }
  if (Array.isArray(k)) {
    for (const key of k as Record<string, unknown>[]) {
      if (Array.isArray(key?.s)) fn(key.s as number[]);
      if (Array.isArray(key?.e)) fn(key.e as number[]);
    }
  }
}

function mapRgb(value: number[], offset: number, mapper: ColorMapper) {
  if (value.length < offset + 3) return;
  const rgb = value.slice(offset, offset + 3);
  const next = mapper(rgbToHex(rgb));
  if (!next) return;
  const scale = rgb.some((x) => x > 1) ? 255 : 1;
  const [r, g, b] = hexToRgb(next);
  value[offset] = round4(r * scale);
  value[offset + 1] = round4(g * scale);
  value[offset + 2] = round4(b * scale);
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;
const normalize = (hex: string) => rgbToHex(hexToRgb(hex));

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([r + m, g + m, b + m]);
}
