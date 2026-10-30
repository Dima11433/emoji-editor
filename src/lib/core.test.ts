import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import {
  applyBrandSlot,
  DEFAULT_BRAND_OPTIONS,
  findBrandSlots,
  findBuiltInPlateLayers,
  readBrandSlotInfo,
  resetBrandSlot,
} from './brandSlot';
import { CATALOG, isPureIconTemplate } from './catalog';
import { BUILTIN_LOGOS, svgPathToShapes, traceRgbaToVectorLogo } from './logoVector';
import { applyColorTheme, collectColors, replaceColor, shiftHue } from './colors';
import { applyShapeEffects, getEffects } from './effects';
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
import { optimize, parseSticker, serialize, tgsSize, toTgs, toTgsAutoFit } from './tgs';
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

describe('Full catalog (17 shablony1 templates + 263 MAGNAT = 280 emojis)', () => {
  it('contains 17 shablony1 templates and 263 MAGNAT emojis (280 total)', () => {
    expect(CATALOG).toHaveLength(280);
    const shablony = CATALOG.filter((i) => i.category === 'shablony1');
    const magnat = CATALOG.filter((i) => i.category !== 'shablony1');
    expect(shablony).toHaveLength(17);
    expect(magnat).toHaveLength(263);
    expect(magnat.every((item) => item.name.startsWith('MAGNAT #'))).toBe(true);
  });

  it('parses all 280 .tgs files, verifies Telegram canvas/size/duration limits, and checks brand slots', () => {
    const builtInShablonyIds = new Set([
      'shablony1_016',
      'shablony1_017',
      'shablony1_018',
      'shablony1_019',
      'shablony1_020',
      'shablony1_021',
    ]);
    for (const item of CATALOG) {
      const full = resolve(process.cwd(), 'public', item.file);
      const raw = new Uint8Array(readFileSync(full));
      expect(raw.byteLength).toBeLessThanOrEqual(MAX_BYTES);

      const doc = parseSticker(raw);
      expect(doc.w).toBe(512);
      expect(doc.h).toBe(512);
      expect((doc.op - doc.ip) / doc.fr).toBeLessThanOrEqual(3 + 1e-6);

      if (item.category !== 'shablony1' || builtInShablonyIds.has(item.id)) {
        const slots = findBrandSlots(doc);
        expect(slots.length, `${item.id} (${item.file}) should have a brand slot`).toBeGreaterThanOrEqual(1);
      } else {
        expect(findBrandSlots(doc)).toHaveLength(0);
      }
    }
  });
});

describe('Custom templates (shablony1): overlay branding & 3D themes', () => {

  it('injects brand badge (text, logo, logo+text, gold plate, custom position/animation) into all 11 unbranded shablony1 templates under 64 KB and resets cleanly', () => {
    const crownLogo = BUILTIN_LOGOS.find((l) => l.id === 'preset_crown')!;
    const builtInShablony = [
      'shablony1_016',
      'shablony1_017',
      'shablony1_018',
      'shablony1_019',
      'shablony1_020',
      'shablony1_021',
    ];
    const unbrandedItems = CATALOG.filter(
      (i) => i.category === 'shablony1' && !builtInShablony.includes(i.id),
    );
    expect(unbrandedItems).toHaveLength(11);

    for (const item of unbrandedItems) {
      const doc = loadPublicTgs(item.file);
      const origLayerCount = doc.layers.length;
      expect(findBrandSlots(doc)).toHaveLength(0);

      // Inject Logo + Text with Gold VIP capsule plate
      const added = applyBrandSlot(
        doc,
        {
          ...DEFAULT_BRAND_OPTIONS,
          mode: 'logo+text',
          logo: crownLogo,
          text: 'VIP BOSS',
          useOriginalGlyphs: false,
          plateStyle: 'gold',
          slotPosition: 'bottom',
          slotAnim: 'float',
        },
        montserrat,
      );
      expect(added).toBe(1);

      const info = readBrandSlotInfo(doc);
      expect(info.count).toBe(1);
      expect(info.isInjected).toBe(true);

      // Verify layer timeline matches doc.ip..doc.op (critical for 001.tgs where ip=60, op=240!)
      expect(doc.layers[0].ip).toBe(doc.ip);
      expect(doc.layers[0].op).toBe(doc.op);

      // Auto-fitted .tgs must stay within Telegram's 64 KB limit even on 57 KB templates (#006, #011)
      const gz = toTgsAutoFit(doc);
      expect(gz.byteLength, `${item.id} exported .tgs <= 64 KB`).toBeLessThanOrEqual(MAX_BYTES);

      // Re-imported .tgs still detects the injected brand slot
      const reimported = parseSticker(gz);
      expect(findBrandSlots(reimported)).toHaveLength(1);
      expect(readBrandSlotInfo(reimported).isInjected).toBe(true);

      // Reset removes the injected brand layer completely
      resetBrandSlot(doc);
      expect(findBrandSlots(doc)).toHaveLength(0);
      expect(doc.layers).toHaveLength(origLayerCount);
    }
  });

  it('keeps all 11 pure icon templates (001..011) clean without forced MAGNAT when text is empty', () => {
    for (let i = 1; i <= 11; i++) {
      const id = `shablony1_${String(i).padStart(3, '0')}`;
      expect(isPureIconTemplate(id)).toBe(true);

      const doc = loadPublicTgs(`templates/shablony1/${String(i).padStart(3, '0')}.tgs`);
      expect(findBrandSlots(doc)).toHaveLength(0);

      // Calling applyBrandSlot with empty text and no logo must NOT inject brand slot
      const added = applyBrandSlot(doc, { ...DEFAULT_BRAND_OPTIONS, text: '' }, montserrat);
      expect(added).toBe(0);
      expect(findBrandSlots(doc)).toHaveLength(0);

      // Explicitly adding custom text injects the slot
      const addedCustom = applyBrandSlot(doc, { ...DEFAULT_BRAND_OPTIONS, text: 'CUSTOM' }, montserrat);
      expect(addedCustom).toBe(1);
      expect(findBrandSlots(doc)).toHaveLength(1);

      // Clearing text again removes the injected slot and restores clean state
      const cleared = applyBrandSlot(doc, { ...DEFAULT_BRAND_OPTIONS, text: '' }, montserrat);
      expect(cleared).toBe(0);
      expect(findBrandSlots(doc)).toHaveLength(0);
    }

    // Verify capsule templates (016..021) and classic templates are not pure icons
    expect(isPureIconTemplate('shablony1_016')).toBe(false);
    expect(isPureIconTemplate('classic_001')).toBe(false);
  });

  it('supports dual-slot editing on capsule templates (016..021) for center nickname and lower plate text', () => {
    const doc = loadPublicTgs('templates/shablony1/016.tgs');
    const info = readBrandSlotInfo(doc);
    expect(info.hasCenterSlot).toBe(true);
    expect(info.hasPlateSlot).toBe(true);
    expect(info.count).toBe(2);

    // Apply center nickname and plate username with Gold 3D gradient
    applyBrandSlot(
      doc,
      {
        ...DEFAULT_BRAND_OPTIONS,
        text: 'VIP SHOP',
        plateText: '@mybot',
        syncPlateText: false,
        useOriginalGlyphs: false,
        gradientId: 'gold_3d',
        hideBuiltInPlate: false,
      },
      montserrat,
    );

    const slots = findBrandSlots(doc);
    expect(slots).toHaveLength(2);
    const centerSlot = slots.find((s) => s.nm === 'TextGroup')!;
    const plateSlot = slots.find((s) => s.nm === 'USERNAME')!;
    expect(centerSlot).toBeDefined();
    expect(plateSlot).toBeDefined();
    expect(centerSlot.hd).toBeFalsy();
    expect(plateSlot.hd).toBeFalsy();

    // Verify plate hiding toggle
    applyBrandSlot(
      doc,
      {
        ...DEFAULT_BRAND_OPTIONS,
        text: 'VIP SHOP',
        hideBuiltInPlate: true,
      },
      montserrat,
    );
    expect(plateSlot.hd).toBe(true);
    const plateLayers = findBuiltInPlateLayers(doc);
    expect(plateLayers.length).toBeGreaterThanOrEqual(1);
    expect(plateLayers.every((l) => l.hd)).toBe(true);

    // Reset restores both slots and unhides plate
    resetBrandSlot(doc);
    expect(plateLayers.every((l) => !l.hd)).toBe(true);
    expect(plateSlot.hd).toBe(false);
    expect(centerSlot.hd).toBe(false);
  });

  it('recolors 3D gradient templates with applyColorTheme while preserving custom brand slot colors', () => {
    const doc = loadPublicTgs('templates/shablony1/002.tgs'); // Crown
    applyBrandSlot(
      doc,
      {
        ...DEFAULT_BRAND_OPTIONS,
        mode: 'text',
        text: 'KING',
        useOriginalGlyphs: false,
        fillHex: '#00f59b',
        plateStyle: 'dark',
      },
      montserrat,
    );

    const beforeHexes = collectColors(doc).map((c) => c.hex);
    expect(beforeHexes).toContain('#00f59b');

    // Recolor the Crown into Gold VIP while keeping brand slot untouched
    applyColorTheme(doc, 'gold', { skipBrandSlot: true });
    const afterHexes = collectColors(doc).map((c) => c.hex);
    expect(afterHexes).toContain('#00f59b');
    expect(afterHexes).not.toEqual(beforeHexes);
  });

  it('aligns textToLayer and effects keyframes to non-zero ip..op timelines (ip=60, op=240)', () => {
    const doc = loadPublicTgs('templates/shablony1/001.tgs');
    expect(doc.ip).toBe(60);
    expect(doc.op).toBe(240);

    const txt = textToLayer({
      ...DEFAULT_TEXT,
      text: 'ТЕСТ',
      fonts: montserrat,
      animation: 'pulse',
      ip: doc.ip,
      op: doc.op,
    });
    expect(txt.ip).toBe(60);
    expect(txt.op).toBe(240);
    const scaleKeys = (txt.ks.s as { k: { t: number }[] }).k;
    expect(scaleKeys[0].t).toBe(60);
    expect(scaleKeys[scaleKeys.length - 1].t).toBe(240);

    const withHologram = applyShapeEffects({
      ...doc,
      fx: { ...getEffects(doc), hologram: { on: true, target: null } },
    });
    expect(checkTelegram(withHologram, toTgsAutoFit(withHologram).byteLength).filter((c) => c.status === 'error')).toEqual([]);
  });

  it('cleans Bodymovin hash suffixes and precomp asset names in buildTree', () => {
    const guestDoc = loadPublicTgs('templates/shablony1/008.tgs');
    const guestTree = buildTree(guestDoc);
    const groupName = guestTree[0].children[0]?.name ?? '';
    expect(groupName).toBe('Shape 1');

    const sceneDoc = loadPublicTgs('templates/shablony1/003.tgs');
    const sceneTree = buildTree(sceneDoc);
    expect(sceneTree.some((n) => n.name === 'Scene' || n.name === 'Scene_1')).toBe(true);
  });
});

describe('brandSlot replacement & reset on MAGNAT stickers', () => {
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

  it('replaces MAGNAT with a multi-color vector logo AND [logo + text] while passing Telegram checks', () => {
    const doc = loadPublicTgs('templates/characters/002.tgs');
    const verifiedLogo = BUILTIN_LOGOS.find((l) => l.id === 'preset_verified')!;

    // 1. Logo-only mode
    const updatedLogo = applyBrandSlot(
      doc,
      { ...DEFAULT_BRAND_OPTIONS, mode: 'logo', logo: verifiedLogo, scale: 125 },
      null,
    );
    expect(updatedLogo).toBe(1);
    const gz = toTgs(doc);
    expect(gz.byteLength).toBeLessThanOrEqual(MAX_BYTES);
    expect(checkTelegram(doc, gz.byteLength).filter((c) => c.status === 'error')).toEqual([]);

    // Re-imported .tgs still detects tier_logo_slot!
    const reimported = parseSticker(gz);
    expect(findBrandSlots(reimported)).toHaveLength(1);

    // 2. Logo + Text side-by-side mode
    applyBrandSlot(
      doc,
      {
        ...DEFAULT_BRAND_OPTIONS,
        mode: 'logo+text',
        logo: verifiedLogo,
        text: 'SHOP',
        useOriginalGlyphs: false,
      },
      montserrat,
    );
    const slotItems = findBrandSlots(doc)[0].it!;
    expect(slotItems.filter((x) => x.ty === 'gr').length).toBeGreaterThanOrEqual(3);
    expect(tgsSize(doc)).toBeLessThanOrEqual(MAX_BYTES);

    // 3. Reset back to MAGNAT
    resetBrandSlot(doc);
    expect(findBrandSlots(doc)[0].it!.some((x) => x.ty === 'sh')).toBe(true);
  });

  it('applies 3D linear gradients (static and animated) to brand text & logos and resets cleanly', () => {
    const badge = loadPublicTgs('templates/shablony1/015.tgs');
    applyBrandSlot(
      badge,
      {
        ...DEFAULT_BRAND_OPTIONS,
        text: 'VIP',
        useOriginalGlyphs: false,
        gradientId: 'gold_3d',
        gradientAnim: true,
      },
      montserrat,
    );
    const slot = findBrandSlots(badge)[0];
    const gf = slot.it!.find((x) => x.ty === 'gf');
    expect(gf).toBeDefined();
    expect((gf!.s as { a: number }).a).toBe(1);
    expect(readBrandSlotInfo(badge).options.gradientId).toBe('gold_3d');
    expect(readBrandSlotInfo(badge).options.gradientAnim).toBe(true);
    expect(tgsSize(badge)).toBeLessThanOrEqual(MAX_BYTES);
    expect(checkTelegram(badge, tgsSize(badge)).filter((c) => c.status === 'error')).toEqual([]);

    // Also works on vector logos when tintLogo is enabled
    const crown = BUILTIN_LOGOS[0];
    applyBrandSlot(
      badge,
      {
        ...DEFAULT_BRAND_OPTIONS,
        mode: 'logo',
        logo: crown,
        tintLogo: true,
        gradientId: 'cyber_neon',
        gradientAnim: false,
      },
      null,
    );
    const logoSlot = findBrandSlots(badge)[0];
    const logoSubGr = logoSlot.it!.find((x) => x.ty === 'gr')!;
    expect(logoSubGr.it!.some((x) => x.ty === 'gf')).toBe(true);

    // Reset restores original flat fill
    resetBrandSlot(badge);
    const restored = findBrandSlots(badge)[0];
    expect(restored.it!.some((x) => x.ty === 'fl')).toBe(true);
    expect(restored.it!.some((x) => x.ty === 'gf')).toBe(false);
  });

  it('parses SVG arcs/curves and vectorizes raster RGBA logos with auto background removal', () => {
    const circleShapes = svgPathToShapes('M 10 50 A 40 40 0 1 0 90 50 A 40 40 0 1 0 10 50 Z');
    expect(circleShapes).toHaveLength(1);

    const w = 32;
    const h = 32;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const d = Math.hypot(x - 15.5, y - 15.5);
        if (d < 5) rgba.set([0, 136, 255, 255], i);
        else if (d < 12) rgba.set([255, 0, 0, 255], i);
        else rgba.set([255, 255, 255, 255], i);
      }
    }
    const traced = traceRgbaToVectorLogo(rgba, w, h, 'TestBadge', { maxColors: 4, removeBg: 'auto' });
    expect(traced.layers.length).toBe(2);
    const hexes = traced.layers.map((l) => l.fillHex);
    expect(hexes).not.toContain('#ffffff');
    expect(traced.width).toBeGreaterThan(15);
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
