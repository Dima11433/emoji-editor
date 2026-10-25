import { isBrandSlotNode } from './brandSlot';
import { rgbToHex, hexToRgb } from './lottie';

/** Returns a new hex for a color, or null to leave it as is. */
export type ColorMapper = (hex: string) => string | null;

export interface MapColorOptions {
  /** When true, skips brand slot nodes so recoloring a template leaves custom logos/nicknames intact. */
  skipBrandSlot?: boolean;
}

/**
 * Visits every color in a Lottie subtree: fills, strokes, gradients and solid
 * layers, static or animated. The mapper may replace colors in place.
 */
export function mapColors(node: unknown, mapper: ColorMapper, opts?: MapColorOptions): void {
  if (Array.isArray(node)) {
    node.forEach((child) => mapColors(child, mapper, opts));
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (opts?.skipBrandSlot && isBrandSlotNode(node)) return;

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
    if (key !== 'c' && value && typeof value === 'object') mapColors(value, mapper, opts);
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

export function shiftHue(node: unknown, degrees: number, opts?: MapColorOptions): void {
  mapColors(
    node,
    (hex) => {
      const [h, s, l] = hexToHsl(hex);
      return hslToHex((h + degrees + 360) % 360, s, l);
    },
    opts,
  );
}

export function adjustLightSat(
  node: unknown,
  dSat: number,
  dLight: number,
  opts?: MapColorOptions,
): void {
  mapColors(
    node,
    (hex) => {
      const [h, s, l] = hexToHsl(hex);
      if (l > 0.97 || l < 0.03) return null;
      const nextS = s < 0.04 && dSat <= 0 ? s : Math.max(0, Math.min(1, s + dSat));
      const nextL = Math.max(0.04, Math.min(0.97, l + dLight));
      return hslToHex(h, nextS, nextL);
    },
    opts,
  );
}

export function grayscale(node: unknown, opts?: MapColorOptions): void {
  mapColors(
    node,
    (hex) => {
      const [r, g, b] = hexToRgb(hex);
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      return rgbToHex([y, y, y]);
    },
    opts,
  );
}

export function invert(node: unknown, opts?: MapColorOptions): void {
  mapColors(
    node,
    (hex) => rgbToHex(hexToRgb(hex).slice(0, 3).map((x) => 1 - x)),
    opts,
  );
}

export type ColorThemeId =
  | 'gold'
  | 'emerald'
  | 'ruby'
  | 'violet'
  | 'cyber'
  | 'orange'
  | 'cyan'
  | 'blue'
  | 'silver';

export interface ColorThemeSpec {
  id: ColorThemeId;
  label: string;
  swatch: string;
  hue: number;
  hueSpread: number;
  satScale: number;
  satBoost: number;
  lightScale: number;
  lightLift: number;
  silver?: boolean;
}

export const COLOR_THEMES: ColorThemeSpec[] = [
  {
    id: 'gold',
    label: 'Золото',
    swatch: '#fbbf24',
    hue: 43,
    hueSpread: 26,
    satScale: 0.95,
    satBoost: 0.12,
    lightScale: 1.02,
    lightLift: 0.02,
  },
  {
    id: 'emerald',
    label: 'Изумруд',
    swatch: '#10b981',
    hue: 152,
    hueSpread: -24,
    satScale: 0.92,
    satBoost: 0.08,
    lightScale: 1.0,
    lightLift: 0,
  },
  {
    id: 'ruby',
    label: 'Рубин',
    swatch: '#f43f5e',
    hue: 350,
    hueSpread: 24,
    satScale: 0.95,
    satBoost: 0.1,
    lightScale: 1.0,
    lightLift: 0.01,
  },
  {
    id: 'violet',
    label: 'Фиолет',
    swatch: '#8b5cf6',
    hue: 270,
    hueSpread: 28,
    satScale: 0.95,
    satBoost: 0.1,
    lightScale: 1.0,
    lightLift: 0.01,
  },
  {
    id: 'cyber',
    label: 'Неон Роза',
    swatch: '#ec4899',
    hue: 320,
    hueSpread: 28,
    satScale: 0.96,
    satBoost: 0.12,
    lightScale: 1.01,
    lightLift: 0.01,
  },
  {
    id: 'orange',
    label: 'Пламя',
    swatch: '#f97316',
    hue: 22,
    hueSpread: 34,
    satScale: 0.98,
    satBoost: 0.12,
    lightScale: 1.01,
    lightLift: 0.01,
  },
  {
    id: 'cyan',
    label: 'Лёд',
    swatch: '#06b6d4',
    hue: 191,
    hueSpread: -22,
    satScale: 0.94,
    satBoost: 0.08,
    lightScale: 1.02,
    lightLift: 0.01,
  },
  {
    id: 'blue',
    label: 'TG Синий',
    swatch: '#3b82f6',
    hue: 220,
    hueSpread: -28,
    satScale: 0.96,
    satBoost: 0.08,
    lightScale: 1.0,
    lightLift: 0,
  },
  {
    id: 'silver',
    label: 'Серебро',
    swatch: '#cbd5e1',
    hue: 215,
    hueSpread: 0,
    satScale: 0.12,
    satBoost: 0,
    lightScale: 1.06,
    lightLift: 0.05,
    silver: true,
  },
];

/**
 * Remaps all chromatic fills and 3D gradient stops to a cohesive color theme
 * while preserving specular white highlights and deep dark outlines.
 */
export function applyColorTheme(
  node: unknown,
  themeId: ColorThemeId,
  opts?: MapColorOptions,
): void {
  const theme = COLOR_THEMES.find((t) => t.id === themeId);
  if (!theme) return;

  mapColors(
    node,
    (hex) => {
      const [h, s, l] = hexToHsl(hex);
      // Keep pure white specular highlights & deep dark ink untouched
      if (l > 0.96 || (s < 0.06 && l > 0.88) || l < 0.05) return null;

      if (theme.silver) {
        if (s < 0.06 && l < 0.35) return null;
        const sl = Math.max(0.08, Math.min(0.95, l * theme.lightScale + theme.lightLift));
        return hslToHex(theme.hue, Math.max(0.065, Math.min(0.11, s * theme.satScale + 0.065)), sl);
      }

      // Leave neutral dark grays (e.g. shadows/eyes) neutral if saturation is near zero
      if (s < 0.06 && l < 0.35) return null;

      const midBell = 1 - Math.abs(2 * l - 1);
      const nextH = (((theme.hue + (l - 0.5) * theme.hueSpread) % 360) + 360) % 360;
      const nextS = Math.max(0.16, Math.min(1, s * theme.satScale + theme.satBoost * midBell));
      const nextL = Math.max(0.06, Math.min(0.95, l * theme.lightScale + theme.lightLift));
      void h;
      return hslToHex(nextH, nextS, nextL);
    },
    opts,
  );
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
