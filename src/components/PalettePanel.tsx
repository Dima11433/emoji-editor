import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { COLOR_THEMES, type ColorThemeId, type PaletteEntry } from '../lib/colors';

export type BulkColorOp =
  | 'hue-'
  | 'hue+'
  | 'sat+'
  | 'light+'
  | 'light-'
  | 'gray'
  | 'invert';

interface Props {
  entries: PaletteEntry[];
  scopeName: string | null;
  selectedCount: number;
  packCount: number;
  onClearScope: () => void;
  onChange: (from: string, to: string) => void;
  onTheme: (themeId: ColorThemeId) => void;
  onThemeToPack: (themeId: ColorThemeId) => void;
  onBulk: (op: BulkColorOp) => void;
}

const places = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} место`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} места`;
  return `${n} мест`;
};

export function PalettePanel({
  entries,
  scopeName,
  selectedCount,
  packCount,
  onClearScope,
  onChange,
  onTheme,
  onThemeToPack,
  onBulk,
}: Props) {
  const [activeTheme, setActiveTheme] = useState<ColorThemeId | null>(null);

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Цвета и 3D-темы</h3>
        {scopeName ? (
          <button className="link" onClick={onClearScope} title="Показать цвета всего стикера">
            только «{scopeName}» ✕
          </button>
        ) : selectedCount > 1 ? (
          <span className="accent-tag small">все {selectedCount} эмодзи ({entries.length})</span>
        ) : (
          <span className="muted small">весь стикер ({entries.length})</span>
        )}
      </header>

      {entries.length > 0 && (
        <div className="theme-box">
          <span className="muted tiny">
            {selectedCount > 1 && !scopeName
              ? `Быстрая 3D-перекраска сразу всех ${selectedCount} выбранных эмодзи:`
              : 'Быстрая 3D-перекраска (включая все градиенты):'}
          </span>
          <div className="theme-grid">
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-chip ${activeTheme === t.id ? 'on' : ''}`}
                onClick={() => {
                  setActiveTheme(t.id);
                  onTheme(t.id);
                }}
                title={`Перекрасить в стиль «${t.label}»`}
              >
                <i style={{ background: t.swatch }} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {packCount > selectedCount && packCount > 1 && !scopeName && activeTheme && (
            <button
              type="button"
              className="mini-pack-theme-btn"
              onClick={() => onThemeToPack(activeTheme)}
            >
              <CheckCheck size={13} />
              <span>
                Перекрасить весь пак ({packCount}) в «
                {COLOR_THEMES.find((x) => x.id === activeTheme)?.label}»
              </span>
            </button>
          )}
        </div>
      )}

      {entries.length === 0 && <p className="muted small">Цветов нет.</p>}
      <ul className="palette">
        {/* Keyed by position so an open color picker survives its own color change. */}
        {entries.map((e, idx) => (
          <li key={idx}>
            <label className="swatch" style={{ background: e.hex }}>
              <input
                type="color"
                value={e.hex}
                onChange={(ev) => onChange(e.hex, ev.target.value)}
                aria-label={`Заменить ${e.hex}`}
              />
            </label>
            <code>{e.hex}</code>
            <span className="muted small">{places(e.count)}</span>
          </li>
        ))}
      </ul>
      <div className="chips">
        <button type="button" onClick={() => onBulk('hue-')}>
          Оттенок −30°
        </button>
        <button type="button" onClick={() => onBulk('hue+')}>
          Оттенок +30°
        </button>
        <button type="button" onClick={() => onBulk('sat+')}>
          Сочнее +
        </button>
        <button type="button" onClick={() => onBulk('light+')}>
          Ярче +
        </button>
        <button type="button" onClick={() => onBulk('light-')}>
          Темнее −
        </button>
        <button type="button" onClick={() => onBulk('gray')}>
          Ч/Б
        </button>
        <button type="button" onClick={() => onBulk('invert')}>
          Инверсия
        </button>
      </div>
    </section>
  );
}
