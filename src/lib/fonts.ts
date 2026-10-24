import type { Font } from 'opentype.js';
import montCyr from '@fontsource/montserrat/files/montserrat-cyrillic-900-normal.woff?url';
import montLat from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff?url';
import unbCyr from '@fontsource/unbounded/files/unbounded-cyrillic-800-normal.woff?url';
import unbLat from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff?url';
import rubikCyr from '@fontsource/rubik/files/rubik-cyrillic-800-normal.woff?url';
import rubikLat from '@fontsource/rubik/files/rubik-latin-800-normal.woff?url';
import russoCyr from '@fontsource/russo-one/files/russo-one-cyrillic-400-normal.woff?url';
import russoLat from '@fontsource/russo-one/files/russo-one-latin-400-normal.woff?url';
import pacificoCyr from '@fontsource/pacifico/files/pacifico-cyrillic-400-normal.woff?url';
import pacificoLat from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';

/** Fonts are open (OFL) and split by alphabet, so each one is a list of files. */
export const FONTS = [
  { id: 'montserrat', label: 'Montserrat Black (Бренд)', css: '"Montserrat", sans-serif', weight: 900, files: [montCyr, montLat] },
  { id: 'unbounded', label: 'Unbounded (Широкий)', css: '"Unbounded", sans-serif', weight: 800, files: [unbCyr, unbLat] },
  { id: 'rubik', label: 'Rubik ExtraBold', css: '"Rubik", sans-serif', weight: 800, files: [rubikCyr, rubikLat] },
  { id: 'russo', label: 'Russo One (Техно)', css: '"Russo One", sans-serif', weight: 400, files: [russoCyr, russoLat] },
  { id: 'pacifico', label: 'Pacifico (Рукописный)', css: '"Pacifico", cursive', weight: 400, files: [pacificoCyr, pacificoLat] },
] as const;

export type FontId = (typeof FONTS)[number]['id'];

const cache = new Map<FontId, Promise<Font[]>>();

export function loadFont(id: FontId): Promise<Font[]> {
  let pending = cache.get(id);
  if (!pending) {
    const def = FONTS.find((f) => f.id === id) ?? FONTS[0];
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
