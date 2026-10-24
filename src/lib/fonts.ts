import type { Font } from 'opentype.js';
import rubikCyr from '@fontsource/rubik/files/rubik-cyrillic-800-normal.woff?url';
import rubikLat from '@fontsource/rubik/files/rubik-latin-800-normal.woff?url';
import russoCyr from '@fontsource/russo-one/files/russo-one-cyrillic-400-normal.woff?url';
import russoLat from '@fontsource/russo-one/files/russo-one-latin-400-normal.woff?url';
import pacificoCyr from '@fontsource/pacifico/files/pacifico-cyrillic-400-normal.woff?url';
import pacificoLat from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';

/** Fonts are open (OFL) and split by alphabet, so each one is a list of files. */
export const FONTS = [
  { id: 'rubik', label: 'Rubik, жирный', css: '"Rubik", sans-serif', weight: 800, files: [rubikCyr, rubikLat] },
  { id: 'russo', label: 'Russo One', css: '"Russo One", sans-serif', weight: 400, files: [russoCyr, russoLat] },
  { id: 'pacifico', label: 'Pacifico, рукописный', css: '"Pacifico", cursive', weight: 400, files: [pacificoCyr, pacificoLat] },
] as const;

export type FontId = (typeof FONTS)[number]['id'];

const cache = new Map<FontId, Promise<Font[]>>();

export function loadFont(id: FontId): Promise<Font[]> {
  let pending = cache.get(id);
  if (!pending) {
    const def = FONTS.find((f) => f.id === id)!;
    // The font parser is loaded only when text is first needed.
    pending = import('opentype.js').then(({ parse }) =>
      Promise.all(
        def.files.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Не удалось загрузить шрифт ${def.label}`);
          return parse(await res.arrayBuffer());
        }),
      ),
    );
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }
  return pending;
}
