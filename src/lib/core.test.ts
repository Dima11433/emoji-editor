import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { collectColors, replaceColor, shiftHue } from './colors';
import { buildTree, duplicateNode, moveNode, removeNode, toggleHidden } from './layers';
import { bezierPath, emptyDoc, reindexLayers } from './lottie';
import { TEMPLATES } from './templates';
import { textToLayer, DEFAULT_TEXT } from './text';
import { optimize, parseSticker, serialize, tgsSize, toTgs } from './tgs';
import { checkTelegram, trimToLimit } from './validate';

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => {
  const buf = readFileSync(require.resolve(`${pkg}/files/${file}`));
  return parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const rubik = [font('@fontsource/rubik', 'rubik-cyrillic-800-normal.woff'), font('@fontsource/rubik', 'rubik-latin-800-normal.woff')];

describe('bezierPath', () => {
  it('merges the closing vertex into the start', () => {
    const p = bezierPath([0, 0], [[[0, 0], [10, 0], [10, 0]], [[10, 0], [0, 0], [0, 0]]], true);
    const k = (p.ks as { k: { v: number[][]; i: number[][] } }).k;
    expect(k.v).toEqual([[0, 0], [10, 0]]);
  });
});

describe('tgs', () => {
  it('round-trips through gzip', () => {
    const doc = TEMPLATES[0].build(null);
    const back = parseSticker(toTgs(doc));
    expect(back.layers).toHaveLength(doc.layers.length);
    expect(back.tgs).toBe(1);
  });

  it('reads plain JSON and rejects garbage', () => {
    expect(parseSticker(new TextEncoder().encode(serialize(emptyDoc()))).w).toBe(512);
    expect(() => parseSticker(new TextEncoder().encode('hello'))).toThrow();
  });

  it('optimize keeps the file valid and not bigger', () => {
    const doc = TEMPLATES[2].build(null);
    const small = optimize(doc);
    expect(tgsSize(small)).toBeLessThanOrEqual(tgsSize(doc));
    expect(collectColors(small)).toEqual(collectColors(doc));
  });
});

describe('templates', () => {
  for (const t of TEMPLATES) {
    it(`${t.name} passes Telegram checks`, () => {
      const doc = t.build(rubik);
      const checks = checkTelegram(doc, tgsSize(doc));
      expect(checks.filter((c) => c.status !== 'ok')).toEqual([]);
    });
  }
});

describe('colors', () => {
  it('collects and replaces colors', () => {
    const doc = TEMPLATES[0].build(null);
    expect(collectColors(doc).map((c) => c.hex)).toContain('#ff3d6e');
    replaceColor(doc, '#ff3d6e', '#00ff00');
    const hexes = collectColors(doc).map((c) => c.hex);
    expect(hexes).toContain('#00ff00');
    expect(hexes).not.toContain('#ff3d6e');
  });

  it('handles animated and 0-255 colors', () => {
    const node = { ty: 'fl', c: { a: 1, k: [{ t: 0, s: [255, 0, 0] }, { t: 10, s: [0, 0, 255] }] } };
    expect(collectColors(node).map((c) => c.hex).sort()).toEqual(['#0000ff', '#ff0000']);
    replaceColor(node, '#ff0000', '#00ff00');
    expect(node.c.k[0].s).toEqual([0, 255, 0]);
  });

  it('shifts hue', () => {
    const node = { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } };
    shiftHue(node, 120);
    expect(collectColors(node)[0].hex).toBe('#00ff00');
  });
});

describe('layers', () => {
  it('toggles, moves, duplicates and removes', () => {
    const doc = TEMPLATES[3].build(null); // ball: 2 layers
    toggleHidden(doc, [0]);
    expect(buildTree(doc)[0].hidden).toBe(true);
    expect(moveNode(doc, [0], 1)).toEqual([1]);
    expect(doc.layers[1].nm).toBe('Мяч');
    duplicateNode(doc, [1]);
    expect(doc.layers).toHaveLength(3);
    expect(new Set(doc.layers.map((l) => l.ind)).size).toBe(3);
    removeNode(doc, [0]);
    expect(doc.layers).toHaveLength(2);
  });

  it('keeps parent links when a new layer is added on top', () => {
    const doc = TEMPLATES.find((t) => t.id === 'board')!.build(rubik);
    const board = doc.layers.find((l) => l.nm === 'Табличка')!;
    const text = doc.layers.find((l) => l.parent)!;
    doc.layers.unshift({ ty: 4, ip: 0, op: 180, ks: {} });
    reindexLayers(doc.layers);
    expect(text.parent).toBe(board.ind);
    expect(new Set(doc.layers.map((l) => l.ind)).size).toBe(3);
  });

  it('moves groups among groups only', () => {
    const doc = TEMPLATES[1].build(null); // smiley: 4 groups in one layer
    expect(moveNode(doc, [0, 0], 1)).toEqual([0, 1]);
    expect(doc.layers[0].shapes![1].nm).toBe('Глаза');
    expect(moveNode(doc, [0, 3], 1)).toEqual([0, 3]);
  });
});

describe('text', () => {
  it('turns mixed Cyrillic and Latin text into centered shapes', () => {
    const layer = textToLayer({ ...DEFAULT_TEXT, text: 'Привет OK', fonts: rubik, animation: 'wave' });
    expect(layer.ty).toBe(4);
    expect(layer.shapes!.length).toBe(8); // space has no outline
    const pts = layer.shapes!.flatMap((g) =>
      g.it!.filter((s) => s.ty === 'sh').flatMap((s) => (s.ks as { k: { v: number[][] } }).k.v),
    );
    const xs = pts.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(DEFAULT_TEXT.maxWidth + 1);
    expect(Math.abs(Math.max(...xs) + Math.min(...xs))).toBeLessThan(2);
  });
});

describe('validate', () => {
  it('flags long, wrong-size files and trims them', () => {
    const doc = { ...emptyDoc(), w: 600, op: 300 };
    const failed = checkTelegram(doc, 1000).filter((c) => c.status === 'error').map((c) => c.id);
    expect(failed).toEqual(['canvas', 'duration']);
    trimToLimit(doc);
    expect(doc.op).toBe(180);
  });

  it('warns about text layers', () => {
    const doc = emptyDoc();
    doc.layers.push({ ty: 5, ip: 0, op: 180, ks: {} });
    expect(checkTelegram(doc, 10).find((c) => c.id === 'features')!.status).toBe('warn');
  });
});
