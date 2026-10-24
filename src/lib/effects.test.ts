import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyShapeEffects, DEFAULT_EFFECTS, getEffects, layerFamily, type Effects } from './effects';
import { emptyDoc, type LottieDoc } from './lottie';
import { buildPixelDoc, type PixelFrame } from './pixelate';
import { parseSticker, tgsSize } from './tgs';
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

const loadMagnat = (rel: string) =>
  parseSticker(new Uint8Array(readFileSync(resolve(process.cwd(), 'public', rel))));

describe('effects on MAGNAT stickers', () => {
  it('does nothing and drops fx when everything is off', () => {
    const base = loadMagnat('templates/classic/001.tgs');
    const doc = { ...structuredClone(base), fx: DEFAULT_EFFECTS };
    const out = applyShapeEffects(doc);
    expect(out.fx).toBeUndefined();
    expect(out.layers).toEqual(base.layers);
  });

  it('metal turns nested precomp fills into animated metallic gradients', () => {
    const base = loadMagnat('templates/love/001.tgs');
    const out = applyShapeEffects(withFx(base, { metal: { on: true } }));
    const gf = ofType(out, 'gf');
    expect(gf.length).toBeGreaterThan(0);
    const keys = (gf[0].g as { p: number; k: { a: number; k: { s: number[] }[] } }).k;
    expect(keys.a).toBe(1);
  });

  it('hologram animates colors across nested precomps while preserving dark outlines', () => {
    const base = loadMagnat('templates/characters/001.tgs');
    const out = applyShapeEffects(withFx(base, { hologram: { on: true } }));
    const animatedFills = ofType(out, 'fl').filter((f) => (f.c as { a?: number })?.a === 1);
    expect(animatedFills.length).toBeGreaterThan(0);
  });

  it('glitch clones transitive precomp assets with valid parent links', () => {
    const base = loadMagnat('templates/gifts/001.tgs');
    const out = applyShapeEffects(withFx(base, { glitch: { on: true } }));
    const inds = new Set(out.layers.map((l) => l.ind));
    expect(inds.size).toBe(out.layers.length);
    for (const l of out.layers) {
      if (l.parent !== undefined) expect(inds.has(l.parent)).toBe(true);
    }
    expect((out.assets ?? []).some((a) => a.id.includes('_glitch_'))).toBe(true);
    expect(checkTelegram(out, tgsSize(out)).filter((c) => c.id !== 'size' && c.status === 'error')).toEqual([]);
  });

  it('layerFamily includes child layers recursively', () => {
    const doc = emptyDoc();
    doc.layers = [
      { ty: 3, ind: 0, nm: 'Parent', ip: 0, op: 180, ks: {} },
      { ty: 4, ind: 1, parent: 0, nm: 'Child', ip: 0, op: 180, ks: {} },
      { ty: 4, ind: 2, parent: 1, nm: 'Grandchild', ip: 0, op: 180, ks: {} },
      { ty: 4, ind: 3, nm: 'Other', ip: 0, op: 180, ks: {} },
    ];
    expect(layerFamily(doc.layers, 0)).toHaveLength(3);
    expect(layerFamily(doc.layers, 3)).toHaveLength(1);
  });
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
    const doc = buildPixelDoc(emptyDoc(), [frame(0, square), frame(4, square), frame(8, moved)], grid);
    expect(doc.layers).toHaveLength(2);
    expect(doc.layers[0].ip).toBe(0);
    expect(doc.layers[0].op).toBe(8);
    expect(doc.layers[1].op).toBe(180);
  });

  it('limits the palette', () => {
    const noisy = (x: number, y: number) => [x * 32, y * 32, 0];
    const doc = buildPixelDoc(emptyDoc(), [frame(0, noisy)], grid, 5);
    expect(ofType(doc, 'fl')).toHaveLength(5);
  });
});
