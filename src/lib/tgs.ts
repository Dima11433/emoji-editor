import { gzip, ungzip } from 'pako';
import { reindexLayers, type LottieDoc } from './lottie';

/** Reads a .tgs (gzipped Lottie) or plain Lottie .json file. */
export function parseSticker(bytes: Uint8Array): LottieDoc {
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = new TextDecoder().decode(isGzip ? ungzip(bytes) : bytes);
  let doc: LottieDoc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error('Файл не похож на стикер: это не Lottie JSON.');
  }
  if (!doc || !Array.isArray(doc.layers) || typeof doc.w !== 'number' || typeof doc.fr !== 'number') {
    throw new Error('В файле нет анимации Lottie (нет слоёв или размеров).');
  }
  reindexLayers(doc.layers);
  return doc;
}

export function serialize(doc: LottieDoc): string {
  return JSON.stringify({ ...doc, tgs: 1 });
}

export function toTgs(doc: LottieDoc): Uint8Array<ArrayBuffer> {
  return gzip(new TextEncoder().encode(serialize(doc)), { level: 9 });
}

export function tgsSize(doc: LottieDoc): number {
  return toTgs(doc).length;
}

const JUNK_KEYS = new Set(['mn', 'cl', 'ln', 'meta', 'markers', 'props', 'ix', 'np', 'cix', 'bm_rt']);

/** Shrinks the file: rounds numbers and drops fields players ignore. */
export function optimize(doc: LottieDoc, digits = 2): LottieDoc {
  const f = 10 ** digits;
  const walk = (node: unknown): unknown => {
    if (typeof node === 'number') return Number.isInteger(node) ? node : Math.round(node * f) / f;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (JUNK_KEYS.has(k)) continue;
        // Colors need more precision than 2 digits to stay exact.
        out[k] = k === 'c' || k === 'g' ? v : walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(doc) as LottieDoc;
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} кБ`;
}
