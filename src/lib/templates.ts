import {
  CATALOG,
  TEMPLATE_CATEGORIES,
  PURE_ICON_TEMPLATE_IDS,
  isPureIconTemplate,
  type CatalogItem,
  type TemplateCategory,
} from './catalog';
import type { LottieDoc } from './lottie';
import { parseSticker } from './tgs';

export {
  CATALOG,
  TEMPLATE_CATEGORIES,
  PURE_ICON_TEMPLATE_IDS,
  isPureIconTemplate,
  type CatalogItem,
  type TemplateCategory,
};

const docCache = new Map<string, LottieDoc>();
const inflight = new Map<string, Promise<LottieDoc>>();

/** Returns a cached clone synchronously if already loaded, otherwise null. */
export function peekCatalogDoc(id: string): LottieDoc | null {
  const cached = docCache.get(id);
  return cached ? structuredClone(cached) : null;
}

/** Loads and parses a MAGNAT .tgs sticker from `public/templates/` with in-memory caching. */
export async function loadCatalogDoc(item: CatalogItem): Promise<LottieDoc> {
  const cached = docCache.get(item.id);
  if (cached) return structuredClone(cached);

  let pending = inflight.get(item.id);
  if (!pending) {
    const base = import.meta.env?.BASE_URL ?? './';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const url = `${prefix}${item.file}`;
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить эмодзи ${item.name} (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        const doc = parseSticker(new Uint8Array(buf));
        docCache.set(item.id, doc);
        return doc;
      })
      .finally(() => {
        inflight.delete(item.id);
      });
    inflight.set(item.id, pending);
  }

  const resolved = await pending;
  return structuredClone(resolved);
}
