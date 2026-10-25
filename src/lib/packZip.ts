import JSZip from 'jszip';
import { applyShapeEffects, getEffects } from './effects';
import type { LottieDoc } from './lottie';
import { pixelate } from './pixelSample';
import { parseSticker, serialize, toTgsAutoFit } from './tgs';

export interface ExportableSticker {
  name: string;
  doc: LottieDoc;
}

/**
 * Creates a .zip archive containing ready-to-upload .tgs files for Telegram @Stickers
 * (and optional Lottie .json sources in `json/`).
 */
export async function createPackZip(
  stickers: ExportableSticker[],
  packTitle = 'magnat_emoji_pack',
  includeJson = false,
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(packTitle) || zip;
  const jsonFolder = includeJson ? folder.folder('json_source') : null;

  for (let i = 0; i < stickers.length; i++) {
    const s = stickers[i];
    const safeName =
      s.name
        .trim()
        .replace(/#/g, '')
        .replace(/·/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '') || 'emoji';
    const prefix = String(i + 1).padStart(3, '0');
    const baseName = `${prefix}_${safeName}`;
    const shaped = applyShapeEffects(s.doc);
    const fx = getEffects(s.doc);
    const rendered = fx.pixel.on ? (await pixelate(shaped, fx.pixel.grid)).doc : shaped;

    folder.file(`${baseName}.tgs`, toTgsAutoFit(rendered));
    if (jsonFolder) {
      jsonFolder.file(`${baseName}.json`, serialize(rendered));
    }
  }

  return await zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

/**
 * Reads all .tgs (or .json) stickers from an uploaded .zip archive.
 */
export async function importPackZip(data: ArrayBuffer | Uint8Array): Promise<ExportableSticker[]> {
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files)
    .filter((f) => !f.dir && !f.name.includes('__MACOSX') && /\.(tgs|json)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const hasTgs = entries.some((f) => /\.tgs$/i.test(f.name));
  const picked = hasTgs ? entries.filter((f) => /\.tgs$/i.test(f.name)) : entries;

  const out: ExportableSticker[] = [];
  for (const entry of picked) {
    try {
      const bytes = await entry.async('uint8array');
      const doc = parseSticker(bytes);
      const base = entry.name.split('/').pop() ?? entry.name;
      const clean = base.replace(/\.(tgs|json)$/i, '');
      out.push({ name: clean, doc });
    } catch {
      // Skip non-Lottie JSON or corrupted entries inside the zip
    }
  }
  if (!out.length) {
    throw new Error('В архиве .zip не найдено подходящих .tgs или Lottie .json эмодзи.');
  }
  return out;
}
