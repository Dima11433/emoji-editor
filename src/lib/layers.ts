import { INJECTED_BRAND_LAYER_NAME, isBrandSlotNode } from './brandSlot';
import {
  fixed,
  groupTransform,
  layerTransform,
  reindexLayers,
  round,
  type Asset,
  type Layer,
  type LottieDoc,
  type ShapeItem,
} from './lottie';

/**
 * Address of a node:
 * - Root layer & its shape groups: [layerIdx, ...groupIdxs]
 * - Asset layer & its shape groups: ['asset:<id>', layerIdx, ...groupIdxs]
 */
export type NodePath = (number | string)[];

export interface TreeNode {
  path: NodePath;
  name: string;
  kind: 'shape' | 'precomp' | 'null' | 'solid' | 'text' | 'image' | 'layer' | 'group';
  hidden: boolean;
  isBrand: boolean;
  children: TreeNode[];
}

const LAYER_KINDS: Record<number, TreeNode['kind']> = {
  0: 'precomp',
  1: 'solid',
  2: 'image',
  3: 'null',
  4: 'shape',
  5: 'text',
};

const KIND_FALLBACK: Record<TreeNode['kind'], string> = {
  precomp: 'Композиция',
  solid: 'Заливка',
  image: 'Картинка',
  null: 'Контроллер',
  shape: 'Фигура',
  text: 'Текст',
  layer: 'Слой',
  group: 'Группа',
};

const UUID_RE = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?(_\{?[0-9a-f-]{8,}\}?)*$/i;
const HASH_SUFFIX_RE = /(_[A-Za-z0-9]{10,})+$/;

function cleanName(raw: string | undefined, fallback: string, isBrand: boolean): string {
  if (raw === 'tier_text' || raw === 'mylogo') return 'Надпись бренда';
  if (raw === 'tier_extrude_shadow') return '3D-тень надписи';
  if (raw === 'tier_logo_slot' || raw === INJECTED_BRAND_LAYER_NAME) return 'Слот бренда';
  if (raw === 'brand_plate') return 'Плашка бренда';
  if (raw === 'tier_text_part') return 'Текст бренда';
  const trimmed = raw?.trim().replace(HASH_SUFFIX_RE, '').trim();
  if (!trimmed || trimmed === 'undefined' || UUID_RE.test(trimmed)) {
    return isBrand ? 'Слот бренда' : fallback;
  }
  return trimmed;
}

export function buildTree(doc: LottieDoc): TreeNode[] {
  return buildLayerNodes(doc, doc.layers, [], new Set<string>());
}

function buildLayerNodes(
  doc: LottieDoc,
  layers: Layer[],
  prefix: NodePath,
  visitedAssets: Set<string>,
): TreeNode[] {
  return layers.map((layer, idx) => {
    const path: NodePath = [...prefix, idx];
    const kind = LAYER_KINDS[layer.ty] ?? 'layer';
    let children: TreeNode[] = [];
    let hasBrandChild = false;
    let assetLabel: string | undefined;

    if (layer.ty === 0 && layer.refId && !visitedAssets.has(layer.refId)) {
      const asset = doc.assets?.find((a) => a.id === layer.refId);
      if (typeof asset?.nm === 'string' && asset.nm.trim() && !UUID_RE.test(asset.nm.trim())) {
        assetLabel = asset.nm.trim();
      }
      if (asset?.layers?.length) {
        const nextVisited = new Set(visitedAssets);
        nextVisited.add(layer.refId);
        children = buildLayerNodes(doc, asset.layers, [`asset:${layer.refId}`], nextVisited);
        hasBrandChild = children.some((c) => c.isBrand);
      }
    } else if (layer.shapes?.length) {
      children = groupNodes(layer.shapes, path);
      hasBrandChild = children.some((c) => c.isBrand);
    }

    const isBrand = isBrandSlotNode(layer) || hasBrandChild;
    const fallback = assetLabel || `${KIND_FALLBACK[kind]} ${idx + 1}`;
    const rawName =
      layer.ty === 0 && assetLabel && (!layer.nm || /^Precomposition Layer \d+$/i.test(layer.nm))
        ? assetLabel
        : layer.nm;

    return {
      path,
      name: cleanName(rawName, fallback, isBrand && !hasBrandChild),
      kind,
      hidden: !!layer.hd,
      isBrand,
      children,
    };
  });
}

function groupNodes(items: ShapeItem[], base: NodePath): TreeNode[] {
  const out: TreeNode[] = [];
  items.forEach((item, idx) => {
    if (item.ty !== 'gr') return;
    const path: NodePath = [...base, idx];
    const children = groupNodes(item.it ?? [], path);
    const hasBrandChild = children.some((c) => c.isBrand);
    const directBrand = isBrandSlotNode(item);
    const isBrand = directBrand || hasBrandChild;
    out.push({
      path,
      name: cleanName(item.nm, `Группа ${out.length + 1}`, directBrand),
      kind: 'group',
      hidden: !!item.hd,
      isBrand,
      children,
    });
  });
  return out;
}

/** Finds the first brand-slot node path in the tree for quick jump/select. */
export function findBrandNodePath(tree: TreeNode[]): NodePath | null {
  for (const n of tree) {
    if (n.isBrand) {
      const deeper = findBrandNodePath(n.children);
      return deeper ?? n.path;
    }
  }
  return null;
}

interface ResolvedPath {
  layers: Layer[] | undefined;
  layerIdx: number;
  groupIdxs: number[];
}

function resolvePath(doc: LottieDoc, path: NodePath): ResolvedPath {
  if (typeof path[0] === 'string' && path[0].startsWith('asset:')) {
    const assetId = path[0].slice(6);
    const asset = doc.assets?.find((a) => a.id === assetId);
    return {
      layers: asset?.layers,
      layerIdx: Number(path[1]),
      groupIdxs: path.slice(2).map(Number),
    };
  }
  return {
    layers: doc.layers,
    layerIdx: Number(path[0]),
    groupIdxs: path.slice(1).map(Number),
  };
}

export function getNode(doc: LottieDoc, path: NodePath): Layer | ShapeItem | undefined {
  if (!path.length) return undefined;
  const { layers, layerIdx, groupIdxs } = resolvePath(doc, path);
  let node: Layer | ShapeItem | undefined = layers?.[layerIdx];
  let items: ShapeItem[] | undefined = (node as Layer | undefined)?.shapes;
  for (const idx of groupIdxs) {
    node = items?.[idx];
    items = (node as ShapeItem | undefined)?.it;
  }
  return node;
}

/** Collects all precomp assets reachable from `startRefId` (transitively). */
export function collectTransitiveAssets(doc: LottieDoc, startRefId: string | undefined): Asset[] {
  if (!startRefId || !doc.assets?.length) return [];
  const visited = new Set<string>();
  const result: Asset[] = [];
  const queue = [startRefId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const asset = doc.assets.find((a) => a.id === id);
    if (!asset) continue;
    result.push(asset);
    for (const l of asset.layers ?? []) {
      if (l.ty === 0 && l.refId && !visited.has(l.refId)) queue.push(l.refId);
    }
  }
  return result;
}

/** Everything a palette should read/write for this node; precomp layers include all transitive assets. */
export function colorScope(doc: LottieDoc, path: NodePath | null): unknown {
  if (!path) return doc;
  const node = getNode(doc, path);
  if (!node) return doc;
  if ('ty' in node && typeof node.ty === 'number' && node.ty === 0) {
    const precompLayer = node as Layer;
    return [precompLayer, ...collectTransitiveAssets(doc, precompLayer.refId)];
  }
  return node;
}

export function toggleHidden(doc: LottieDoc, path: NodePath): void {
  const node = getNode(doc, path);
  if (node) node.hd = !node.hd;
}

export function rename(doc: LottieDoc, path: NodePath, name: string): void {
  const node = getNode(doc, path);
  if (node) node.nm = name;
}

export function removeNode(doc: LottieDoc, path: NodePath): void {
  const { layers, layerIdx, groupIdxs } = resolvePath(doc, path);
  if (!layers) return;
  if (groupIdxs.length === 0) {
    const [removed] = layers.splice(layerIdx, 1);
    for (const layer of layers) if (layer.parent === removed?.ind) delete layer.parent;
    return;
  }
  const list = parentShapeList(layers, layerIdx, groupIdxs);
  list?.splice(groupIdxs[groupIdxs.length - 1], 1);
}

/** Moves a layer or group one step up (towards front) or down. Returns the new path. */
export function moveNode(doc: LottieDoc, path: NodePath, dir: -1 | 1): NodePath {
  const { layers, layerIdx, groupIdxs } = resolvePath(doc, path);
  if (!layers) return path;

  if (groupIdxs.length === 0) {
    const to = layerIdx + dir;
    if (to < 0 || to >= layers.length) return path;
    [layers[layerIdx], layers[to]] = [layers[to], layers[layerIdx]];
    return [...path.slice(0, -1), to];
  }

  const list = parentShapeList(layers, layerIdx, groupIdxs);
  if (!list) return path;
  const from = groupIdxs[groupIdxs.length - 1];
  let to = from + dir;
  while (to >= 0 && to < list.length && list[to].ty !== 'gr') to += dir;
  if (list[to]?.ty !== 'gr') return path;
  [list[from], list[to]] = [list[to], list[from]];
  return [...path.slice(0, -1), to];
}

export function duplicateNode(doc: LottieDoc, path: NodePath): NodePath {
  const node = getNode(doc, path);
  if (!node) return path;
  const { layers, layerIdx, groupIdxs } = resolvePath(doc, path);
  if (!layers) return path;

  const copy = structuredClone(node);
  copy.nm = `${node.nm || 'Элемент'} (копия)`;

  if (groupIdxs.length === 0) {
    delete (copy as Layer).ind;
    layers.splice(layerIdx, 0, copy as Layer);
    reindexLayers(layers);
  } else {
    const list = parentShapeList(layers, layerIdx, groupIdxs);
    list?.splice(groupIdxs[groupIdxs.length - 1], 0, copy as ShapeItem);
  }
  return path;
}

function parentShapeList(layers: Layer[], layerIdx: number, groupIdxs: number[]): ShapeItem[] | undefined {
  let items = layers[layerIdx]?.shapes;
  for (let i = 0; i < groupIdxs.length - 1; i++) {
    items = items?.[groupIdxs[i]]?.it;
  }
  return items;
}

export interface TransformDelta {
  dx?: number;
  dy?: number;
  scaleFactorX?: number;
  scaleFactorY?: number;
  rotateDeg?: number;
  opacity?: number;
}

function shiftNumberProp(prop: Record<string, unknown>, delta: number): void {
  if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const kf of prop.k as Record<string, unknown>[]) {
      if (Array.isArray(kf.s) && typeof kf.s[0] === 'number') kf.s[0] = round(kf.s[0] + delta, 2);
      if (Array.isArray(kf.e) && typeof kf.e[0] === 'number') kf.e[0] = round(kf.e[0] + delta, 2);
    }
  } else if (typeof prop.k === 'number') {
    prop.k = round(prop.k + delta, 2);
  } else if (Array.isArray(prop.k) && typeof prop.k[0] === 'number') {
    prop.k[0] = round(prop.k[0] + delta, 2);
  }
}

function shiftVecProp(prop: Record<string, unknown>, dx: number, dy: number): void {
  if (prop.s === true) {
    if (dx && prop.x && typeof prop.x === 'object') shiftNumberProp(prop.x as Record<string, unknown>, dx);
    if (dy && prop.y && typeof prop.y === 'object') shiftNumberProp(prop.y as Record<string, unknown>, dy);
    return;
  }
  if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const kf of prop.k as Record<string, unknown>[]) {
      if (Array.isArray(kf.s) && typeof kf.s[0] === 'number' && typeof kf.s[1] === 'number') {
        kf.s[0] = round(kf.s[0] + dx, 2);
        kf.s[1] = round(kf.s[1] + dy, 2);
      }
      if (Array.isArray(kf.e) && typeof kf.e[0] === 'number' && typeof kf.e[1] === 'number') {
        kf.e[0] = round(kf.e[0] + dx, 2);
        kf.e[1] = round(kf.e[1] + dy, 2);
      }
    }
  } else if (Array.isArray(prop.k) && typeof prop.k[0] === 'number' && typeof prop.k[1] === 'number') {
    prop.k[0] = round(prop.k[0] + dx, 2);
    prop.k[1] = round(prop.k[1] + dy, 2);
  }
}

function scaleVecProp(prop: Record<string, unknown>, fx: number, fy: number): void {
  if (prop.a === 1 && Array.isArray(prop.k)) {
    for (const kf of prop.k as Record<string, unknown>[]) {
      if (Array.isArray(kf.s) && typeof kf.s[0] === 'number' && typeof kf.s[1] === 'number') {
        kf.s[0] = round(kf.s[0] * fx, 2);
        kf.s[1] = round(kf.s[1] * fy, 2);
      }
      if (Array.isArray(kf.e) && typeof kf.e[0] === 'number' && typeof kf.e[1] === 'number') {
        kf.e[0] = round(kf.e[0] * fx, 2);
        kf.e[1] = round(kf.e[1] * fy, 2);
      }
    }
  } else if (Array.isArray(prop.k) && typeof prop.k[0] === 'number' && typeof prop.k[1] === 'number') {
    prop.k[0] = round(prop.k[0] * fx, 2);
    prop.k[1] = round(prop.k[1] * fy, 2);
  }
}

/** Reads the current opacity (0..100) of a layer or group (first keyframe if animated). */
export function readNodeOpacity(doc: LottieDoc, path: NodePath): number {
  const node = getNode(doc, path);
  if (!node) return 100;
  let tr: Record<string, unknown> | undefined;
  if ('ty' in node && typeof node.ty === 'number') {
    tr = (node as Layer).ks;
  } else if ((node as ShapeItem).ty === 'gr') {
    tr = (node as ShapeItem).it?.find((x) => x.ty === 'tr') as Record<string, unknown> | undefined;
  }
  const o = tr?.o as { a?: number; k?: unknown } | undefined;
  if (!o) return 100;
  if (typeof o.k === 'number') return Math.round(o.k);
  if (Array.isArray(o.k) && typeof o.k[0] === 'number') return Math.round(o.k[0]);
  if (o.a === 1 && Array.isArray(o.k)) {
    const s = (o.k[0] as { s?: unknown } | undefined)?.s;
    if (Array.isArray(s) && typeof s[0] === 'number') return Math.round(s[0]);
  }
  return 100;
}

/**
 * Adjusts position, scale, rotation, or opacity on any layer or shape group,
 * preserving keyframe animations (`a: 1`) when present.
 */
export function adjustNodeTransform(doc: LottieDoc, path: NodePath, delta: TransformDelta): void {
  const node = getNode(doc, path);
  if (!node) return;

  let tr: Record<string, unknown> | undefined;
  let isGroup = false;

  if ('ty' in node && typeof node.ty === 'number') {
    const layer = node as Layer;
    if (!layer.ks) layer.ks = layerTransform();
    tr = layer.ks;
  } else if ((node as ShapeItem).ty === 'gr') {
    isGroup = true;
    const gr = node as ShapeItem;
    if (!gr.it) gr.it = [];
    let trItem = gr.it.find((x) => x.ty === 'tr');
    if (!trItem) {
      trItem = groupTransform();
      gr.it.push(trItem);
    }
    tr = trItem as Record<string, unknown>;
  }
  if (!tr) return;

  if (delta.dx || delta.dy) {
    if (!tr.p || typeof tr.p !== 'object') tr.p = fixed(isGroup ? [0, 0] : [256, 256, 0]);
    shiftVecProp(tr.p as Record<string, unknown>, delta.dx ?? 0, delta.dy ?? 0);
  }
  if ((delta.scaleFactorX && delta.scaleFactorX !== 1) || (delta.scaleFactorY && delta.scaleFactorY !== 1)) {
    if (!tr.s || typeof tr.s !== 'object') tr.s = fixed(isGroup ? [100, 100] : [100, 100, 100]);
    scaleVecProp(tr.s as Record<string, unknown>, delta.scaleFactorX ?? 1, delta.scaleFactorY ?? 1);
  }
  if (delta.rotateDeg) {
    if (!tr.r || typeof tr.r !== 'object') tr.r = fixed(0);
    shiftNumberProp(tr.r as Record<string, unknown>, delta.rotateDeg);
  }
  if (delta.opacity !== undefined) {
    const clamped = Math.max(0, Math.min(100, Math.round(delta.opacity)));
    tr.o = fixed(clamped);
  }
}

export const samePath = (a: NodePath | null, b: NodePath | null) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
