import type { Font, PathCommand } from 'opentype.js';
import {
  anim,
  bezierPath,
  CANVAS,
  fill,
  fixed,
  FRAMES,
  group,
  round,
  shapeLayer,
  stroke,
  type Layer,
  type Segment,
  type ShapeItem,
  type Vec,
} from './lottie';

/** Telegram does not render Lottie text layers, so text is turned into shapes. */

export type TextAnimation = 'none' | 'pulse' | 'swing' | 'pop' | 'wave' | 'shake';

export const TEXT_ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'Без анимации' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'swing', label: 'Качание' },
  { id: 'pop', label: 'Появление' },
  { id: 'wave', label: 'Волна по буквам' },
  { id: 'shake', label: 'Тряска' },
];

export interface TextOptions {
  text: string;
  /** Fonts tried in order for each character (e.g. Cyrillic set, then Latin set). */
  fonts: Font[];
  size: number;
  fillHex: string;
  strokeHex: string | null;
  strokeWidth: number;
  x: number;
  y: number;
  maxWidth: number;
  animation: TextAnimation;
}

interface GlyphShape {
  char: string;
  paths: ShapeItem[];
}

export function textToLayer(opts: TextOptions): Layer {
  const glyphs = layout(opts);
  if (!glyphs.length) throw new Error('В тексте нет символов, которые есть в шрифте.');

  const points = glyphs.flatMap((g) => g.paths.flatMap((p) => pathPoints(p)));
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const width = maxX - minX;
  const scale = width > opts.maxWidth ? opts.maxWidth / width : 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Center the outlines around (0, 0) and fit them to maxWidth.
  for (const g of glyphs) for (const p of g.paths) transformPath(p, (pt) => [(pt[0] - cx) * scale, (pt[1] - cy) * scale]);

  const paint = (): ShapeItem[] => {
    const items = [fill(opts.fillHex)];
    if (opts.strokeHex && opts.strokeWidth > 0) items.push(stroke(opts.strokeHex, opts.strokeWidth * 2));
    return items;
  };

  const letters = glyphs.map((g, idx) => {
    const tr = opts.animation === 'wave' ? waveOffset(idx, glyphs.length) : {};
    return group(g.char === ' ' ? 'Пробел' : g.char, [...g.paths, ...paint()], tr);
  });

  return shapeLayer(`Текст «${opts.text.trim()}»`, letters, {
    p: fixed([opts.x, opts.y, 0]),
    ...layerAnimation(opts.animation),
  });
}

function layout(opts: TextOptions): GlyphShape[] {
  const out: GlyphShape[] = [];
  let x = 0;
  for (const char of [...opts.text]) {
    const font = opts.fonts.find((f) => f.charToGlyphIndex(char) > 0) ?? opts.fonts[0];
    const glyph = font.charToGlyph(char);
    const advance = ((glyph.advanceWidth ?? font.unitsPerEm * 0.5) * opts.size) / font.unitsPerEm;
    const paths = commandsToPaths(glyph.getPath(x, 0, opts.size).commands);
    if (paths.length) out.push({ char, paths });
    x += advance;
  }
  return out;
}

function commandsToPaths(commands: PathCommand[]): ShapeItem[] {
  const paths: ShapeItem[] = [];
  let start: Vec | null = null;
  let prev: Vec = [0, 0];
  let segs: Segment[] = [];
  const flush = (closed: boolean) => {
    if (start && segs.length) paths.push(bezierPath(start, segs, closed));
    start = null;
    segs = [];
  };
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      flush(true);
      start = [cmd.x, cmd.y];
      prev = start;
    } else if (cmd.type === 'L') {
      // A line is a cubic with both controls on its ends (zero tangents).
      segs.push([prev, [cmd.x, cmd.y], [cmd.x, cmd.y]]);
      prev = [cmd.x, cmd.y];
    } else if (cmd.type === 'C') {
      segs.push([[cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y]]);
      prev = [cmd.x, cmd.y];
    } else if (cmd.type === 'Q') {
      const end: Vec = [cmd.x, cmd.y];
      const c1: Vec = [prev[0] + (2 / 3) * (cmd.x1 - prev[0]), prev[1] + (2 / 3) * (cmd.y1 - prev[1])];
      const c2: Vec = [end[0] + (2 / 3) * (cmd.x1 - end[0]), end[1] + (2 / 3) * (cmd.y1 - end[1])];
      segs.push([c1, c2, end]);
      prev = end;
    } else if (cmd.type === 'Z') {
      flush(true);
    }
  }
  flush(true);
  return paths;
}

interface PathData {
  i: Vec[];
  o: Vec[];
  v: Vec[];
}

const pathData = (p: ShapeItem) => (p.ks as { k: PathData }).k;

function pathPoints(p: ShapeItem): Vec[] {
  return pathData(p).v;
}

function transformPath(p: ShapeItem, fn: (pt: Vec) => Vec) {
  const d = pathData(p);
  const scaleOnly = (t: Vec): Vec => {
    const a = fn([0, 0]);
    const b = fn(t);
    return [round(b[0] - a[0], 1), round(b[1] - a[1], 1)];
  };
  d.v = d.v.map((pt) => fn(pt).map((x) => round(x, 1)) as Vec);
  d.i = d.i.map(scaleOnly);
  d.o = d.o.map(scaleOnly);
}

function waveOffset(idx: number, count: number) {
  const step = Math.min(10, Math.floor(100 / Math.max(1, count)));
  const t0 = 10 + idx * step;
  return {
    p: anim([
      [0, [0, 0]],
      [t0, [0, 0]],
      [t0 + 12, [0, -28]],
      [t0 + 24, [0, 0]],
      [FRAMES, [0, 0]],
    ]),
  };
}

function layerAnimation(kind: TextAnimation) {
  switch (kind) {
    case 'pulse':
      return {
        s: anim([
          [0, [100, 100, 100]],
          [30, [112, 112, 100]],
          [60, [100, 100, 100]],
          [90, [112, 112, 100]],
          [120, [100, 100, 100]],
          [150, [112, 112, 100]],
          [FRAMES, [100, 100, 100]],
        ]),
      };
    case 'swing':
      return { r: anim([[0, -7], [90, 7], [FRAMES, -7]]) };
    case 'pop':
      return {
        s: anim([
          [0, [0, 0, 100]],
          [14, [118, 118, 100]],
          [22, [94, 94, 100]],
          [30, [100, 100, 100]],
          [FRAMES, [100, 100, 100]],
        ]),
        o: anim([[0, 0], [8, 100], [FRAMES, 100]]),
      };
    case 'shake': {
      const keys: [number, number][] = [];
      for (let t = 0; t <= FRAMES; t += 6) keys.push([t, t === 0 || t === FRAMES ? 0 : t % 12 === 0 ? -4 : 4]);
      return { r: anim(keys, 'linear') };
    }
    default:
      return {};
  }
}

export const DEFAULT_TEXT: Omit<TextOptions, 'fonts' | 'text'> = {
  size: 120,
  fillHex: '#ffffff',
  strokeHex: '#1b1b2f',
  strokeWidth: 8,
  x: CANVAS / 2,
  y: CANVAS / 2,
  maxWidth: 440,
  animation: 'none',
};
