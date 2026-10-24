import type { Effects, PixelGrid } from '../lib/effects';

interface Props {
  fx: Effects;
  layers: { ind: number; name: string }[];
  pixelStatus: string | null;
  onChange: <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>, merge?: boolean) => void;
}

const GRIDS: { grid: PixelGrid; label: string }[] = [
  { grid: 24, label: 'Крупные' },
  { grid: 32, label: 'Средние' },
  { grid: 48, label: 'Мелкие' },
];

export function EffectsPanel({ fx, layers, pixelStatus, onChange }: Props) {
  const targetSelect = (key: 'metal' | 'glitch' | 'hologram') => (
    <select
      className="fx-target"
      value={fx[key].target ?? ''}
      onChange={(e) => onChange(key, { target: e.target.value === '' ? null : Number(e.target.value) })}
      aria-label="К чему применить"
    >
      <option value="">Весь стикер</option>
      {layers.map((l) => (
        <option key={l.ind} value={l.ind}>
          Слой «{l.name}»
        </option>
      ))}
    </select>
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <h3>Эффекты</h3>
      </header>
      <ul className="fx-list">
        <li>
          <Toggle label="Пикселизация" on={fx.pixel.on} onChange={(on) => onChange('pixel', { on })} />
          {fx.pixel.on && (
            <div className="fx-opts">
              <div className="seg">
                {GRIDS.map((g) => (
                  <button key={g.grid} className={fx.pixel.grid === g.grid ? 'on' : ''} onClick={() => onChange('pixel', { grid: g.grid })}>
                    {g.label}
                  </button>
                ))}
              </div>
              {pixelStatus && <span className="muted small">{pixelStatus}</span>}
            </div>
          )}
        </li>
        <li>
          <Toggle label="Блеск металла" on={fx.metal.on} onChange={(on) => onChange('metal', { on })} />
          {fx.metal.on && <div className="fx-opts">{targetSelect('metal')}</div>}
        </li>
        <li>
          <Toggle label="Глитч" on={fx.glitch.on} onChange={(on) => onChange('glitch', { on })} />
          {fx.glitch.on && (
            <div className="fx-opts">
              {targetSelect('glitch')}
              <label className="fx-slider">
                <span className="muted small">Сила · {fx.glitch.strength}</span>
                <input
                  type="range"
                  min={4}
                  max={30}
                  value={fx.glitch.strength}
                  onChange={(e) => onChange('glitch', { strength: Number(e.target.value) }, true)}
                />
              </label>
            </div>
          )}
        </li>
        <li>
          <Toggle label="Голограмма" on={fx.hologram.on} onChange={(on) => onChange('hologram', { on })} />
          {fx.hologram.on && <div className="fx-opts">{targetSelect('hologram')}</div>}
        </li>
      </ul>
      <p className="muted small">
        Эффекты не трогают слои: их можно выключить в любой момент. В файл они попадают при скачивании.
      </p>
    </section>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden />
    </label>
  );
}
