import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import {
  applyBrandSlot,
  DEFAULT_BRAND_OPTIONS,
  findBrandSlots,
  readBrandSlotInfo,
  resetBrandSlot,
} from './brandSlot';
import { CATALOG } from './catalog';
import { collectColors, replaceColor, shiftHue } from './colors';
import {
  adjustNodeTransform,
  buildTree,
  colorScope,
  duplicateNode,
  findBrandNodePath,
  moveNode,
  removeNode,
  toggleHidden,
} from './layers';
import { anim, bezierPath, emptyDoc, fill, group, reindexLayers, shapeLayer } from './lottie';
import { DEFAULT_TEXT, textToLayer } from './text';
import { optimize, parseSticker, serialize, tgsSize, toTgs } from './tgs';
import { checkTelegram, MAX_BYTES, trimToLimit } from './validate';

const require = createRequire(import.meta.url);
const loadTestFont = (pkg: string, file: string) => {
  const buf = readFileSync(require.resolve(`${pkg}/files/${file}`));
  return parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const montserrat = [
  loadTestFont('@fontsource/montserrat', 'montserrat-cyrillic-900-normal.woff'),
  loadTestFont('@fontsource/montserrat', 'montserrat-latin-900-normal.woff'),
];

const loadPublicTgs = (relFile: string) => {
  const full = resolve(process.cwd(), 'public', relFile);
  return parseSticker(new Uint8Array(readFileSync(full)));
};

describe('MAGNAT catalog (all 263 emojis)', () => {
  it('contains exactly 263 MAGNAT emojis and zero legacy procedural templates', () => {
    expect(CATALOG).toHaveLength(263);
    expect(CATALOG.every((item) => item.name.startsWith('MAGNAT #'))).toBe(true);
  });

  it('parses all 263 .tgs files, finds MAGNAT brand slots in 100%, and meets Telegram size/canvas/duration limits', () => {
    for (const item of CATALOG) {
      const full = resolve(process.cwd(), 'public', item.file);
      const raw = new Uint8Array(readFileSync(full));
      expect(raw.byteLength).toBeLessThanOrEqual(MAX_BYTES);

      const doc = parseSticker(raw);
      expect(doc.w).toBe(512);
      expect(doc.h).toBe(512);
      expect((doc.op - doc.ip) / doc.fr).toBeLessThanOrEqual(3 + 1e-6);

      const slots = findBrandSlots(doc);
      expect(slots.length, `${item.id} (${item.file}) should have a brand slot`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('brandSlot replacement & reset', () => {
  it('recolors original MAGNAT vector shapes without changing font or leaking metadata on export', () => {
    const doc = loadPublicTgs('templates/classic/001.tgs');
    const count = applyBrandSlot(
      doc,
      { ...DEFAULT_BRAND_OPTIONS, fillHex: '#ffd54f', strokeHex: '#111318', strokeWidth: 4 },
      null,
    );
    expect(count).toBeGreaterThanOrEqual(1);
    expect(readBrandSlotInfo(doc).options.fillHex).toBe('#ffd54f');

    const json = serialize(doc);
    expect(json).not.toContain('_brandSlot');
    expect(json).not.toContain('_brandState');
    expect(tgsSize(doc)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('replaces MAGNAT with custom Cyrillic+Latin text in both classic (tier_glyph) and character (mylogo) packs, then resets cleanly', () => {
    for (const file of [
      'templates/classic/001.tgs',
      'templates/classic/051.tgs',
      'templates/characters/001.tgs',
      'templates/gifts/001.tgs',
      'templates/love/001.tgs',
    ]) {
      const doc = loadPublicTgs(file);
      const origSlots = findBrandSlots(doc);
      const origShapeCount = origSlots[0].it!.filter((x) => x.ty === 'sh').length;

      const updated = applyBrandSlot(
        doc,
        {
          ...DEFAULT_BRAND_OPTIONS,
          text: 'БОСС 77',
          useOriginalGlyphs: false,
          fillHex: '#00f59b',
          scale: 110,
        },
        montserrat,
      );
      expect(updated).toBe(origSlots.length);
      expect(tgsSize(doc)).toBeLessThanOrEqual(MAX_BYTES);

      // Reset restores exact original MAGNAT glyph paths
      resetBrandSlot(doc);
      const afterReset = findBrandSlots(doc);
      expect(afterReset[0].it!.filter((x) => x.ty === 'sh')).toHaveLength(origShapeCount);
      expect(doc._brandState).toBeUndefined();
    }
  });
});

describe('bezierPath & tgs helpers', () => {
  it('merges the closing vertex into the start', () => {
    const p = bezierPath([0, 0], [[[0, 0], [10, 0], [10, 0]], [[10, 0], [0, 0], [0, 0]]], true);
    const k = (p.ks as { k: { v: number[][]; i: number[][] } }).k;
    expect(k.v).toEqual([[0, 0], [10, 0]]);
  });

  it('round-trips MAGNAT .tgs through gzip and optimize keeps _brandState in memory', () => {
    const doc = loadPublicTgs('templates/characters/001.tgs');
    applyBrandSlot(doc, { ...DEFAULT_BRAND_OPTIONS, fillHex: '#00e5ff' }, null);
    const small = optimize(doc);
    expect(readBrandSlotInfo(small).options.fillHex).toBe('#00e5ff');
    const back = parseSticker(toTgs(small));
    expect(back.tgs).toBe(1);
    expect(back.w).toBe(512);
  });

  it('preserves ind: 0 and parent: 0 in Glaxnimate stickers when adding layers', () => {
    const doc = emptyDoc();
    doc.layers = [
      { ty: 3, ind: 0, nm: 'RootNull', ip: 0, op: 180, ks: {} },
      { ty: 4, ind: 1, parent: 0, nm: 'ChildShape', ip: 0, op: 180, ks: {} },
    ];
    doc.layers.unshift({ ty: 4, nm: 'AddedText', ip: 0, op: 180, ks: {} });
    reindexLayers(doc.layers);
    const root = doc.layers.find((l) => l.nm === 'RootNull')!;
    const child = doc.layers.find((l) => l.nm === 'ChildShape')!;
    expect(root.ind).toBe(0);
    expect(child.parent).toBe(0);
    expect(new Set(doc.layers.map((l) => l.ind)).size).toBe(3);
  });
});

describe('colors, nested precomp layers & transform inspector', () => {
  it('collects transitive precomp colors and replaces them', () => {
    const doc = loadPublicTgs('templates/characters/001.tgs');
    const tree = buildTree(doc);
    const brandPath = findBrandNodePath(tree);
    expect(brandPath).not.toBeNull();
    expect(brandPath![0]).toBe('asset:mylogo');

    const precompLayerIdx = doc.layers.findIndex((l) => l.ty === 0);
    const scopedColors = collectColors(colorScope(doc, [precompLayerIdx]));
    expect(scopedColors.length).toBeGreaterThan(0);

    const firstHex = scopedColors[0].hex;
    replaceColor(colorScope(doc, [precompLayerIdx]), firstHex, '#12ab34');
    expect(collectColors(doc).map((c) => c.hex)).toContain('#12ab34');
  });

  it('shifts hue and handles animated colors', () => {
    const node = { ty: 'fl', c: { a: 1, k: [{ t: 0, s: [255, 0, 0] }, { t: 10, s: [0, 0, 255] }] } };
    expect(collectColors(node).map((c) => c.hex).sort()).toEqual(['#0000ff', '#ff0000']);
    shiftHue(node, 120);
    expect(collectColors(node).map((c) => c.hex)).toContain('#00ff00');
  });

  it('toggles, moves, duplicates, removes and transforms animated layers', () => {
    const doc = emptyDoc();
    doc.layers = [
      shapeLayer('Верх', [group('Гр1', [fill('#ff0000')]), group('Гр2', [fill('#00ff00')])], {
        p: anim([[0, [100, 200, 0]], [60, [120, 220, 0]]]),
      }),
      shapeLayer('Низ', [group('Гр3', [fill('#0000ff')])]),
    ];
    reindexLayers(doc.layers);

    adjustNodeTransform(doc, [0], { dx: 15, dy: -10, scaleFactorX: -1, scaleFactorY: 1, opacity: 75 });
    const pKeys = (doc.layers[0].ks.p as { k: { s: number[] }[] }).k;
    expect(pKeys[0].s[0]).toBe(115);
    expect(pKeys[1].s[0]).toBe(135);
    expect((doc.layers[0].ks.o as { k: number }).k).toBe(75);

    toggleHidden(doc, [0]);
    expect(buildTree(doc)[0].hidden).toBe(true);
    expect(moveNode(doc, [0, 0], 1)).toEqual([0, 1]);
    duplicateNode(doc, [0]);
    expect(doc.layers).toHaveLength(3);
    removeNode(doc, [0]);
    expect(doc.layers).toHaveLength(2);
  });
});

describe('text & validate', () => {
  it('turns mixed Cyrillic and Latin text into centered vector shapes', () => {
    const layer = textToLayer({ ...DEFAULT_TEXT, text: 'MAGNAT ПРО', fonts: montserrat, animation: 'wave' });
    expect(layer.ty).toBe(4);
    expect(layer.shapes!.length).toBe(9);
  });

  it('flags wrong-size or over-3s files and trims them', () => {
    const doc = { ...emptyDoc(), w: 600, op: 300 };
    const failed = checkTelegram(doc, 1000).filter((c) => c.status === 'error').map((c) => c.id);
    expect(failed).toEqual(['canvas', 'duration']);
    trimToLimit(doc);
    expect(doc.op).toBe(180);
  });
});
