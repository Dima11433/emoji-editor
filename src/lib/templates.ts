import type { Font } from 'opentype.js';
import {
  anim,
  bezierPath,
  ellipse,
  emptyDoc,
  fill,
  fixed,
  FRAMES,
  group,
  rect,
  reindexLayers,
  shapeLayer,
  stroke,
  type LottieDoc,
  type Segment,
  type ShapeItem,
  type Vec,
} from './lottie';
import { textToLayer } from './text';

export type TemplateCategory = 'classic' | 'characters' | 'flags' | 'gifts' | 'love' | 'finance' | 'misc';

export const TEMPLATE_CATEGORIES: { id: 'all' | TemplateCategory; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'classic', label: 'Классика' },
  { id: 'characters', label: 'Персонажи' },
  { id: 'flags', label: 'Флаги' },
  { id: 'gifts', label: 'Подарки' },
  { id: 'love', label: 'Любовь' },
  { id: 'finance', label: 'Финансы' },
  { id: 'misc', label: 'Разное' },
];

/** Built-in starter stickers, drawn from scratch for this editor. */
export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  needsFont?: boolean;
  build: (fonts: Font[] | null) => LottieDoc;
}

const line = (a: Vec, b: Vec): Segment => [a, b, b];

function polygon(points: Vec[]): ShapeItem {
  const segs = points.slice(1).map((p, i) => line(points[i], p));
  segs.push(line(points[points.length - 1], points[0]));
  return bezierPath(points[0], segs, true);
}

function starPoints(spikes: number, outer: number, inner: number): Vec[] {
  const pts: Vec[] = [];
  for (let k = 0; k < spikes * 2; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / spikes;
    pts.push([Math.round(Math.cos(a) * r * 10) / 10, Math.round(Math.sin(a) * r * 10) / 10]);
  }
  return pts;
}

function heartPath(): ShapeItem {
  // Drawn on a 24-unit grid, scaled 12x and centered.
  const c = (x: number, y: number): Vec => [(x - 12) * 12, (y - 12.5) * 12];
  return bezierPath(
    c(12, 21),
    [
      [c(8, 17.5), c(2, 13.5), c(2, 8.5)],
      [c(2, 5.5), c(4.2, 3.5), c(7, 3.5)],
      [c(9.2, 3.5), c(11, 4.6), c(12, 6)],
      [c(13, 4.6), c(14.8, 3.5), c(17, 3.5)],
      [c(19.8, 3.5), c(22, 5.5), c(22, 8.5)],
      [c(22, 13.5), c(16, 17.5), c(12, 21)],
    ],
    true,
  );
}

const scaleKeys = (pairs: [number, number, number?][]) =>
  anim(pairs.map(([t, x, y]) => [t, [x, y ?? x, 100]] as [number, number[]]));

function heart(): LottieDoc {
  const doc = emptyDoc('Сердце');
  doc.layers.push(
    shapeLayer(
      'Сердце',
      [
        group('Блик', [ellipse(0, 0, 54, 30), fill('#ffffff', 55)], { p: fixed([-62, -78]), r: fixed(-35) }),
        group('Сердце', [heartPath(), fill('#ff3d6e'), stroke('#b0103f', 12)]),
      ],
      {
        s: scaleKeys([
          [0, 100], [14, 116], [28, 100], [40, 108], [54, 100],
          [90, 100], [104, 116], [118, 100], [130, 108], [144, 100], [FRAMES, 100],
        ]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function ball(): LottieDoc {
  const doc = emptyDoc('Мячик');
  const top = 230;
  const ground = 425;
  doc.layers.push(
    shapeLayer(
      'Мяч',
      [
        group('Блик', [ellipse(-38, -128, 50, 32), fill('#ffffff', 60)], { r: fixed(-30) }),
        group('Мяч', [ellipse(0, -85, 170, 170), fill('#ffb703'), stroke('#c77700', 10)]),
      ],
      {
        p: anim([[0, [256, top, 0]], [45, [256, ground, 0]], [90, [256, top, 0]], [135, [256, ground, 0]], [FRAMES, [256, top, 0]]]),
        s: scaleKeys([
          [0, 100], [38, 94, 106], [45, 120, 80], [52, 94, 106], [60, 100],
          [90, 100], [128, 94, 106], [135, 120, 80], [142, 94, 106], [150, 100], [FRAMES, 100],
        ]),
      },
    ),
    shapeLayer('Тень', [group('Тень', [ellipse(0, 0, 180, 36), fill('#000000', 25)])], {
      p: fixed([256, ground + 6, 0]),
      s: scaleKeys([[0, 55], [45, 100], [90, 55], [135, 100], [FRAMES, 55]]),
    }),
  );
  reindexLayers(doc.layers);
  return doc;
}

function sparkle(name: string, x: number, y: number, size: number, delay: number): ShapeItem {
  const s = size;
  const k = s * 0.28;
  const pts: Vec[] = [[0, -s], [k, -k], [s, 0], [k, k], [0, s], [-k, k], [-s, 0], [-k, -k]];
  const t = (f: number) => (f + delay) % FRAMES;
  const keys: [number, number][] = [[0, 0], [t(20), 0], [t(45), 100], [t(70), 0], [FRAMES, 0]];
  keys.sort((a, b) => a[0] - b[0]);
  return group(name, [polygon(pts), fill('#ffffff')], {
    p: fixed([x, y]),
    o: anim(keys),
  });
}

function star(): LottieDoc {
  const doc = emptyDoc('Звезда');
  doc.layers.push(
    shapeLayer('Искры', [
      sparkle('Искра 1', -170, -150, 30, 0),
      sparkle('Искра 2', 175, -95, 22, 60),
      sparkle('Искра 3', 140, 175, 26, 115),
    ]),
    shapeLayer('Звезда', [group('Звезда', [polygon(starPoints(5, 175, 76)), fill('#ffd23f'), stroke('#e89b00', 14)])], {
      r: anim([[0, 0], [FRAMES, 72]], 'linear'),
      s: scaleKeys([[0, 100], [90, 108], [FRAMES, 100]]),
    }),
  );
  reindexLayers(doc.layers);
  return doc;
}

function smiley(): LottieDoc {
  const doc = emptyDoc('Смайлик');
  const brown = '#5a3510';
  const smile = bezierPath([-95, 45], [[[-60, 125], [60, 125], [95, 45]]], false);
  doc.layers.push(
    shapeLayer(
      'Смайлик',
      [
        group('Глаза', [ellipse(-62, -40, 44, 64), ellipse(62, -40, 44, 64), fill(brown)], {
          a: fixed([0, -40]),
          p: fixed([0, -40]),
          s: anim([[0, [100, 100]], [100, [100, 100]], [106, [100, 8]], [112, [100, 100]], [FRAMES, [100, 100]]]),
        }),
        group('Улыбка', [smile, stroke(brown, 18)]),
        group('Щёки', [ellipse(-108, 50, 62, 36), ellipse(108, 50, 62, 36), fill('#ff7f8f', 55)]),
        group('Лицо', [ellipse(0, 0, 340, 340), fill('#ffcf3a'), stroke('#e09a00', 10)]),
      ],
      { r: anim([[0, -5], [90, 5], [FRAMES, -5]]) },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function board(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Табличка');
  const ink = '#2b2d42';
  const boardLayer = shapeLayer(
    'Табличка',
    [
      group('Гвоздик', [ellipse(0, -190, 28, 28), fill(ink)]),
      group('Верёвка', [bezierPath([-130, -110], [line([-130, -110], [0, -190]), line([0, -190], [130, -110])], false), stroke(ink, 8)]),
      group('Доска', [rect(0, 0, 390, 220, 28), fill('#ffffff'), stroke(ink, 12)]),
    ],
    { a: fixed([0, -190, 0]), p: fixed([256, 92, 0]), r: anim([[0, -6], [90, 6], [FRAMES, -6]]) },
  );
  boardLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: 'ТОП',
      fonts,
      size: 130,
      fillHex: '#ff3d6e',
      strokeHex: ink,
      strokeWidth: 7,
      x: 0,
      y: 0,
      maxWidth: 320,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(boardLayer);
  return doc;
}

function sun(): LottieDoc {
  const doc = emptyDoc('Солнце');
  const rays: ShapeItem[] = [];
  for (let k = 0; k < 12; k++) {
    const long = k % 2 === 0;
    rays.push(group(`Луч ${k + 1}`, [rect(0, long ? -178 : -165, 34, long ? 96 : 64, 17)], { r: fixed(k * 30) }));
  }
  doc.layers.push(
    shapeLayer('Солнце', [group('Солнце', [ellipse(0, 0, 230, 230), fill('#ffd23f'), stroke('#f29100', 10)])], {
      s: scaleKeys([[0, 100], [45, 106], [90, 100], [135, 106], [FRAMES, 100]]),
    }),
    shapeLayer('Лучи', [group('Лучи', [...rays, fill('#ffb703')])], { r: anim([[0, 0], [FRAMES, 120]], 'linear') }),
  );
  reindexLayers(doc.layers);
  return doc;
}

// ---------- More templates ----------

type Val = number | number[];

/** Cycles through values every `period` frames; seamless when 180 is a multiple of period. */
function repeatKeys(period: number, values: Val[]): [number, Val][] {
  const step = period / values.length;
  const keys: [number, Val][] = [];
  for (let i = 0; i * step <= FRAMES; i++) keys.push([Math.round(i * step), values[i % values.length]]);
  return keys;
}

/** A value that runs from `from` to `to` every `period` frames, starting `delay` frames late, looping cleanly. */
function loopLinear(period: number, delay: number, from: number, to: number) {
  const at = (t: number) => {
    const phase = (((t - delay) % period) + period) % period;
    return from + ((to - from) * phase) / period;
  };
  const keys: [number, number][] = [[0, at(0)]];
  for (let r = delay; r <= FRAMES; r += period) {
    if (r <= 0) continue;
    keys.push([r - 1, at(r - 1)]);
    if (r < FRAMES) keys.push([r, from]);
  }
  if (keys[keys.length - 1][0] !== FRAMES) keys.push([FRAMES, at(FRAMES)]);
  return keys.map(([t, v]) => [t, Math.round(v * 10) / 10] as [number, number]);
}

const pop = (big = 115) =>
  scaleKeys([[0, 0], [12, big], [20, 94], [26, 100], [FRAMES, 100]]);

function sparkles(): ReturnType<typeof shapeLayer> {
  return shapeLayer('Искры', [
    sparkle('Искра 1', -175, -160, 26, 0),
    sparkle('Искра 2', 180, -120, 20, 60),
    sparkle('Искра 3', 170, 165, 24, 115),
  ]);
}

function flamePath(): ShapeItem {
  return bezierPath(
    [0, 150],
    [
      [[-70, 150], [-115, 100], [-115, 30]],
      [[-115, -30], [-60, -50], [-40, -90]],
      [[-25, -120], [-20, -150], [0, -178]],
      [[20, -130], [70, -110], [60, -60]],
      [[95, -40], [115, -10], [115, 30]],
      [[115, 100], [70, 150], [0, 150]],
    ],
    true,
  );
}

function ember(name: string, x: number, drift: number, size: number, period: number): ShapeItem {
  const pos: [number, number[]][] = [];
  const op: [number, number][] = [];
  for (let t = 0; t < FRAMES; t += period) {
    pos.push([t, [x, 110]], [t + period - 1, [x + drift, -210]]);
    op.push([t, 0], [t + Math.round(period * 0.2), 100], [t + period - 1, 0]);
  }
  pos.push([FRAMES, [x, 110]]);
  op.push([FRAMES, 0]);
  return group(name, [ellipse(0, 0, size), fill('#ffd23f')], { p: anim(pos, 'linear'), o: anim(op) });
}

function fire(): LottieDoc {
  const doc = emptyDoc('Огонь');
  const base = { a: fixed([0, 150]), p: fixed([0, 150]) };
  doc.layers.push(
    shapeLayer('Искорки', [ember('Искорка 1', -60, -30, 18, 60), ember('Искорка 2', 50, 40, 14, 90), ember('Искорка 3', 5, -10, 12, 45)]),
    shapeLayer('Огонь', [
      group('Сердцевина', [flamePath(), fill('#ffe066')], {
        ...base,
        s: anim(repeatKeys(30, [[55, 55], [51, 61], [58, 52]])),
      }),
      group('Пламя', [flamePath(), fill('#ff7a1a'), stroke('#e8410c', 10)], {
        ...base,
        s: anim(repeatKeys(36, [[100, 100], [96, 106], [104, 97], [98, 104]])),
        r: anim(repeatKeys(60, [-2, 2])),
      }),
    ], { p: fixed([256, 270, 0]) }),
  );
  reindexLayers(doc.layers);
  return doc;
}

function like(): LottieDoc {
  const doc = emptyDoc('Лайк');
  const skin = '#ffc94d';
  const edge = '#c98a1a';
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Лайк',
      [
        group('Пальцы', [
          bezierPath([70, 25], [line([70, 25], [128, 25])], false),
          bezierPath([70, 65], [line([70, 65], [128, 65])], false),
          bezierPath([70, 105], [line([70, 105], [128, 105])], false),
          stroke(edge, 8),
        ]),
        group('Кулак', [rect(30, 62, 200, 170, 42), fill(skin), stroke(edge, 10)]),
        group('Большой палец', [rect(-5, -70, 72, 175, 36), fill(skin), stroke(edge, 10)], {
          a: fixed([-5, -10]),
          p: fixed([-5, -10]),
          r: fixed(14),
        }),
        group('Манжета', [rect(-122, 60, 72, 176, 14), fill('#3d7bfd'), stroke('#1f4fc4', 10)]),
      ],
      {
        s: pop(118),
        r: anim([[0, -25], [14, 8], [24, 0], [100, 0], [110, -10], [122, 4], [132, 0], [FRAMES, 0]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function gift(): LottieDoc {
  const doc = emptyDoc('Подарок');
  const ribbon = '#ffd23f';
  const ribbonEdge = '#d89a00';
  const box = '#ff4d6d';
  const boxEdge = '#a3122f';
  const jump: [number, number[]][] = [
    [0, [0, 0]], [12, [0, -48]], [24, [0, 0]], [30, [0, -12]], [36, [0, 0]],
    [90, [0, 0]], [102, [0, -48]], [114, [0, 0]], [120, [0, -12]], [126, [0, 0]], [FRAMES, [0, 0]],
  ];
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Подарок',
      [
        group(
          'Крышка',
          [
            group('Узел', [ellipse(0, -102, 44), fill(ribbon), stroke(ribbonEdge, 8)]),
            group('Бант слева', [ellipse(-52, -118, 104, 64), fill(ribbon), stroke(ribbonEdge, 8)], {
              a: fixed([-52, -118]), p: fixed([-52, -118]), r: fixed(-25),
            }),
            group('Бант справа', [ellipse(52, -118, 104, 64), fill(ribbon), stroke(ribbonEdge, 8)], {
              a: fixed([52, -118]), p: fixed([52, -118]), r: fixed(25),
            }),
            group('Лента крышки', [rect(0, -55, 52, 72), fill(ribbon)]),
            group('Крышка', [rect(0, -55, 330, 72, 16), fill('#e63950'), stroke(boxEdge, 10)]),
          ],
          { p: anim(jump), r: anim([[0, 0], [12, -6], [24, 0], [102, 6], [114, 0], [FRAMES, 0]]) },
        ),
        group('Лента коробки', [rect(0, 75, 52, 200), fill(ribbon)]),
        group('Коробка', [rect(0, 75, 290, 200, 18), fill(box), stroke(boxEdge, 10)]),
      ],
      { p: fixed([256, 266, 0]) },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function crown(): LottieDoc {
  const doc = emptyDoc('Корона');
  const gold = '#ffc93c';
  const edge = '#c98200';
  const tips: Vec[] = [[-170, -75], [0, -122], [170, -75]];
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Корона',
      [
        group('Камень 1', [ellipse(-92, 78, 32), fill('#ff4d6d')]),
        group('Камень 2', [ellipse(0, 78, 38), fill('#3d7bfd')]),
        group('Камень 3', [ellipse(92, 78, 32), fill('#2fbf71')]),
        group('Обод', [rect(0, 78, 310, 44, 12), fill('#f5a623'), stroke(edge, 10)]),
        group('Шарики', [...tips.map(([x, y]) => ellipse(x, y, 42)), fill('#ffe58a'), stroke(edge, 8)]),
        group('Корона', [polygon([[-150, 92], [150, 92], [170, -75], [82, 5], [0, -122], [-82, 5], [-170, -75]]), fill(gold), stroke(edge, 12)]),
      ],
      {
        p: anim([[0, [256, 270, 0]], [45, [256, 250, 0]], [90, [256, 270, 0]], [135, [256, 250, 0]], [FRAMES, [256, 270, 0]]]),
        r: anim([[0, -6], [90, 6], [FRAMES, -6]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function lightning(): LottieDoc {
  const doc = emptyDoc('Молния');
  const flash = (t: number): [number, number][] => [[t, 0], [t + 3, 50], [t + 6, 10], [t + 9, 42], [t + 14, 0]];
  const glowKeys: [number, number][] = [...flash(0), ...flash(60), ...flash(120), [FRAMES, 0]];
  const bump = (t: number): [number, number][] => [[t, 100], [t + 3, 114], [t + 9, 104], [t + 14, 100]];
  const sizeKeys = [...bump(0), ...bump(60), ...bump(120), [FRAMES, 100] as [number, number]];
  doc.layers.push(
    shapeLayer('Молния', [group('Молния', [polygon([[50, -205], [-122, 35], [-12, 35], [-62, 205], [128, -45], [16, -45]]), fill('#ffe14d'), stroke('#e09b00', 12)])], {
      s: scaleKeys(sizeKeys.map(([t, v]) => [t, v])),
      r: anim([[0, -4], [90, 4], [FRAMES, -4]]),
    }),
    shapeLayer('Вспышка', [group('Вспышка', [ellipse(0, 0, 400), fill('#fff3a0')])], { o: anim(glowKeys, 'linear') }),
  );
  reindexLayers(doc.layers);
  return doc;
}

function rocket(): LottieDoc {
  const doc = emptyDoc('Ракета');
  const ink = '#3a3f58';
  const body = bezierPath(
    [0, -175],
    [
      [[60, -135], [78, -30], [60, 40]],
      line([60, 40], [45, 105]),
      line([45, 105], [-45, 105]),
      line([-45, 105], [-60, 40]),
      [[-78, -30], [-60, -135], [0, -175]],
    ],
    true,
  );
  const jitter = repeatKeys(8, [[0, 0], [3, -2], [-3, 1], [2, 3]]);
  doc.layers.push(
    shapeLayer('Звёзды', [sparkle('Звезда 1', -170, -60, 22, 20), sparkle('Звезда 2', 160, 40, 18, 80), sparkle('Звезда 3', -120, 170, 20, 140)]),
    shapeLayer(
      'Ракета',
      [
        group(
          'Ракета',
          [
            group('Иллюминатор', [ellipse(0, -45, 72), fill('#5ec8ff'), stroke(ink, 10)]),
            group('Корпус', [body, fill('#f1f3f8'), stroke(ink, 10)]),
            group('Крылья', [polygon([[-55, 15], [-118, 118], [-45, 98]]), polygon([[55, 15], [118, 118], [45, 98]]), fill('#ff4d6d'), stroke(ink, 10)]),
            group('Огонь', [flamePath(), fill('#ff7a1a')], {
              a: fixed([0, 150]),
              p: fixed([0, 112]),
              r: fixed(180),
              s: anim(repeatKeys(12, [[34, 34], [30, 44], [36, 38]])),
            }),
          ],
          { p: anim(jitter, 'linear') },
        ),
      ],
      {
        p: anim([[0, [256, 270, 0]], [90, [256, 236, 0]], [FRAMES, [256, 270, 0]]]),
        r: fixed(35),
        s: fixed([88, 88, 100]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function hundred(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Сотка');
  if (!fonts) return doc;
  const red = '#ff2d2d';
  const layer = textToLayer({ text: '100', fonts, size: 210, fillHex: red, strokeHex: null, strokeWidth: 0, x: 256, y: 236, maxWidth: 380, animation: 'pulse' });
  layer.shapes!.push(
    group('Подчёркивание', [
      bezierPath([-170, 120], [line([-170, 120], [170, 105])], false),
      bezierPath([-150, 160], [line([-150, 160], [150, 147])], false),
      stroke(red, 18),
    ]),
  );
  layer.ks.r = anim([[0, -10], [90, -4], [FRAMES, -10]]);
  layer.nm = '100';
  doc.layers.push(layer);
  reindexLayers(doc.layers);
  return doc;
}

function badge(): LottieDoc {
  const doc = emptyDoc('Бейдж');
  const blue = '#3d7bfd';
  const dark = '#1f4fc4';
  doc.layers.push(
    shapeLayer('Звёздочка', [group('Звёздочка', [polygon(starPoints(5, 82, 35)), fill('#ffc93c'), stroke('#c98200', 8)])], {
      p: fixed([256, 226, 0]),
      s: scaleKeys([[0, 100], [45, 112], [90, 100], [135, 112], [FRAMES, 100]]),
      r: anim([[0, -8], [90, 8], [FRAMES, -8]]),
    }),
    shapeLayer(
      'Розетка',
      [
        group('Круг', [ellipse(0, 0, 228), fill('#ffffff'), stroke(dark, 8)]),
        group('Розетка', [polygon(starPoints(16, 172, 150)), fill(blue), stroke(dark, 10)]),
      ],
      { p: fixed([256, 226, 0]), r: anim([[0, 0], [FRAMES, 22.5]], 'linear') },
    ),
    shapeLayer(
      'Ленты',
      [group('Ленты', [polygon([[-95, 90], [-35, 115], [-70, 240], [-98, 205], [-130, 222]]), polygon([[95, 90], [35, 115], [70, 240], [98, 205], [130, 222]]), fill('#2d5fd6'), stroke(dark, 8)])],
      { p: fixed([256, 226, 0]) },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function bubble(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Облачко');
  const ink = '#2b2d42';
  const bubbleLayer = shapeLayer(
    'Облачко',
    [
      group('Стык', [polygon([[-119, 80], [-125, 100], [-78, 100], [-58, 80]]), fill('#ffffff')]),
      group('Облачко', [rect(0, -30, 400, 240, 70), fill('#ffffff'), stroke(ink, 12)]),
      group('Хвостик', [polygon([[-120, 60], [-160, 185], [-30, 60]]), fill('#ffffff'), stroke(ink, 12)]),
    ],
    {
      s: pop(),
      p: anim([[0, [256, 250, 0]], [26, [256, 250, 0]], [100, [256, 236, 0]], [FRAMES, [256, 250, 0]]]),
    },
  );
  bubbleLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({ text: 'Привет!', fonts, size: 92, fillHex: ink, strokeHex: null, strokeWidth: 0, x: 0, y: -30, maxWidth: 330, animation: 'wave' });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(bubbleLayer);
  return doc;
}

function shine(): LottieDoc {
  const doc = emptyDoc('Сияние');
  const ring = (name: string, color: string, delay: number) =>
    group(name, [ellipse(0, 0, 120), stroke(color, 10)], {
      s: anim(loopLinear(60, delay, 40, 330).map(([t, v]) => [t, [v, v]] as [number, number[]]), 'linear'),
      o: anim(loopLinear(60, delay, 100, 0), 'linear'),
    });
  const pts: Vec[] = [[0, -110], [24, -24], [110, 0], [24, 24], [0, 110], [-24, 24], [-110, 0], [-24, -24]];
  doc.layers.push(
    shapeLayer('Блеск', [group('Блеск', [polygon(pts), fill('#ffffff')])], {
      r: anim([[0, 0], [FRAMES, 90]], 'linear'),
      s: scaleKeys([[0, 100], [45, 118], [90, 100], [135, 118], [FRAMES, 100]]),
    }),
    shapeLayer('Свечение', [group('Свечение', [ellipse(0, 0, 200), fill('#7c5cff', 45)])], {
      s: scaleKeys([[0, 90], [45, 110], [90, 90], [135, 110], [FRAMES, 90]]),
    }),
    shapeLayer('Кольца', [ring('Кольцо 1', '#7c5cff', 0), ring('Кольцо 2', '#00d1ff', 20), ring('Кольцо 3', '#ff5cc8', 40)]),
  );
  reindexLayers(doc.layers);
  return doc;
}

function coin(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Монета');
  const gold = '#f59e0b';
  const edge = '#b45309';
  const coinLayer = shapeLayer(
    'Монета',
    [
      group('Блик', [ellipse(-50, -60, 48, 24), fill('#ffffff', 45)], { r: fixed(-35) }),
      group('Внутренний обод', [ellipse(0, 0, 240, 240), fill('#fbbf24'), stroke(edge, 6)]),
      group('Основа', [ellipse(0, 0, 310, 310), fill(gold), stroke(edge, 12)]),
    ],
    {
      s: anim([
        [0, [100, 100]],
        [45, [25, 100]],
        [90, [100, 100]],
        [135, [25, 100]],
        [FRAMES, [100, 100]],
      ]),
      r: anim([[0, -6], [90, 6], [FRAMES, -6]]),
    },
  );
  coinLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: '$',
      fonts,
      size: 150,
      fillHex: '#78350f',
      strokeHex: null,
      strokeWidth: 0,
      x: 0,
      y: 0,
      maxWidth: 180,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(sparkles(), coinLayer);
  reindexLayers(doc.layers);
  return doc;
}

function chart(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('График');
  const green = '#22c55e';
  const darkGreen = '#15803d';
  const arrow = bezierPath([-140, 60], [line([-140, 60], [60, -100]), line([60, -100], [130, -110])], false);
  const arrowHead = polygon([[135, -115], [95, -145], [105, -75]]);

  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Стрелка',
      [
        group('Наконечник', [arrowHead, fill('#16a34a')]),
        group('Линия', [arrow, stroke('#16a34a', 14)]),
      ],
      {
        p: anim([[0, [256, 256, 0]], [45, [256, 246, 0]], [90, [256, 256, 0]], [135, [256, 246, 0]], [FRAMES, [256, 256, 0]]]),
      },
    ),
    shapeLayer(
      'Столбец 3',
      [group('Бар 3', [rect(95, 30, 64, 250, 12), fill(green), stroke(darkGreen, 8)])],
      {
        p: fixed([256, 256, 0]),
        s: scaleKeys([[0, 100], [45, 105], [90, 100], [135, 105], [FRAMES, 100]]),
      },
    ),
    shapeLayer(
      'Столбец 2',
      [group('Бар 2', [rect(0, 80, 64, 150, 12), fill(green), stroke(darkGreen, 8)])],
      {
        p: fixed([256, 256, 0]),
        s: scaleKeys([[0, 100], [30, 106], [75, 100], [120, 106], [FRAMES, 100]]),
      },
    ),
    shapeLayer(
      'Столбец 1',
      [group('Бар 1', [rect(-95, 120, 64, 70, 12), fill(green), stroke(darkGreen, 8)])],
      {
        p: fixed([256, 256, 0]),
        s: scaleKeys([[0, 100], [60, 108], [120, 100], [FRAMES, 100]]),
      },
    ),
  );
  if (fonts) {
    const text = textToLayer({
      text: '+100%',
      fonts,
      size: 72,
      fillHex: '#ffffff',
      strokeHex: darkGreen,
      strokeWidth: 6,
      x: 256,
      y: 90,
      maxWidth: 240,
      animation: 'pulse',
    });
    doc.layers.unshift(text);
  }
  reindexLayers(doc.layers);
  return doc;
}

function trophy(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Кубок');
  const gold = '#fbbf24';
  const edge = '#d97706';
  const wood = '#78350f';
  const cupBody = bezierPath(
    [-110, -110],
    [
      line([-110, -110], [110, -110]),
      [[110, -40], [80, 40], [0, 55]],
      [[-80, 40], [-110, -40], [-110, -110]],
    ],
    true,
  );
  const handleL = bezierPath([-110, -90], [[[-170, -90], [-170, 10], [-80, 20]]], false);
  const handleR = bezierPath([110, -90], [[[170, -90], [170, 10], [80, 20]]], false);

  const trophyLayer = shapeLayer(
    'Кубок',
    [
      group('Звезда', [polygon(starPoints(5, 36, 16)), fill('#ffffff')], { p: fixed([0, -35]) }),
      group('Ручка левая', [handleL, stroke(edge, 12)]),
      group('Ручка правая', [handleR, stroke(edge, 12)]),
      group('Чаша', [cupBody, fill(gold), stroke(edge, 10)]),
      group('Ножка', [rect(0, 85, 44, 60, 6), fill(gold), stroke(edge, 8)]),
      group('Основание', [rect(0, 140, 190, 50, 10), fill(wood), stroke('#451a03', 8)]),
    ],
    {
      s: pop(115),
      r: anim([[0, -4], [90, 4], [FRAMES, -4]]),
    },
  );
  trophyLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: '#1',
      fonts,
      size: 48,
      fillHex: '#fef08a',
      strokeHex: '#451a03',
      strokeWidth: 4,
      x: 0,
      y: 140,
      maxWidth: 160,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(sparkles(), trophyLayer);
  reindexLayers(doc.layers);
  return doc;
}

function skull(): LottieDoc {
  const doc = emptyDoc('Череп');
  const ink = '#334155';
  const teeth: ShapeItem[] = [];
  for (let i = -2; i <= 2; i++) {
    teeth.push(rect(i * 24, 105, 18, 30, 4));
  }
  doc.layers.push(
    shapeLayer(
      'Глаза свет',
      [
        group('Огонёк левый', [ellipse(-55, -20, 22), fill('#38bdf8')]),
        group('Огонёк правый', [ellipse(55, -20, 22), fill('#38bdf8')]),
      ],
      {
        s: scaleKeys([[0, 90], [45, 130], [90, 90], [135, 130], [FRAMES, 90]]),
        o: anim([[0, 80], [45, 100], [90, 80], [135, 100], [FRAMES, 80]]),
      },
    ),
    shapeLayer(
      'Череп',
      [
        group('Зубы', [...teeth, fill('#f8fafc'), stroke(ink, 6)]),
        group('Нос', [polygon([[0, 15], [-16, 42], [16, 42]]), fill(ink)]),
        group('Глазница левая', [ellipse(-55, -20, 56, 68), fill(ink)]),
        group('Глазница правая', [ellipse(55, -20, 56, 68), fill(ink)]),
        group('Челюсть', [rect(0, 95, 160, 60, 16), fill('#f8fafc'), stroke(ink, 10)]),
        group('Череп', [ellipse(0, -35, 270, 240), fill('#f8fafc'), stroke(ink, 12)]),
      ],
      {
        r: anim([[0, -3], [90, 3], [FRAMES, -3]]),
        s: scaleKeys([[0, 100], [45, 104], [90, 100], [135, 104], [FRAMES, 100]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function catSign(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Котик');
  const orange = '#fb923c';
  const darkOrange = '#c2410c';
  const ink = '#1e293b';
  const pink = '#fca5a5';

  const catLayer = shapeLayer(
    'Котик',
    [
      group('Лапки', [
        ellipse(-80, 50, 48, 36),
        ellipse(80, 50, 48, 36),
        fill(orange),
        stroke(darkOrange, 8),
      ]),
      group('Табличка', [rect(0, 105, 320, 120, 18), fill('#fef3c7'), stroke('#b45309', 10)]),
      group('Щёчки', [ellipse(-85, -5, 36, 22), ellipse(85, -5, 36, 22), fill('#f43f5e', 50)]),
      group('Ус слева', [
        bezierPath([-70, 10], [line([-70, 10], [-130, 0])], false),
        bezierPath([-70, 20], [line([-70, 20], [-130, 25])], false),
        stroke(ink, 6),
      ]),
      group('Ус справа', [
        bezierPath([70, 10], [line([70, 10], [130, 0])], false),
        bezierPath([70, 20], [line([70, 20], [130, 25])], false),
        stroke(ink, 6),
      ]),
      group('Носик', [polygon([[0, 5], [-10, -5], [10, -5]]), fill(pink)]),
      group('Глаза', [
        ellipse(-55, -25, 34, 46),
        ellipse(55, -25, 34, 46),
        fill(ink),
      ], {
        a: fixed([0, -25]),
        p: fixed([0, -25]),
        s: anim([[0, [100, 100]], [110, [100, 100]], [116, [100, 10]], [122, [100, 100]], [FRAMES, [100, 100]]]),
      }),
      group('Ушко левое', [
        polygon([[-110, -60], [-55, -135], [-30, -50]]),
        fill(orange),
        stroke(darkOrange, 10),
      ]),
      group('Ушко правое', [
        polygon([[110, -60], [55, -135], [30, -50]]),
        fill(orange),
        stroke(darkOrange, 10),
      ]),
      group('Голова', [ellipse(0, -20, 260, 210), fill(orange), stroke(darkOrange, 10)]),
    ],
    {
      p: anim([[0, [256, 256, 0]], [90, [256, 246, 0]], [FRAMES, [256, 256, 0]]]),
      r: anim([[0, -3], [90, 3], [FRAMES, -3]]),
    },
  );
  catLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: 'МЯУ!',
      fonts,
      size: 78,
      fillHex: '#b45309',
      strokeHex: null,
      strokeWidth: 0,
      x: 0,
      y: 105,
      maxWidth: 270,
      animation: 'wave',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(catLayer);
  reindexLayers(doc.layers);
  return doc;
}

function hugHeart(): LottieDoc {
  const doc = emptyDoc('Обнимашки');
  const brown = '#713f12';
  const yellow = '#fde047';
  const yellowEdge = '#ca8a04';
  const heartRed = '#ff3d6e';
  const heartEdge = '#b0103f';

  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Сердечко',
      [
        group('Сердце', [heartPath(), fill(heartRed), stroke(heartEdge, 10)], {
          s: fixed([72, 72]),
          p: fixed([0, 50]),
        }),
      ],
      {
        s: scaleKeys([[0, 100], [14, 116], [28, 100], [42, 110], [56, 100], [FRAMES, 100]]),
      },
    ),
    shapeLayer(
      'Персонаж',
      [
        group('Лапки', [
          ellipse(-85, 60, 44, 44),
          ellipse(85, 60, 44, 44),
          fill(yellow),
          stroke(yellowEdge, 8),
        ]),
        group('Щёчки', [ellipse(-80, -30, 44, 28), ellipse(80, -30, 44, 28), fill('#ff7f8f', 55)]),
        group('Глаза', [
          bezierPath([-70, -60], [[[-60, -85], [-40, -85], [-30, -60]]], false),
          bezierPath([30, -60], [[[40, -85], [60, -85], [70, -60]]], false),
          stroke(brown, 12),
        ]),
        group('Голова', [ellipse(0, -45, 260, 240), fill(yellow), stroke(yellowEdge, 10)]),
      ],
      {
        r: anim([[0, -4], [90, 4], [FRAMES, -4]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function cool(): LottieDoc {
  const doc = emptyDoc('Крутой');
  const yellow = '#facc15';
  const edge = '#ca8a04';
  const dark = '#0f172a';
  const smile = bezierPath([-50, 50], [[[-10, 95], [60, 95], [80, 55]]], false);

  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Смайлик',
      [
        group('Блик очков', [
          polygon([[-105, -30], [-70, -30], [-85, 0], [-120, 0]]),
          fill('#ffffff', 65),
        ]),
        group('Очки', [
          rect(-65, -20, 110, 68, 18),
          rect(65, -20, 110, 68, 18),
          rect(0, -28, 34, 12, 4),
          fill(dark),
          stroke('#020617', 8),
        ]),
        group('Ухмылка', [smile, stroke('#713f12', 14)]),
        group('Голова', [ellipse(0, 0, 310, 310), fill(yellow), stroke(edge, 10)]),
      ],
      {
        r: anim([[0, -5], [90, 5], [FRAMES, -5]]),
        s: scaleKeys([[0, 100], [45, 104], [90, 100], [135, 104], [FRAMES, 100]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function party(): LottieDoc {
  const doc = emptyDoc('Праздник');
  const pink = '#ec4899';
  const pinkEdge = '#be185d';
  const yellow = '#facc15';
  const blue = '#38bdf8';

  const confettiPiece = (name: string, x: number, y: number, color: string): ShapeItem => {
    return group(name, [rect(0, 0, 20, 14, 3), fill(color)], {
      p: anim(repeatKeys(60, [[0, 0], [x, y], [x * 1.3, y + 40]])),
      r: anim(repeatKeys(60, [0, 180, 360]), 'linear'),
      o: anim(repeatKeys(60, [100, 100, 0]), 'linear'),
    });
  };

  doc.layers.push(
    shapeLayer('Конфетти', [
      confettiPiece('Конфетти 1', -150, -110, yellow),
      confettiPiece('Конфетти 2', 150, -120, blue),
      confettiPiece('Конфетти 3', -120, 80, pink),
      confettiPiece('Конфетти 4', 130, 90, '#4ade80'),
    ]),
    shapeLayer(
      'Колпак',
      [
        group('Помпон', [ellipse(0, -150, 48), fill(blue), stroke('#0284c7', 6)]),
        group('Полоса', [polygon([[-60, -20], [60, -20], [80, 25], [-80, 25]]), fill(yellow)]),
        group('Колпак', [polygon([[0, -150], [105, 115], [-105, 115]]), fill(pink), stroke(pinkEdge, 10)]),
      ],
      {
        s: scaleKeys([[0, 100], [20, 114, 88], [40, 92, 110], [60, 100], [FRAMES, 100]]),
        r: anim([[0, -6], [90, 6], [FRAMES, -6]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function stamp(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Штамп');
  const red = '#dc2626';
  const stampLayer = shapeLayer(
    'Штамп',
    [
      group('Звезда слева', [polygon(starPoints(5, 24, 10)), fill(red)], { p: fixed([-100, 0]) }),
      group('Звезда справа', [polygon(starPoints(5, 24, 10)), fill(red)], { p: fixed([100, 0]) }),
      group('Внутренний круг', [ellipse(0, 0, 230), stroke(red, 6)]),
      group('Внешний круг', [ellipse(0, 0, 300), stroke(red, 16)]),
    ],
    {
      s: pop(125),
      r: anim([[0, -12], [24, -6], [100, -6], [120, -10], [FRAMES, -6]]),
    },
  );
  stampLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: 'ТОП',
      fonts,
      size: 110,
      fillHex: red,
      strokeHex: null,
      strokeWidth: 0,
      x: 0,
      y: 0,
      maxWidth: 200,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(stampLayer);
  reindexLayers(doc.layers);
  return doc;
}

function warning(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Внимание');
  const yellow = '#facc15';
  const dark = '#1e293b';

  const warningLayer = shapeLayer(
    'Треугольник',
    [
      group('Внутренний контур', [polygon([[0, -115], [140, 105], [-140, 105]]), stroke(dark, 10)]),
      group('Знак', [polygon([[0, -155], [180, 130], [-180, 130]]), fill(yellow), stroke('#ca8a04', 12)]),
    ],
    {
      s: scaleKeys([[0, 100], [45, 108], [90, 100], [135, 108], [FRAMES, 100]]),
      r: anim([[0, -4], [90, 4], [FRAMES, -4]]),
    },
  );
  warningLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: '!',
      fonts,
      size: 140,
      fillHex: dark,
      strokeHex: null,
      strokeWidth: 0,
      x: 0,
      y: 25,
      maxWidth: 120,
      animation: 'pulse',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(sparkles(), warningLayer);
  reindexLayers(doc.layers);
  return doc;
}

function diamond(): LottieDoc {
  const doc = emptyDoc('Бриллиант');
  const cyan = '#06b6d4';
  const cyanLight = '#67e8f9';
  const dark = '#0e7490';
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Бриллиант',
      [
        group('Грань низ', [polygon([[-140, -40], [140, -40], [0, 130]]), fill(cyan), stroke(dark, 10)]),
        group('Грань верх', [polygon([[-90, -110], [90, -110], [140, -40], [-140, -40]]), fill(cyanLight), stroke(dark, 10)]),
        group('Блик центр', [polygon([[0, -110], [45, -40], [0, 130], [-45, -40]]), fill('#ffffff', 40)]),
      ],
      {
        s: scaleKeys([[0, 100], [45, 108], [90, 100], [135, 108], [FRAMES, 100]]),
        r: anim([[0, -4], [90, 4], [FRAMES, -4]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function bicep(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Мускул');
  const skin = '#fb923c';
  const edge = '#c2410c';
  const bicepLayer = shapeLayer(
    'Мускул',
    [
      group('Кулак', [ellipse(70, -75, 76, 76), fill(skin), stroke(edge, 10)]),
      group('Бицепс', [ellipse(5, -40, 106, 86), fill(skin), stroke(edge, 10)]),
      group('Плечо', [rect(-70, 45, 130, 95, 24), fill(skin), stroke(edge, 10)]),
      group('Предплечье', [rect(55, -20, 68, 120, 20), fill(skin), stroke(edge, 10)], { r: fixed(-20) }),
    ],
    {
      s: scaleKeys([[0, 100], [20, 115, 90], [35, 100], [90, 100], [110, 115, 90], [125, 100], [FRAMES, 100]]),
      r: anim([[0, -5], [20, 5], [35, 0], [90, 0], [110, 5], [125, 0], [FRAMES, 0]]),
    },
  );
  bicepLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: 'ТОП',
      fonts,
      size: 44,
      fillHex: '#ffffff',
      strokeHex: edge,
      strokeWidth: 4,
      x: 0,
      y: 85,
      maxWidth: 140,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(sparkles(), bicepLayer);
  reindexLayers(doc.layers);
  return doc;
}

function handshake(): LottieDoc {
  const doc = emptyDoc('Рукопожатие');
  const skin = '#fbbf24';
  const edge = '#b45309';
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Рукопожатие',
      [
        group('Рукав левый', [rect(-135, 30, 95, 80, 12), fill('#3b82f6'), stroke('#1d4ed8', 10)]),
        group('Рукав правый', [rect(135, -30, 95, 80, 12), fill('#10b981'), stroke('#047857', 10)]),
        group('Ладонь левая', [rect(-55, 15, 100, 68, 18), fill(skin), stroke(edge, 10)], { r: fixed(-15) }),
        group('Ладонь правая', [rect(55, -15, 100, 68, 18), fill(skin), stroke(edge, 10)], { r: fixed(-15) }),
        group('Пальцы захват', [ellipse(0, 0, 70, 50), fill(skin), stroke(edge, 8)]),
      ],
      {
        p: anim([
          [0, [256, 256, 0]],
          [15, [256, 238, 0]],
          [30, [256, 268, 0]],
          [45, [256, 246, 0]],
          [60, [256, 256, 0]],
          [FRAMES, [256, 256, 0]],
        ]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function flag(fonts: Font[] | null): LottieDoc {
  const doc = emptyDoc('Флаг');
  const red = '#ef4444';
  const blue = '#3b82f6';
  const white = '#f8fafc';
  const flagLayer = shapeLayer(
    'Полотно',
    [
      group('Полоса белая', [rect(15, -60, 220, 55, 6), fill(white), stroke('#cbd5e1', 6)]),
      group('Полоса синяя', [rect(15, -5, 220, 55, 6), fill(blue)]),
      group('Полоса красная', [rect(15, 50, 220, 55, 6), fill(red)]),
    ],
    {
      a: fixed([-95, 0]),
      p: fixed([-95, 0]),
      r: anim([[0, -4], [45, 4], [90, -4], [135, 4], [FRAMES, -4]]),
    },
  );
  flagLayer.ind = 2;
  if (fonts) {
    const text = textToLayer({
      text: 'TG',
      fonts,
      size: 50,
      fillHex: '#ffffff',
      strokeHex: '#1e3a8a',
      strokeWidth: 4,
      x: 15,
      y: -5,
      maxWidth: 180,
      animation: 'none',
    });
    text.ind = 1;
    text.parent = 2;
    doc.layers.push(text);
  }
  doc.layers.push(
    flagLayer,
    shapeLayer('Флагшток', [
      group('Наконечник', [ellipse(-95, -165, 30), fill('#fbbf24'), stroke('#b45309', 6)]),
      group('Древко', [rect(-95, 20, 16, 350, 6), fill('#64748b'), stroke('#334155', 6)]),
    ]),
  );
  reindexLayers(doc.layers);
  return doc;
}

function handsHeart(): LottieDoc {
  const doc = emptyDoc('Руки-сердце');
  const skin = '#facc15';
  const edge = '#ca8a04';
  doc.layers.push(
    sparkles(),
    shapeLayer(
      'Сердечко в центре',
      [group('Сердце', [heartPath(), fill('#ff2d55')], { s: fixed([45, 45]), p: fixed([0, -10]) })],
      {
        s: scaleKeys([[0, 90], [14, 120], [28, 90], [42, 110], [56, 90], [FRAMES, 90]]),
      },
    ),
    shapeLayer(
      'Руки',
      [
        group('Кисть левая', [rect(-70, 20, 110, 80, 26), fill(skin), stroke(edge, 10)], { r: fixed(35) }),
        group('Кисть правая', [rect(70, 20, 110, 80, 26), fill(skin), stroke(edge, 10)], { r: fixed(-35) }),
        group('Палец левый', [rect(-45, -40, 40, 100, 18), fill(skin), stroke(edge, 10)], { r: fixed(-30) }),
        group('Палец правый', [rect(45, -40, 40, 100, 18), fill(skin), stroke(edge, 10)], { r: fixed(30) }),
      ],
      {
        s: scaleKeys([[0, 100], [45, 105], [90, 100], [135, 105], [FRAMES, 100]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

function bomb(): LottieDoc {
  const doc = emptyDoc('Бомба');
  const dark = '#1e293b';
  doc.layers.push(
    shapeLayer(
      'Искра фитиля',
      [group('Искра', [polygon(starPoints(5, 34, 14)), fill('#ef4444')], { p: fixed([75, -155]) })],
      {
        r: anim([[0, 0], [FRAMES, 360]], 'linear'),
        s: scaleKeys([[0, 90], [15, 130], [30, 80], [45, 120], [60, 90], [FRAMES, 90]]),
      },
    ),
    shapeLayer(
      'Бомба',
      [
        group('Блик', [ellipse(-55, 0, 52, 32), fill('#ffffff', 40)], { r: fixed(-30) }),
        group('Кольцо фитиля', [rect(0, -95, 60, 26, 6), fill('#475569'), stroke(dark, 8)]),
        group('Корпус', [ellipse(0, 35, 260, 260), fill(dark), stroke('#0f172a', 12)]),
      ],
      {
        p: anim([
          [0, [256, 256, 0]],
          [40, [256, 256, 0]],
          [44, [253, 256, 0]],
          [48, [259, 256, 0]],
          [52, [256, 256, 0]],
          [FRAMES, [256, 256, 0]],
        ]),
        s: scaleKeys([[0, 100], [38, 96, 104], [44, 106, 94], [50, 100], [FRAMES, 100]]),
      },
    ),
  );
  reindexLayers(doc.layers);
  return doc;
}

export const TEMPLATES: Template[] = [
  { id: 'heart', name: 'Сердце', category: 'love', build: heart },
  { id: 'smiley', name: 'Смайлик', category: 'characters', build: smiley },
  { id: 'star', name: 'Звезда', category: 'classic', build: star },
  { id: 'ball', name: 'Мячик', category: 'misc', build: ball },
  { id: 'sun', name: 'Солнце', category: 'misc', build: sun },
  { id: 'board', name: 'Табличка', category: 'classic', needsFont: true, build: board },
  { id: 'fire', name: 'Огонь', category: 'classic', build: fire },
  { id: 'like', name: 'Лайк', category: 'classic', build: like },
  { id: 'gift', name: 'Подарок', category: 'gifts', build: gift },
  { id: 'crown', name: 'Корона', category: 'classic', build: crown },
  { id: 'lightning', name: 'Молния', category: 'misc', build: lightning },
  { id: 'rocket', name: 'Ракета', category: 'misc', build: rocket },
  { id: 'hundred', name: '100', category: 'finance', needsFont: true, build: hundred },
  { id: 'badge', name: 'Бейдж', category: 'classic', build: badge },
  { id: 'bubble', name: 'Облачко', category: 'classic', needsFont: true, build: bubble },
  { id: 'shine', name: 'Сияние', category: 'misc', build: shine },
  { id: 'empty', name: 'Пустой', category: 'misc', build: () => emptyDoc() },

  // Новые шаблоны
  { id: 'trophy', name: 'Кубок', category: 'classic', needsFont: true, build: trophy },
  { id: 'stamp', name: 'Штамп', category: 'classic', needsFont: true, build: stamp },
  { id: 'cool', name: 'Крутой', category: 'characters', build: cool },
  { id: 'cat_sign', name: 'Котик', category: 'characters', needsFont: true, build: catSign },
  { id: 'skull', name: 'Череп', category: 'characters', build: skull },
  { id: 'hug_heart', name: 'Обнимашки', category: 'love', build: hugHeart },
  { id: 'coin', name: 'Монета', category: 'finance', needsFont: true, build: coin },
  { id: 'chart', name: 'График', category: 'finance', needsFont: true, build: chart },
  { id: 'party', name: 'Праздник', category: 'misc', build: party },
  { id: 'warning', name: 'Внимание', category: 'misc', needsFont: true, build: warning },
  { id: 'diamond', name: 'Бриллиант', category: 'gifts', build: diamond },
  { id: 'bicep', name: 'Мускул', category: 'classic', needsFont: true, build: bicep },
  { id: 'handshake', name: 'Рукопожатие', category: 'classic', build: handshake },
  { id: 'flag', name: 'Флаг', category: 'flags', needsFont: true, build: flag },
  { id: 'hands_heart', name: 'Руки-сердце', category: 'love', build: handsHeart },
  { id: 'bomb', name: 'Бомба', category: 'misc', build: bomb },
];
