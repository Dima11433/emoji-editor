import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { applyShapeEffects, DEFAULT_EFFECTS, getEffects, layerFamily, type Effects } from './effects';
import type { LottieDoc } from './lottie';
import { buildPixelDoc, type PixelFrame } from './pixelate';
import { TEMPLATES } from './templates';
import { tgsSize } from './tgs';
import { checkTelegram } from './validate';

const withFx = (doc: LottieDoc, patch: Partial<{ [K in keyof Effects]: Partial<Effects[K]> }>) => {
  const fx = getEffects(doc);
  for (const [k, v] of Object.entries(patch)) Object.assign(fx[k as keyof Effects], v);
  return { ...doc, fx };
};

const all = (node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (Array.isArray(node)) node.forEach((n) => all(n, out));
  else if (node && typeof node === 'object') {
    out.push(node as Record<string, unknown>);
    Object.values(node).forEach((v) => all(v, out));
  }
  return out;
};
const ofType = (doc: unknown, ty: string) => all(doc).filter((o) => o.ty === ty);

const heart = () => TEMPLATES.find((t) => t.id === 'heart')!.build(null);
const require = createRequire(import.meta.url);
const rubik = ['cyrillic', 'latin'].map((set) => {
  const buf = readFileSync(require.resolve(`@fontsource/rubik/files/rubik-${set}-800-normal.woff`));
  return parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
});
const board = () => TEMPLATES.find((t) => t.id === 'board')!.build(rubik);

describe('effects', () => {
  it('does nothing and drops fx when everything is off', () => {
    const doc = { ...heart(), fx: DEFAULT_EFFECTS };
    const out = applyShapeEffects(doc);
    expect(out.fx).toBeUndefined();
    expect(out.layers).toEqual(heart().layers);
  });

  it('metal turns fills into animated gradients', () => {
    const out = applyShapeEffects(withFx(heart(), { metal: { on: true } }));
    expect(ofType(out, 'fl')).toHaveLength(0);
    const gf = ofType(out, 'gf');
    expect(gf).toHaveLength(2);
    const keys = (gf[0].g as { p: number; k: { a: number; k: { s: number[] }[] } }).k;
    expect(keys.a).toBe(1);
    for (const key of keys.k) {
      expect(key.s).toHaveLength(20);
      const offsets = [0, 4, 8, 12, 16].map((i) => key.s[i]);
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    }
  });

  it('hologram animates colors but keeps dark outlines', () => {
    const doc = board();
    const out = applyShapeEffects(withFx(doc, { hologram: { on: true } }));
    const fills = ofType(out, 'fl');
    const white = fills.find((f) => (f.c as { a: number }).a === 1);
    expect(white).toBeTruthy();
    const ink = ofType(out, 'st').find((s) => (s.c as { a: number }).a === 1);
    const firstKey = (ink!.c as { k: { s: number[] }[] }).k[0].s;
    expect(firstKey.slice(0, 3).every((x) => x < 0.3)).toBe(true);
  });

  it('metal and hologram can be combined', () => {
    const out = applyShapeEffects(withFx(heart(), { metal: { on: true }, hologram: { on: true } }));
    expect(ofType(out, 'gf').length).toBeGreaterThan(0);
  });

  it('glitch adds tinted copies with valid parent links', () => {
    const doc = board();
    const out = applyShapeEffects(withFx(doc, { glitch: { on: true } }));
    const inds = new Set(out.layers.map((l) => l.ind));
    expect(inds.size).toBe(out.layers.length);
    for (const l of out.layers) if (l.parent !== undefined) expect(inds.has(l.parent)).toBe(true);
    // 2 originals + 2 tinted copies of each + 3 nulls (two copy sets, one shake)
    expect(out.layers).toHaveLength(2 + 4 + 3);
    expect(out.layers.filter((l) => l.ty === 3)).toHaveLength(3);
  });

  it('glitch on one layer copies its children too', () => {
    const doc = board();
    const boardInd = doc.layers.find((l) => l.nm === 'Табличка')!.ind!;
    expect(layerFamily(doc.layers, boardInd)).toHaveLength(2);
    const textInd = doc.layers.find((l) => l.parent === boardInd)!.ind!;
    expect(layerFamily(doc.layers, textInd)).toHaveLength(1);
  });

  for (const t of TEMPLATES) {
    it(`${t.name} with all shape effects still passes Telegram checks`, () => {
      const doc = withFx(t.build(rubik), { metal: { on: true }, hologram: { on: true }, glitch: { on: true } });
      const out = applyShapeEffects(doc);
      expect(checkTelegram(out, tgsSize(out)).filter((c) => c.status !== 'ok')).toEqual([]);
    });
  }
});

describe('pixelate', () => {
  const grid = 8;
  const frame = (n: number, paint: (x: number, y: number) => number[] | null): PixelFrame => {
    const data = new Uint8ClampedArray(grid * grid * 4);
    for (let y = 0; y < grid; y++)
      for (let x = 0; x < grid; x++) {
        const c = paint(x, y);
        if (c) data.set([...c, 255], (y * grid + x) * 4);
      }
    return { frame: n, data };
  };

  it('merges pixels into rectangles and identical frames into one slot', () => {
    const square = (x: number, y: number) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? [255, 0, 0] : null);
    const moved = (x: number, y: number) => (x >= 3 && x < 7 && y >= 2 && y < 6 ? [255, 0, 0] : null);
    const doc = buildPixelDoc(heart(), [frame(0, square), frame(4, square), frame(8, moved)], grid);
    expect(doc.layers).toHaveLength(2);
    expect(doc.layers[0].ip).toBe(0);
    expect(doc.layers[0].op).toBe(8);
    expect(doc.layers[1].op).toBe(180);
    expect(ofType(doc.layers[0], 'rc')).toHaveLength(1);
    const rc = ofType(doc.layers[0], 'rc')[0];
    expect((rc.p as { k: number[] }).k).toEqual([256, 256]);
    expect((rc.s as { k: number[] }).k).toEqual([256.6, 256.6]);
  });

  it('limits the palette', () => {
    const noisy = (x: number, y: number) => [x * 32, y * 32, 0];
    const doc = buildPixelDoc(heart(), [frame(0, noisy)], grid, 5);
    expect(ofType(doc, 'fl')).toHaveLength(5);
  });
});
