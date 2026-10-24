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
  for (const asset of doc.assets ?? []) {
    if (Array.isArray(asset.layers)) reindexLayers(asset.layers);
  }
  return doc;
}

export function cleanForExport(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanForExport);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_') || k === 'fx') continue;
      out[k] = cleanForExport(v);
    }
    return out;
  }
  return node;
}

export function serialize(doc: LottieDoc): string {
  const cleaned = cleanForExport(doc) as Record<string, unknown>;
  return JSON.stringify({ ...cleaned, tgs: 1 });
}

export function toTgs(doc: LottieDoc): Uint8Array<ArrayBuffer> {
  return gzip(new TextEncoder().encode(serialize(doc)), { level: 9 });
}

/**
 * Encodes a LottieDoc to .tgs and automatically applies lossless float/junk
 * optimization if the gzipped output exceeds Telegram's 64 KB limit.
 */
export function toTgsAutoFit(doc: LottieDoc, maxBytes = 64 * 1024): Uint8Array<ArrayBuffer> {
  const raw = toTgs(doc);
  if (raw.length <= maxBytes) return raw;
  const opt2 = toTgs(optimize(doc, 2));
  if (opt2.length <= maxBytes) return opt2;
  return toTgs(optimize(doc, 1));
}

export function tgsSize(doc: LottieDoc): number {
  return toTgs(doc).length;
}

const JUNK_KEYS = new Set(['mn', 'cl', 'ln', 'meta', 'markers', 'props', 'ix', 'np', 'cix', 'bm_rt']);

/** Shrinks the file: rounds numbers and drops fields players ignore. */
export function optimize(doc: LottieDoc, digits = 2): LottieDoc {
  const walk = (node: unknown, curDigits: number): unknown => {
    const f = 10 ** curDigits;
    if (typeof node === 'number') return Number.isInteger(node) ? node : Math.round(node * f) / f;
    if (Array.isArray(node)) return node.map((item) => walk(item, curDigits));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (JUNK_KEYS.has(k)) continue;
        if (k.startsWith('_')) {
          out[k] = v;
          continue;
        }
        // Colors and gradients keep 3+ digits (1/1000 > 8-bit 1/255) for exact RGB fidelity while trimming 16-digit floats.
        const nextDigits = k === 'c' || k === 'g' ? Math.max(curDigits, 3) : curDigits;
        out[k] = walk(v, nextDigits);
      }
      return out;
    }
    return node;
  };
  return walk(doc, digits) as LottieDoc;
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} кБ`;
}
