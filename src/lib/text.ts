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
  type TransformInput,
  type Vec,
} from './lottie';

/** Telegram does not render Lottie text layers, so text is turned into shapes. */

export type TextAnimation = 'none' | 'pulse' | 'float' | 'swing' | 'pop' | 'wave' | 'shake';

export const TEXT_ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'Без анимации' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'float', label: 'Левитация' },
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
  ip?: number;
  op?: number;
}

interface GlyphShape {
  char: string;
  paths: ShapeItem[];
}

export function textToLayer(opts: TextOptions): Layer {
  const glyphs = layout(opts);
  if (!glyphs.length) throw new Error('В тексте нет символов, которые есть в шрифте.');

  const ip = opts.ip ?? 0;
  const op = opts.op ?? FRAMES;

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
  for (const g of glyphs) {
    for (const p of g.paths) {
      transformPath(p, (pt) => [(pt[0] - cx) * scale, (pt[1] - cy) * scale]);
    }
  }

  const paint = (): ShapeItem[] => {
    const items = [fill(opts.fillHex)];
    if (opts.strokeHex && opts.strokeWidth > 0) items.push(stroke(opts.strokeHex, opts.strokeWidth * 2));
    return items;
  };

  const letters = glyphs.map((g, idx) => {
    const tr = opts.animation === 'wave' ? waveOffset(idx, glyphs.length, ip, op) : {};
    return group(g.char === ' ' ? 'Пробел' : g.char, [...g.paths, ...paint()], tr);
  });

  const layer = shapeLayer(
    `Текст «${opts.text.trim()}»`,
    letters,
    buildSlotLayerAnimation(opts.animation, [opts.x, opts.y, 0], ip, op),
  );
  layer.ip = ip;
  layer.op = op;
  return layer;
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

export function commandsToPaths(commands: PathCommand[]): ShapeItem[] {
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

export function pathPoints(p: ShapeItem): Vec[] {
  return pathData(p).v;
}

export function transformPath(p: ShapeItem, fn: (pt: Vec) => Vec) {
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

function waveOffset(idx: number, count: number, ip: number, op: number) {
  const dur = Math.max(36, op - ip);
  const usable = Math.max(12, dur - 36);
  const step = Math.min(10, Math.floor((usable * 0.7) / Math.max(1, count)));
  const t0 = ip + Math.round(dur * 0.06) + idx * step;
  const tMid = Math.min(op - 2, t0 + 12);
  const tEnd = Math.min(op - 1, t0 + 24);
  return {
    p: anim([
      [ip, [0, 0]],
      [t0, [0, 0]],
      [tMid, [0, -28]],
      [tEnd, [0, 0]],
      [op, [0, 0]],
    ]),
  };
}

/** Builds layer transform keyframes mapped cleanly onto `[ip .. op]`. */
export function buildSlotLayerAnimation(
  kind: TextAnimation,
  basePos: [number, number, number],
  ip = 0,
  op = FRAMES,
): TransformInput {
  const dur = Math.max(12, op - ip);
  const at = (frac: number) => Math.round(ip + dur * frac);
  const [bx, by, bz] = basePos;

  switch (kind) {
    case 'pulse':
      return {
        p: fixed([bx, by, bz]),
        s: anim([
          [ip, [100, 100, 100]],
          [at(1 / 6), [110, 110, 100]],
          [at(2 / 6), [100, 100, 100]],
          [at(3 / 6), [110, 110, 100]],
          [at(4 / 6), [100, 100, 100]],
          [at(5 / 6), [110, 110, 100]],
          [op, [100, 100, 100]],
        ]),
      };
    case 'float':
      return {
        p: anim([
          [ip, [bx, by, bz]],
          [at(0.25), [bx, by - 11, bz]],
          [at(0.5), [bx, by, bz]],
          [at(0.75), [bx, by - 11, bz]],
          [op, [bx, by, bz]],
        ]),
      };
    case 'swing':
      return {
        p: fixed([bx, by, bz]),
        r: anim([
          [ip, -5.5],
          [at(0.5), 5.5],
          [op, -5.5],
        ]),
      };
    case 'pop': {
      const t1 = Math.min(op - 3, ip + Math.min(14, Math.round(dur * 0.12)));
      const t2 = Math.min(op - 2, ip + Math.min(22, Math.round(dur * 0.2)));
      const t3 = Math.min(op - 1, ip + Math.min(30, Math.round(dur * 0.28)));
      const tFade = Math.min(op - 1, ip + Math.min(8, Math.round(dur * 0.08)));
      return {
        p: fixed([bx, by, bz]),
        s: anim([
          [ip, [0, 0, 100]],
          [t1, [116, 116, 100]],
          [t2, [95, 95, 100]],
          [t3, [100, 100, 100]],
          [op, [100, 100, 100]],
        ]),
        o: anim([
          [ip, 0],
          [tFade, 100],
          [op, 100],
        ]),
      };
    }
    case 'shake': {
      const keys: [number, number][] = [];
      for (let t = ip; t <= op; t += 6) {
        keys.push([t, t === ip || t >= op - 5 ? 0 : (t - ip) % 12 === 0 ? -4 : 4]);
      }
      if (keys[keys.length - 1]?.[0] !== op) keys.push([op, 0]);
      return {
        p: fixed([bx, by, bz]),
        r: anim(keys, 'linear'),
      };
    }
    default:
      return { p: fixed([bx, by, bz]) };
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
