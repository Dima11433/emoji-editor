import type { PaletteEntry } from '../lib/colors';

interface Props {
  entries: PaletteEntry[];
  scopeName: string | null;
  onClearScope: () => void;
  onChange: (from: string, to: string) => void;
  onBulk: (op: 'hue-' | 'hue+' | 'gray' | 'invert') => void;
}

const places = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} место`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} места`;
  return `${n} мест`;
};

export function PalettePanel({ entries, scopeName, onClearScope, onChange, onBulk }: Props) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Цвета</h3>
        {scopeName ? (
          <button className="link" onClick={onClearScope} title="Показать цвета всего стикера">
            только «{scopeName}» ✕
          </button>
        ) : (
          <span className="muted small">весь стикер</span>
        )}
      </header>
      {entries.length === 0 && <p className="muted small">Цветов нет.</p>}
      <ul className="palette">
        {/* Keyed by position so an open color picker survives its own color change. */}
        {entries.map((e, idx) => (
          <li key={idx}>
            <label className="swatch" style={{ background: e.hex }}>
              <input type="color" value={e.hex} onChange={(ev) => onChange(e.hex, ev.target.value)} aria-label={`Заменить ${e.hex}`} />
            </label>
            <code>{e.hex}</code>
            <span className="muted small">{places(e.count)}</span>
          </li>
        ))}
      </ul>
      <div className="chips">
        <button onClick={() => onBulk('hue-')}>Оттенок −30°</button>
        <button onClick={() => onBulk('hue+')}>Оттенок +30°</button>
        <button onClick={() => onBulk('gray')}>Ч/Б</button>
        <button onClick={() => onBulk('invert')}>Инверсия</button>
      </div>
    </section>
  );
}
