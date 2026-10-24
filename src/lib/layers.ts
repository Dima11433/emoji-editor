import type { Layer, LottieDoc, ShapeItem } from './lottie';
import { reindexLayers } from './lottie';

/** Address of a node: [layer index, ...group indexes inside shapes / it]. */
export type NodePath = number[];

export interface TreeNode {
  path: NodePath;
  name: string;
  kind: 'shape' | 'precomp' | 'null' | 'solid' | 'text' | 'image' | 'layer' | 'group';
  hidden: boolean;
  children: TreeNode[];
}

const LAYER_KINDS: Record<number, TreeNode['kind']> = { 0: 'precomp', 1: 'solid', 2: 'image', 3: 'null', 4: 'shape', 5: 'text' };

export function buildTree(doc: LottieDoc): TreeNode[] {
  return doc.layers.map((layer, idx) => ({
    path: [idx],
    name: layer.nm || `Слой ${idx + 1}`,
    kind: LAYER_KINDS[layer.ty] ?? 'layer',
    hidden: !!layer.hd,
    children: groupNodes(layer.shapes ?? [], [idx]),
  }));
}

function groupNodes(items: ShapeItem[], base: NodePath): TreeNode[] {
  const out: TreeNode[] = [];
  items.forEach((item, idx) => {
    if (item.ty !== 'gr') return;
    const path = [...base, idx];
    out.push({ path, name: item.nm || 'Группа', kind: 'group', hidden: !!item.hd, children: groupNodes(item.it ?? [], path) });
  });
  return out;
}

export function getNode(doc: LottieDoc, path: NodePath): Layer | ShapeItem | undefined {
  const [layerIdx, ...rest] = path;
  let node: Layer | ShapeItem | undefined = doc.layers[layerIdx];
  let items: ShapeItem[] | undefined = (node as Layer | undefined)?.shapes;
  for (const idx of rest) {
    node = items?.[idx];
    items = node?.it;
  }
  return node;
}

/** Everything a palette should read for this node; precomp layers include their asset. */
export function colorScope(doc: LottieDoc, path: NodePath | null): unknown {
  if (!path) return doc;
  const node = getNode(doc, path);
  if (node && path.length === 1 && (node as Layer).ty === 0) {
    const asset = doc.assets?.find((a) => a.id === (node as Layer).refId);
    return [node, asset];
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

/** Removes a layer or group. Children of a removed parent layer stay where they are on screen only roughly, so they are detached. */
export function removeNode(doc: LottieDoc, path: NodePath): void {
  if (path.length === 1) {
    const [removed] = doc.layers.splice(path[0], 1);
    for (const layer of doc.layers) if (layer.parent === removed?.ind) delete layer.parent;
    return;
  }
  const list = parentList(doc, path);
  list?.splice(path[path.length - 1], 1);
}

/** Moves a layer or group one step up (towards the front) or down. Returns the new path. */
export function moveNode(doc: LottieDoc, path: NodePath, dir: -1 | 1): NodePath {
  const list: unknown[] | undefined = path.length === 1 ? doc.layers : parentList(doc, path);
  if (!list) return path;
  const from = path[path.length - 1];
  let to = from + dir;
  // Inside a group, skip non-group items so groups swap with groups.
  if (path.length > 1) {
    while (to >= 0 && to < list.length && (list[to] as ShapeItem).ty !== 'gr') to += dir;
    if ((list[to] as ShapeItem | undefined)?.ty !== 'gr') return path;
  }
  if (to < 0 || to >= list.length) return path;
  [list[from], list[to]] = [list[to], list[from]];
  return [...path.slice(0, -1), to];
}

export function duplicateNode(doc: LottieDoc, path: NodePath): NodePath {
  const node = getNode(doc, path);
  if (!node) return path;
  const copy = structuredClone(node);
  copy.nm = `${node.nm ?? 'Копия'} (копия)`;
  const at = path[path.length - 1];
  if (path.length === 1) {
    delete (copy as Layer).ind;
    doc.layers.splice(at, 0, copy as Layer);
    reindexLayers(doc.layers);
  } else {
    parentList(doc, path)?.splice(at, 0, copy as ShapeItem);
  }
  return path;
}

function parentList(doc: LottieDoc, path: NodePath): ShapeItem[] | undefined {
  if (path.length === 2) return doc.layers[path[0]]?.shapes;
  return (getNode(doc, path.slice(0, -1)) as ShapeItem | undefined)?.it;
}

export const samePath = (a: NodePath | null, b: NodePath | null) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
