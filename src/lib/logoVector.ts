import { bezierPath, hexToRgb, rgbToHex, round, type Segment, type ShapeItem, type Vec } from './lottie';

export interface VectorLogoLayer {
  paths: ShapeItem[];
  fillHex: string | null;
  fillRule?: 1 | 2;
  strokeHex?: string | null;
  strokeWidth?: number;
  opacity?: number;
}

export interface VectorLogo {
  id: string;
  name: string;
  layers: VectorLogoLayer[];
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export type BgRemovalMode = 'auto' | 'on' | 'off';

export interface RasterTraceOptions {
  maxColors?: number;
  removeBg?: BgRemovalMode;
  resolution?: number;
}

// ---------- 2D Affine Matrix [a, b, c, d, e, f] ----------

type Mat2D = [number, number, number, number, number, number];
const IDENT_MAT: Mat2D = [1, 0, 0, 1, 0, 0];

function mulMat(m1: Mat2D, m2: Mat2D): Mat2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMat(m: Mat2D, pt: Vec): Vec {
  return [m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5]];
}

function matScaleFactor(m: Mat2D): number {
  return Math.sqrt((m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]) / 2);
}

function parseTransformAttr(attr: string | null): Mat2D {
  if (!attr) return IDENT_MAT;
  let cur: Mat2D = IDENT_MAT;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attr)) !== null) {
    const fn = match[1].toLowerCase();
    const nums = (match[2].match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) ?? []).map(Number);
    let next: Mat2D = IDENT_MAT;
    if (fn === 'matrix' && nums.length >= 6) {
      next = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
    } else if (fn === 'translate') {
      next = [1, 0, 0, 1, nums[0] ?? 0, nums[1] ?? 0];
    } else if (fn === 'scale') {
      const sx = nums[0] ?? 1;
      const sy = nums[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (fn === 'rotate') {
      const rad = ((nums[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = nums[1] ?? 0;
      const cy = nums[2] ?? 0;
      if (cx || cy) {
        next = mulMat(mulMat([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
      } else {
        next = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'skewx') {
      next = [1, 0, Math.tan(((nums[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    } else if (fn === 'skewy') {
      next = [1, Math.tan(((nums[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    }
    cur = mulMat(cur, next);
  }
  return cur;
}

// ---------- CSS & SVG Color Helpers ----------

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  green: '#008000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  gold: '#ffd700',
  orange: '#ffa500',
  purple: '#800080',
  violet: '#ee82ee',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  silver: '#c0c0c0',
  gray: '#808080',
  grey: '#808080',
  pink: '#ffc0cb',
  coral: '#ff7f50',
  crimson: '#dc143c',
  dodgerblue: '#1e90ff',
  deepskyblue: '#00bfff',
  royalblue: '#4169e1',
  navy: '#000080',
  teal: '#008080',
};

function parseCssColor(raw: string | undefined | null, gradients: Map<string, string>): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || v === 'none' || v === 'transparent') return null;
  const urlMatch = v.match(/^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/i);
  if (urlMatch) {
    return gradients.get(urlMatch[1]) ?? '#ffffff';
  }
  const lower = v.toLowerCase();
  if (lower === 'currentcolor') return '#ffffff';
  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  if (lower.startsWith('#')) {
    if (lower.length === 4) {
      return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
    }
    if (lower.length >= 7) return lower.slice(0, 7);
  }
  const rgbMatch = lower.match(/^rgba?\(\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?\s*[,\s]\s*([\d.]+)%?/);
  if (rgbMatch) {
    const isPct = lower.includes('%');
    const nums = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((s) => {
      const n = Number(s);
      return isPct ? Math.round((n * 255) / 100) : Math.round(n);
    });
    return rgbToHex(nums);
  }
  return null;
}

// ---------- SVG Path `d` Parser (M, L, H, V, C, S, Q, T, A, Z) ----------

function arcToCubics(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): [Vec, Vec, Vec][] {
  if ((Math.abs(x1 - x2) < 1e-5 && Math.abs(y1 - y2) < 1e-5) || rxIn === 0 || ryIn === 0) {
    return [[[x1, y1], [x2, y2], [x2, y2]]];
  }
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;

  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const sign = largeArc === sweep ? -1 : 1;
  const coef = den > 0 ? sign * Math.sqrt(num / den) : 0;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const vecAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
    return ux * vy - uy * vx < 0 ? -ang : ang;
  };

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2;
  if (sweep && dTheta < 0) dTheta += Math.PI * 2;

  const steps = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / steps;
  const alpha = (4 / 3) * Math.tan(delta / 4);

  const out: [Vec, Vec, Vec][] = [];
  for (let i = 0; i < steps; i++) {
    const t1 = theta1 + i * delta;
    const t2 = t1 + delta;
    const c1 = Math.cos(t1);
    const s1 = Math.sin(t1);
    const c2 = Math.cos(t2);
    const s2 = Math.sin(t2);

    const mapPt = (px: number, py: number): Vec => [
      cosPhi * rx * px - sinPhi * ry * py + cx,
      sinPhi * rx * px + cosPhi * ry * py + cy,
    ];

    const ctrl1 = mapPt(c1 - alpha * s1, s1 + alpha * c1);
    const ctrl2 = mapPt(c2 + alpha * s2, s2 - alpha * c2);
    const end = mapPt(c2, s2);
    out.push([ctrl1, ctrl2, end]);
  }
  return out;
}

export function svgPathToShapes(d: string, mat: Mat2D = IDENT_MAT): ShapeItem[] {
  const tokens = d.match(/[a-zA-Z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g);
  if (!tokens) return [];

  const shapes: ShapeItem[] = [];
  let start: Vec | null = null;
  let segs: Segment[] = [];
  let curX = 0;
  let curY = 0;
  let subX = 0;
  let subY = 0;
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCmd = '';

  const flush = (closed: boolean) => {
    if (start && segs.length > 0) {
      shapes.push(bezierPath(start, segs, closed));
    }
    start = null;
    segs = [];
  };

  let idx = 0;
  let cmd = '';
  const hasNum = () => idx < tokens.length && !/^[a-zA-Z]$/.test(tokens[idx]);
  const nextNum = () => Number(tokens[idx++]);

  const ensureStart = () => {
    if (!start) start = applyMat(mat, [curX, curY]);
  };

  const addLine = (nx: number, ny: number) => {
    ensureStart();
    const p0 = applyMat(mat, [curX, curY]);
    const p1 = applyMat(mat, [nx, ny]);
    segs.push([p0, p1, p1]);
    curX = nx;
    curY = ny;
  };

  while (idx < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[idx])) {
      cmd = tokens[idx++];
    } else if (!cmd) {
      break;
    }

    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === 'Z') {
      if (start && (Math.abs(curX - subX) > 1e-3 || Math.abs(curY - subY) > 1e-3)) {
        addLine(subX, subY);
      }
      flush(true);
      curX = subX;
      curY = subY;
      lastCmd = cmd;
      continue;
    }

    if (upper === 'M') {
      flush(false);
      const x = nextNum() + (rel ? curX : 0);
      const y = nextNum() + (rel ? curY : 0);
      curX = x;
      curY = y;
      subX = x;
      subY = y;
      start = applyMat(mat, [curX, curY]);
      lastCmd = cmd;
      while (hasNum()) {
        const lx = nextNum() + (rel ? curX : 0);
        const ly = nextNum() + (rel ? curY : 0);
        addLine(lx, ly);
      }
      continue;
    }

    do {
      if (upper === 'L') {
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        addLine(x, y);
      } else if (upper === 'H') {
        const x = nextNum() + (rel ? curX : 0);
        addLine(x, curY);
      } else if (upper === 'V') {
        const y = nextNum() + (rel ? curY : 0);
        addLine(curX, y);
      } else if (upper === 'C') {
        ensureStart();
        const x1 = nextNum() + (rel ? curX : 0);
        const y1 = nextNum() + (rel ? curY : 0);
        const x2 = nextNum() + (rel ? curX : 0);
        const y2 = nextNum() + (rel ? curY : 0);
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        segs.push([applyMat(mat, [x1, y1]), applyMat(mat, [x2, y2]), applyMat(mat, [x, y])]);
        lastCtrlX = x2;
        lastCtrlY = y2;
        curX = x;
        curY = y;
      } else if (upper === 'S') {
        ensureStart();
        const x1 = 'CcSs'.includes(lastCmd) ? 2 * curX - lastCtrlX : curX;
        const y1 = 'CcSs'.includes(lastCmd) ? 2 * curY - lastCtrlY : curY;
        const x2 = nextNum() + (rel ? curX : 0);
        const y2 = nextNum() + (rel ? curY : 0);
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        segs.push([applyMat(mat, [x1, y1]), applyMat(mat, [x2, y2]), applyMat(mat, [x, y])]);
        lastCtrlX = x2;
        lastCtrlY = y2;
        curX = x;
        curY = y;
      } else if (upper === 'Q') {
        ensureStart();
        const qx = nextNum() + (rel ? curX : 0);
        const qy = nextNum() + (rel ? curY : 0);
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        const c1: Vec = [curX + (2 / 3) * (qx - curX), curY + (2 / 3) * (qy - curY)];
        const c2: Vec = [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)];
        segs.push([applyMat(mat, c1), applyMat(mat, c2), applyMat(mat, [x, y])]);
        lastCtrlX = qx;
        lastCtrlY = qy;
        curX = x;
        curY = y;
      } else if (upper === 'T') {
        ensureStart();
        const qx = 'QqTt'.includes(lastCmd) ? 2 * curX - lastCtrlX : curX;
        const qy = 'QqTt'.includes(lastCmd) ? 2 * curY - lastCtrlY : curY;
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        const c1: Vec = [curX + (2 / 3) * (qx - curX), curY + (2 / 3) * (qy - curY)];
        const c2: Vec = [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)];
        segs.push([applyMat(mat, c1), applyMat(mat, c2), applyMat(mat, [x, y])]);
        lastCtrlX = qx;
        lastCtrlY = qy;
        curX = x;
        curY = y;
      } else if (upper === 'A') {
        ensureStart();
        const rx = nextNum();
        const ry = nextNum();
        const rot = nextNum();
        const large = nextNum();
        const sweep = nextNum();
        const x = nextNum() + (rel ? curX : 0);
        const y = nextNum() + (rel ? curY : 0);
        const cubics = arcToCubics(curX, curY, rx, ry, rot, large, sweep, x, y);
        for (const [c1, c2, end] of cubics) {
          segs.push([applyMat(mat, c1), applyMat(mat, c2), applyMat(mat, end)]);
        }
        curX = x;
        curY = y;
      } else {
        break;
      }
      lastCmd = cmd;
    } while (hasNum());
  }

  flush(false);
  return shapes;
}

function shapeToSvgPathD(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const num = (k: string, def = 0) => {
    const v = el.getAttribute(k);
    return v ? parseFloat(v) || def : def;
  };
  if (tag === 'path') return el.getAttribute('d');
  if (tag === 'circle') {
    const cx = num('cx');
    const cy = num('cy');
    const r = num('r');
    if (r <= 0) return null;
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  if (tag === 'ellipse') {
    const cx = num('cx');
    const cy = num('cy');
    const rx = num('rx');
    const ry = num('ry');
    if (rx <= 0 || ry <= 0) return null;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }
  if (tag === 'rect') {
    const x = num('x');
    const y = num('y');
    const w = num('width');
    const h = num('height');
    if (w <= 0 || h <= 0) return null;
    const rx = Math.min(w / 2, Math.max(0, num('rx', num('ry', 0))));
    const ry = Math.min(h / 2, Math.max(0, num('ry', rx)));
    if (rx === 0 || ry === 0) {
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }
    return [
      `M ${x + rx} ${y}`,
      `H ${x + w - rx}`,
      `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
      `V ${y + h - ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
      `H ${x + rx}`,
      `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
      `V ${y + ry}`,
      `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
      'Z',
    ].join(' ');
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const pts = (el.getAttribute('points')?.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/g) ?? []).map(Number);
    if (pts.length < 4) return null;
    const parts = [`M ${pts[0]} ${pts[1]}`];
    for (let i = 2; i + 1 < pts.length; i += 2) parts.push(`L ${pts[i]} ${pts[i + 1]}`);
    if (tag === 'polygon') parts.push('Z');
    return parts.join(' ');
  }
  if (tag === 'line') {
    return `M ${num('x1')} ${num('y1')} L ${num('x2')} ${num('y2')}`;
  }
  return null;
}

function computeLogoBounds(layers: VectorLogoLayer[]): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    for (const p of layer.paths) {
      const k = (p.ks as { k?: { v?: Vec[] } })?.k;
      for (const pt of k?.v ?? []) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, width: 100, height: 100 };
  return {
    minX: round(minX, 2),
    minY: round(minY, 2),
    width: Math.max(1, round(maxX - minX, 2)),
    height: Math.max(1, round(maxY - minY, 2)),
  };
}

interface InheritedStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillRule?: 'nonzero' | 'evenodd';
  opacity: number;
}

/** Parses an SVG string into a pure Lottie-compatible `VectorLogo`. */
export function parseSvgToVectorLogo(svgText: string, name = 'SVG Лого'): VectorLogo {
  const parser = new DOMParser();
  const xml = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = xml.querySelector('svg');
  if (!svgEl) throw new Error('В файле не найден тег <svg>.');

  // Collect CSS class rules from <style> blocks (Illustrator / Figma exports)
  const classStyles = new Map<string, Record<string, string>>();
  xml.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.textContent ?? '';
    const ruleRe = /([^{]+)\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css)) !== null) {
      const selectors = m[1].split(',').map((s) => s.trim());
      const props: Record<string, string> = {};
      m[2].split(';').forEach((decl) => {
        const idx = decl.indexOf(':');
        if (idx > 0) props[decl.slice(0, idx).trim().toLowerCase()] = decl.slice(idx + 1).trim();
      });
      for (const sel of selectors) {
        classStyles.set(sel, { ...(classStyles.get(sel) ?? {}), ...props });
      }
    }
  });

  // Resolve gradient IDs to representative stop colors
  const gradients = new Map<string, string>();
  xml.querySelectorAll('linearGradient, radialGradient').forEach((grad) => {
    const id = grad.getAttribute('id');
    if (!id) return;
    let stops = Array.from(grad.querySelectorAll('stop'));
    if (!stops.length) {
      const href = (grad.getAttribute('href') ?? grad.getAttribute('xlink:href'))?.replace(/^#/, '');
      if (href) {
        const refGrad = xml.getElementById(href);
        if (refGrad) stops = Array.from(refGrad.querySelectorAll('stop'));
      }
    }
    for (const st of stops) {
      const inlineColor = st
        .getAttribute('style')
        ?.split(';')
        .map((s) => s.split(':'))
        .find(([k]) => k?.trim().toLowerCase() === 'stop-color')?.[1];
      const hex = parseCssColor(inlineColor ?? st.getAttribute('stop-color'), gradients);
      if (hex) {
        gradients.set(id, hex);
        break;
      }
    }
  });

  const SKIP_TAGS = new Set(['defs', 'clippath', 'mask', 'symbol', 'pattern', 'style', 'title', 'desc', 'metadata', 'text']);
  const layers: VectorLogoLayer[] = [];

  const readStyleMap = (el: Element): Record<string, string> => {
    const out: Record<string, string> = {};
    const tagStyle = classStyles.get(el.tagName.toLowerCase());
    if (tagStyle) Object.assign(out, tagStyle);
    const cls = el.getAttribute('class');
    if (cls) {
      for (const c of cls.split(/\s+/)) {
        const cStyle = classStyles.get(`.${c}`);
        if (cStyle) Object.assign(out, cStyle);
      }
    }
    for (const k of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'opacity', 'fill-opacity', 'display', 'visibility']) {
      const attr = el.getAttribute(k);
      if (attr !== null) out[k] = attr;
    }
    const inline = el.getAttribute('style');
    if (inline) {
      inline.split(';').forEach((decl) => {
        const i = decl.indexOf(':');
        if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
      });
    }
    return out;
  };

  const visit = (el: Element, parentMat: Mat2D, inherited: InheritedStyle) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    const localProps = readStyleMap(el);
    if (localProps.display === 'none' || localProps.visibility === 'hidden') return;

    const mat = mulMat(parentMat, parseTransformAttr(el.getAttribute('transform')));
    const opMult = localProps.opacity !== undefined ? parseFloat(localProps.opacity) : 1;
    const fillOp = localProps['fill-opacity'] !== undefined ? parseFloat(localProps['fill-opacity']) : 1;
    const style: InheritedStyle = {
      fill: localProps.fill ?? inherited.fill,
      stroke: localProps.stroke ?? inherited.stroke,
      strokeWidth:
        localProps['stroke-width'] !== undefined
          ? parseFloat(localProps['stroke-width']) || 0
          : inherited.strokeWidth,
      fillRule:
        localProps['fill-rule'] === 'evenodd'
          ? 'evenodd'
          : localProps['fill-rule'] === 'nonzero'
            ? 'nonzero'
            : inherited.fillRule,
      opacity: inherited.opacity * (Number.isFinite(opMult) ? opMult : 1),
    };

    const d = shapeToSvgPathD(el);
    if (d) {
      const paths = svgPathToShapes(d, mat);
      if (paths.length > 0) {
        const rawFill = style.fill ?? (tag === 'line' || tag === 'polyline' ? 'none' : '#ffffff');
        const fillHex = parseCssColor(rawFill, gradients);
        const strokeHex = parseCssColor(style.stroke, gradients);
        const strokeW = (style.strokeWidth ?? 1) * matScaleFactor(mat);
        const effOp = Math.round(Math.max(0, Math.min(1, style.opacity * (Number.isFinite(fillOp) ? fillOp : 1))) * 100);
        if ((fillHex || (strokeHex && strokeW > 0)) && effOp > 0) {
          layers.push({
            paths,
            fillHex,
            fillRule: style.fillRule === 'evenodd' ? 2 : 1,
            strokeHex,
            strokeWidth: strokeHex ? round(strokeW, 2) : 0,
            opacity: effOp,
          });
        }
      }
    }

    for (const child of Array.from(el.children)) {
      visit(child, mat, style);
    }
  };

  visit(svgEl, IDENT_MAT, { opacity: 1 });
  if (!layers.length) {
    throw new Error('В SVG не найдено векторных контуров (<path>, <circle>, <rect>, <polygon>).');
  }

  const bounds = computeLogoBounds(layers);
  return {
    id: `svg-${Date.now()}`,
    name,
    layers,
    ...bounds,
  };
}

// ---------- Raster Image (.png / .webp / .jpg) Contour Vectorizer ----------

function colorDistSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function removeBorderBackground(data: Uint8ClampedArray, w: number, h: number, mode: BgRemovalMode): void {
  if (mode === 'off') return;
  const corners: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  const opaqueCorners: [number, number, number][] = [];
  for (const [cx, cy] of corners) {
    const idx = (cy * w + cx) * 4;
    if (data[idx + 3] >= 220) {
      opaqueCorners.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }
  if (opaqueCorners.length < 3) return;

  // Find consensus corner color
  let bg: [number, number, number] | null = null;
  for (let i = 0; i < opaqueCorners.length; i++) {
    const matches = opaqueCorners.filter((c) => colorDistSq(c, opaqueCorners[i]) <= 30 * 30);
    if (matches.length >= (mode === 'auto' ? 3 : 2)) {
      bg = opaqueCorners[i];
      break;
    }
  }
  if (!bg) return;

  const tolSq = mode === 'on' ? 46 * 46 : 34 * 34;
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  const trySeed = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (data[i + 3] < 40 || colorDistSq([data[i], data[i + 1], data[i + 2]], bg!) <= tolSq) {
      visited[p] = 1;
      queue.push(p);
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) trySeed(x - 1, y);
    if (x + 1 < w) trySeed(x + 1, y);
    if (y > 0) trySeed(x, y - 1);
    if (y + 1 < h) trySeed(x, y + 1);
  }
}

function rdpSimplify(pts: Vec[], eps: number): Vec[] {
  if (pts.length <= 3) return pts;
  const epsSq = eps * eps;

  const segDistSq = (p: Vec, a: Vec, b: Vec): number => {
    let x = a[0];
    let y = a[1];
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)));
      x += dx * t;
      y += dy * t;
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };

  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDistSq(pts[i], pts[first], pts[last]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (maxD > epsSq && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

function closedLoopToSmoothShape(rawLoop: Vec[]): ShapeItem | null {
  if (rawLoop.length < 3) return null;
  // Remove collinear staircase midpoints first
  const clean: Vec[] = [];
  const n0 = rawLoop.length;
  for (let i = 0; i < n0; i++) {
    const prev = rawLoop[(i - 1 + n0) % n0];
    const cur = rawLoop[i];
    const next = rawLoop[(i + 1) % n0];
    const cross = (cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]);
    if (Math.abs(cross) > 1e-4) clean.push(cur);
  }
  if (clean.length < 3) return null;

  // Split closed loop at two furthest vertices so RDP works on closed ring
  let splitIdx = Math.floor(clean.length / 2);
  let bestDist = -1;
  for (let i = 1; i < clean.length; i++) {
    const d = (clean[i][0] - clean[0][0]) ** 2 + (clean[i][1] - clean[0][1]) ** 2;
    if (d > bestDist) {
      bestDist = d;
      splitIdx = i;
    }
  }
  const half1 = rdpSimplify(clean.slice(0, splitIdx + 1), 0.72);
  const half2 = rdpSimplify([...clean.slice(splitIdx), clean[0]], 0.72);
  const ring = [...half1.slice(0, -1), ...half2.slice(0, -1)];
  if (ring.length < 3) return null;

  // Corner-preserving curve smoothing: sharp corners stay crisp, gentle turns become smooth curves
  const m = ring.length;
  const isSharp = (i: number): boolean => {
    const prev = ring[(i - 1 + m) % m];
    const cur = ring[i];
    const next = ring[(i + 1) % m];
    const v1x = cur[0] - prev[0];
    const v1y = cur[1] - prev[1];
    const v2x = next[0] - cur[0];
    const v2y = next[1] - cur[1];
    const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (len < 1e-5) return true;
    const cos = (v1x * v2x + v1y * v2y) / len;
    return cos < 0.45; // > ~63 deg turn = keep sharp corner
  };

  const anchors: Vec[] = [];
  const segs: Segment[] = [];
  const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  for (let i = 0; i < m; i++) {
    const prev = ring[(i - 1 + m) % m];
    const cur = ring[i];
    anchors.push(isSharp(i) ? cur : mid(prev, cur));
  }

  for (let i = 0; i < m; i++) {
    const a0 = anchors[i];
    const a1 = anchors[(i + 1) % m];
    const corner = ring[i];
    if (isSharp(i)) {
      segs.push([a0, a1, a1]);
    } else {
      const nextCorner = ring[(i + 1) % m];
      if (isSharp((i + 1) % m)) {
        segs.push([a0, a1, a1]);
      } else {
        const c1: Vec = [a0[0] + (2 / 3) * (nextCorner[0] - a0[0]), a0[1] + (2 / 3) * (nextCorner[1] - a0[1])];
        const c2: Vec = [a1[0] + (2 / 3) * (nextCorner[0] - a1[0]), a1[1] + (2 / 3) * (nextCorner[1] - a1[1])];
        void corner;
        segs.push([c1, c2, a1]);
      }
    }
  }

  return bezierPath(anchors[0], segs, true);
}

function traceMaskToShapes(mask: Uint8Array, w: number, h: number): ShapeItem[] {
  interface DirEdge {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    dir: number; // 0=R, 1=D, 2=L, 3=U
    used: boolean;
  }

  const byStart = new Map<number, DirEdge[]>();
  const vKey = (x: number, y: number) => y * (w + 1) + x;
  const addEdge = (x0: number, y0: number, x1: number, y1: number, dir: number) => {
    const k = vKey(x0, y0);
    const list = byStart.get(k);
    const edge: DirEdge = { x0, y0, x1, y1, dir, used: false };
    if (list) list.push(edge);
    else byStart.set(k, [edge]);
  };

  const at = (x: number, y: number) => (x >= 0 && x < w && y >= 0 && y < h ? mask[y * w + x] : 0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!at(x, y - 1)) addEdge(x, y, x + 1, y, 0);
      if (!at(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
      if (!at(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
      if (!at(x - 1, y)) addEdge(x, y + 1, x, y, 3);
    }
  }

  const shapes: ShapeItem[] = [];
  for (const edges of byStart.values()) {
    for (const startEdge of edges) {
      if (startEdge.used) continue;
      const loop: Vec[] = [];
      let cur: DirEdge | undefined = startEdge;
      while (cur && !cur.used) {
        cur.used = true;
        loop.push([cur.x0, cur.y0]);
        if (cur.x1 === startEdge.x0 && cur.y1 === startEdge.y0) break;
        const candidates: DirEdge[] = (byStart.get(vKey(cur.x1, cur.y1)) ?? []).filter(
          (e) => !e.used,
        );
        if (!candidates.length) break;
        // Prefer right-turn (dir + 1) % 4 to cleanly separate saddle corners
        const rightDir: number = (cur.dir + 1) % 4;
        cur = candidates.find((e) => e.dir === rightDir) ?? candidates[0];
      }

      // Skip tiny 1-2px noise specks
      let area2 = 0;
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        area2 += a[0] * b[1] - b[0] * a[1];
      }
      if (Math.abs(area2) < 5) continue;

      const sh = closedLoopToSmoothShape(loop);
      if (sh) shapes.push(sh);
    }
  }
  return shapes;
}

/** Traces RGBA pixel data into a clean multi-color `VectorLogo`. */
export function traceRgbaToVectorLogo(
  rawRgba: Uint8ClampedArray,
  w: number,
  h: number,
  name = 'PNG Лого',
  opts: RasterTraceOptions = {},
): VectorLogo {
  const maxColors = Math.max(1, Math.min(10, opts.maxColors ?? 6));
  const data = new Uint8ClampedArray(rawRgba);
  removeBorderBackground(data, w, h, opts.removeBg ?? 'auto');

  // Collect opaque pixels into 5-bit buckets
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  let opaqueCount = 0;
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 105) continue;
    opaqueCount++;
    const r = data[p * 4];
    const g = data[p * 4 + 1];
    const b = data[p * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.count++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
    } else {
      bins.set(key, { count: 1, r, g, b });
    }
  }

  if (opaqueCount === 0) {
    throw new Error('Изображение полностью прозрачное (или весь фон был удалён).');
  }

  const sortedBins = [...bins.values()]
    .map((b) => ({
      count: b.count,
      rgb: [Math.round(b.r / b.count), Math.round(b.g / b.count), Math.round(b.b / b.count)] as [number, number, number],
    }))
    .sort((a, b) => b.count - a.count);

  const centroids: [number, number, number][] = [];
  for (const bin of sortedBins) {
    if (centroids.length >= maxColors) break;
    if (centroids.every((c) => colorDistSq(c, bin.rgb) >= 38 * 38)) {
      centroids.push([...bin.rgb]);
    }
  }
  if (!centroids.length) centroids.push([...sortedBins[0].rgb]);

  // 3 iterations of k-means refinement over bins
  for (let iter = 0; iter < 3; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const bin of sortedBins) {
      let best = 0;
      let bestD = Infinity;
      centroids.forEach((c, idx) => {
        const d = colorDistSq(c, bin.rgb);
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      });
      sums[best].r += bin.rgb[0] * bin.count;
      sums[best].g += bin.rgb[1] * bin.count;
      sums[best].b += bin.rgb[2] * bin.count;
      sums[best].n += bin.count;
    }
    sums.forEach((s, idx) => {
      if (s.n > 0) {
        centroids[idx] = [Math.round(s.r / s.n), Math.round(s.g / s.n), Math.round(s.b / s.n)];
      }
    });
  }

  const pixelCluster = new Int16Array(w * h).fill(-1);
  const clusterSizes = new Int32Array(centroids.length);
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 105) continue;
    const rgb: [number, number, number] = [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]];
    let best = 0;
    let bestD = Infinity;
    centroids.forEach((c, idx) => {
      const d = colorDistSq(c, rgb);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    });
    pixelCluster[p] = best;
    clusterSizes[best]++;
  }

  // Paint largest area clusters first (background -> foreground)
  const order = centroids
    .map((_, idx) => idx)
    .filter((idx) => clusterSizes[idx] >= 3)
    .sort((a, b) => clusterSizes[b] - clusterSizes[a]);

  const layers: VectorLogoLayer[] = [];
  for (const cIdx of order) {
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      if (pixelCluster[p] === cIdx) mask[p] = 1;
    }
    const paths = traceMaskToShapes(mask, w, h);
    if (paths.length > 0) {
      layers.push({
        paths,
        fillHex: rgbToHex(centroids[cIdx]),
        fillRule: 2,
        opacity: 100,
      });
    }
  }

  if (!layers.length) {
    throw new Error('Не удалось выделить чёткие контуры логотипа.');
  }

  const bounds = computeLogoBounds(layers);
  return {
    id: `img-${Date.now()}`,
    name,
    layers,
    ...bounds,
  };
}

/** Loads any `.svg`, `.png`, `.webp`, or `.jpg` file from disk and returns a `VectorLogo`. */
export async function fileToVectorLogo(file: File, opts: RasterTraceOptions = {}): Promise<VectorLogo> {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Логотип';
  if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
    const text = await file.text();
    return parseSvgToVectorLogo(text, baseName);
  }

  const res = opts.resolution ?? 112;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Не удалось прочитать картинку логотипа.'));
      el.src = url;
    });
    const natW = img.naturalWidth || img.width || res;
    const natH = img.naturalHeight || img.height || res;
    const scale = Math.min(1, res / Math.max(natW, natH));
    const w = Math.max(8, Math.round(natW * scale));
    const h = Math.max(8, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен в браузере.');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    return traceRgbaToVectorLogo(imgData.data, w, h, baseName, opts);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Built-in Crisp Vector Emblems ----------

function makePreset(id: string, name: string, specs: { d: string; fill: string; rule?: 1 | 2 }[]): VectorLogo {
  const layers: VectorLogoLayer[] = specs.map((s) => ({
    paths: svgPathToShapes(s.d),
    fillHex: s.fill,
    fillRule: s.rule ?? 1,
    opacity: 100,
  }));
  return { id, name, layers, ...computeLogoBounds(layers) };
}

export const BUILTIN_LOGOS: VectorLogo[] = [
  makePreset('preset_crown', 'Корона VIP', [
    { d: 'M 10 76 L 4 24 L 30 46 L 50 14 L 70 46 L 96 24 L 90 76 Z', fill: '#ffd54f' },
    { d: 'M 10 82 H 90 V 92 H 10 Z', fill: '#f59e0b' },
    { d: 'M 50 46 A 7 7 0 1 0 50 60 A 7 7 0 1 0 50 46 Z', fill: '#ff3366' },
  ]),
  makePreset('preset_verified', 'TG Галочка', [
    {
      d: 'M 50 4 L 63 14 L 79 12 L 84 28 L 96 39 L 90 54 L 96 69 L 84 80 L 79 96 L 63 94 L 50 104 L 37 94 L 21 96 L 16 80 L 4 69 L 10 54 L 4 39 L 16 28 L 21 12 L 37 14 Z',
      fill: '#2AABEE',
    },
    { d: 'M 43 72 L 26 55 L 34 47 L 43 56 L 67 32 L 75 40 Z', fill: '#ffffff' },
  ]),
  makePreset('preset_ton', 'TON Кристалл', [
    { d: 'M 50 6 A 44 44 0 1 0 50 94 A 44 44 0 1 0 50 6 Z', fill: '#0098EA' },
    {
      d: 'M 28 32 H 72 C 76 32 78 36 76 40 L 53 78 C 51 81 49 81 47 78 L 24 40 C 22 36 24 32 28 32 Z M 34 40 L 47 64 V 40 Z M 53 40 V 64 L 66 40 Z',
      fill: '#ffffff',
      rule: 2,
    },
  ]),
  makePreset('preset_diamond', 'Бриллиант', [
    { d: 'M 24 16 H 76 L 96 40 L 50 90 L 4 40 Z', fill: '#00e5ff' },
    { d: 'M 24 16 L 36 40 L 50 16 L 64 40 L 76 16 L 96 40 H 4 Z', fill: '#80f3ff' },
  ]),
  makePreset('preset_bolt', 'Молния', [
    { d: 'M 58 6 L 18 56 H 48 L 40 94 L 82 44 H 52 Z', fill: '#ffd54f' },
  ]),
  makePreset('preset_fire', 'Огонь', [
    {
      d: 'M 52 6 C 56 26 84 36 84 62 C 84 82 68 96 50 96 C 32 96 16 82 16 62 C 16 44 28 32 34 24 C 33 34 40 40 40 40 C 38 24 44 12 52 6 Z',
      fill: '#ff5722',
    },
    {
      d: 'M 50 44 C 58 54 66 60 66 72 C 66 82 59 90 50 90 C 41 90 34 82 34 72 C 34 62 42 54 50 44 Z',
      fill: '#ffd54f',
    },
  ]),
];

// Unused import guard helper: keep hexToRgb referenced if needed by callers
export { hexToRgb };
