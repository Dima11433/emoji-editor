import JSZip from 'jszip';
import type { LottieDoc } from './lottie';
import { serialize, toTgs } from './tgs';

export interface ExportableSticker {
  name: string;
  doc: LottieDoc;
}

/**
 * Creates a .zip archive containing .tgs and .json for all stickers in the pack,
 * ready for Telegram sticker bot or backup.
 */
export async function createPackZip(
  stickers: ExportableSticker[],
  packTitle = 'emoji_pack',
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(packTitle) || zip;

  for (let i = 0; i < stickers.length; i++) {
    const s = stickers[i];
    const safeName = s.name.trim().replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_') || 'sticker';
    const prefix = String(i + 1).padStart(2, '0');
    const baseName = `${prefix}_${safeName}`;

    // Telegram animated sticker (.tgs)
    const tgsBytes = toTgs(s.doc);
    folder.file(`${baseName}.tgs`, tgsBytes);

    // Lottie source (.json)
    folder.file(`${baseName}.json`, serialize(s.doc));
  }

  return await zip.generateAsync({ type: 'blob' });
}
