import { emptyDoc, fill, fixed, group, shapeLayer, type LottieDoc, type ShapeItem } from './lottie';

/**
 * Pixelation bakes the animation: frames are rendered to a small grid in the
 * browser (pixelSample.ts) and every frame becomes a layer of square pixels
 * that is visible only for its own time slot.
 */

export interface PixelFrame {
  /** Frame number in the document's timeline. */
  frame: number;
  /** RGBA pixels, grid × grid. */
  data: Uint8ClampedArray;
}

const ALPHA_CUTOFF = 110;

export function buildPixelDoc(base: LottieDoc, frames: PixelFrame[], grid: number, maxColors = 24): LottieDoc {
  const cell = base.w / grid;
  const palette = buildPalette(frames, maxColors);

  // Cells hold a palette index or -1 for transparent.
  const cellsOf = (data: Uint8ClampedArray) => {
    const cells = new Int16Array(grid * grid).fill(-1);
    for (let p = 0; p < grid * grid; p++) {
      if (data[p * 4 + 3] >= ALPHA_CUTOFF) cells[p] = palette.indexOf(quantKey(data, p));
    }
    return cells;
  };

  // Merge runs of identical frames into one slot.
  const slots: { start: number; cells: Int16Array }[] = [];
  let prevSig = '';
  for (const f of frames) {
    const cells = cellsOf(f.data);
    const sig = cells.join(',');
    if (sig !== prevSig) slots.push({ start: f.frame, cells });
    prevSig = sig;
  }

  const doc = emptyDoc(base.nm ?? 'Пиксели');
  Object.assign(doc, { fr: base.fr, ip: base.ip, op: base.op, w: base.w, h: base.h });
  slots.forEach((slot, n) => {
    const end = slots[n + 1]?.start ?? base.op;
    const groups: ShapeItem[] = [];
    palette.colors.forEach((hex, colorIdx) => {
      const rects = mergeRects(slot.cells, grid, colorIdx);
      if (!rects.length) return;
      const items = rects.map(({ x, y, w, h }) => ({
        ty: 'rc',
        d: 1,
        // A small overlap hides hairline gaps between neighbouring pixels.
        p: fixed([round1((x + w / 2) * cell), round1((y + h / 2) * cell)]),
        s: fixed([round1(w * cell + 0.6), round1(h * cell + 0.6)]),
        r: fixed(0),
      }));
      groups.push(group(hex, [...items, fill(hex)]));
    });
    const layer = shapeLayer(`Кадр ${slot.start}`, groups, { p: fixed([0, 0, 0]) });
    layer.ip = slot.start;
    layer.op = end;
    layer.ind = n + 1;
    doc.layers.push(layer);
  });
  // Lottie draws the first layer on top; slots never overlap in time, so order does not matter.
  return doc;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** 4 bits per channel, packed into one number. */
function quantKey(data: Uint8ClampedArray, p: number): number {
  return ((data[p * 4] >> 4) << 8) | ((data[p * 4 + 1] >> 4) << 4) | (data[p * 4 + 2] >> 4);
}

interface Palette {
  colors: string[];
  indexOf: (key: number) => number;
}

/** Keeps the most used colors and maps the rest to the nearest kept one. */
function buildPalette(frames: PixelFrame[], maxColors: number): Palette {
  const counts = new Map<number, number>();
  for (const f of frames) {
    for (let p = 0; p * 4 < f.data.length; p++) {
      if (f.data[p * 4 + 3] < ALPHA_CUTOFF) continue;
      const k = quantKey(f.data, p);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const kept = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors).map(([k]) => k);
  const parts = (k: number) => [(k >> 8) & 15, (k >> 4) & 15, k & 15];
  const cache = new Map<number, number>();
  const indexOf = (key: number) => {
    let idx = cache.get(key);
    if (idx === undefined) {
      const [r, g, b] = parts(key);
      let best = Infinity;
      idx = 0;
      kept.forEach((k, n) => {
        const [r2, g2, b2] = parts(k);
        const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
        if (d < best) {
          best = d;
          idx = n;
        }
      });
      cache.set(key, idx);
    }
    return idx;
  };
  const colors = kept.map((k) => '#' + parts(k).map((v) => (v * 17).toString(16).padStart(2, '0')).join(''));
  return { colors, indexOf };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Covers all cells of one color with as few rectangles as a simple row merge allows. */
function mergeRects(cells: Int16Array, grid: number, color: number): Rect[] {
  const done: Rect[] = [];
  let open = new Map<string, Rect>();
  for (let y = 0; y < grid; y++) {
    const next = new Map<string, Rect>();
    let x = 0;
    while (x < grid) {
      if (cells[y * grid + x] !== color) {
        x++;
        continue;
      }
      const start = x;
      while (x < grid && cells[y * grid + x] === color) x++;
      const key = `${start},${x - start}`;
      const above = open.get(key);
      if (above) {
        above.h++;
        next.set(key, above);
        open.delete(key);
      } else {
        next.set(key, { x: start, y, w: x - start, h: 1 });
      }
    }
    done.push(...open.values());
    open = next;
  }
  done.push(...open.values());
  return done;
}
