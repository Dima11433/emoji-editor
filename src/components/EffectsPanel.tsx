import { useRef } from 'react';
import type {
  Effects,
  ParticlePlacement,
  ParticleStyle,
  PixelGrid,
  ShimmerTint,
} from '../lib/effects';

interface Props {
  fx: Effects;
  layers: { ind: number; name: string }[];
  selectedCount?: number;
  pixelStatus: string | null;
  onChange: <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>, merge?: boolean) => void;
}

const GRIDS: { grid: PixelGrid; label: string }[] = [
  { grid: 24, label: 'Крупные' },
  { grid: 32, label: 'Средние' },
  { grid: 48, label: 'Мелкие' },
];

const SHIMMER_TINTS: { id: ShimmerTint; label: string }[] = [
  { id: 'white', label: 'Алмаз' },
  { id: 'gold', label: 'Золото' },
  { id: 'neon', label: 'Неон' },
];

const PARTICLE_STYLES: { id: ParticleStyle; label: string }[] = [
  { id: 'sparks', label: '✦ Искры' },
  { id: 'stars', label: '★ Звёзды' },
  { id: 'fire', label: '🔥 Огонь' },
  { id: 'neon', label: '⚡ Неон' },
];

const PARTICLE_PLACEMENTS: { id: ParticlePlacement; label: string }[] = [
  { id: 'front', label: 'Поверх стикера' },
  { id: 'back', label: 'Фоном сзади' },
];

export function EffectsPanel({ fx, layers, selectedCount = 1, pixelStatus, onChange }: Props) {
  const rafRef = useRef<number | null>(null);

  const throttledSliderChange = <K extends keyof Effects>(key: K, patch: Partial<Effects[K]>) => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        onChange(key, patch, true);
      });
    }
  };

  const targetSelect = (key: 'shimmer' | 'metal' | 'glitch' | 'hologram') => (
    <select
      className="fx-target"
      value={fx[key].target ?? ''}
      onChange={(e) =>
        onChange(key, { target: e.target.value === '' ? null : Number(e.target.value) })
      }
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
        {selectedCount > 1 && <span className="pill accent-pill">на {selectedCount} эмодзи</span>}
      </header>
      <ul className="fx-list">
        <li>
          <Toggle
            label="✨ Бегущий блик"
            on={fx.shimmer.on}
            onChange={(on) => onChange('shimmer', { on })}
          />
          {fx.shimmer.on && (
            <div className="fx-opts">
              <div className="seg">
                {SHIMMER_TINTS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={fx.shimmer.tint === t.id ? 'on' : ''}
                    onClick={() => onChange('shimmer', { tint: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {targetSelect('shimmer')}
            </div>
          )}
        </li>

        <li>
          <Toggle
            label="✦ Частицы и искры"
            on={fx.particles.on}
            onChange={(on) => onChange('particles', { on })}
          />
          {fx.particles.on && (
            <div className="fx-opts">
              <div className="fx-chip-grid">
                {PARTICLE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`logo-preset-chip ${fx.particles.style === st.id ? 'on' : ''}`}
                    onClick={() => onChange('particles', { style: st.id })}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="seg">
                {PARTICLE_PLACEMENTS.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    className={fx.particles.placement === pl.id ? 'on' : ''}
                    onClick={() => onChange('particles', { placement: pl.id })}
                  >
                    {pl.label}
                  </button>
                ))}
              </div>
              <label className="fx-slider">
                <span className="muted small">Количество · {fx.particles.count}</span>
                <input
                  type="range"
                  min={6}
                  max={20}
                  value={fx.particles.count}
                  onChange={(e) => throttledSliderChange('particles', { count: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
        </li>

        <li>
          <Toggle
            label="Блеск металла"
            on={fx.metal.on}
            onChange={(on) => onChange('metal', { on })}
          />
          {fx.metal.on && <div className="fx-opts">{targetSelect('metal')}</div>}
        </li>

        <li>
          <Toggle
            label="Голограмма"
            on={fx.hologram.on}
            onChange={(on) => onChange('hologram', { on })}
          />
          {fx.hologram.on && <div className="fx-opts">{targetSelect('hologram')}</div>}
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
                  onChange={(e) => throttledSliderChange('glitch', { strength: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
        </li>

        <li>
          <Toggle
            label="Пикселизация"
            on={fx.pixel.on}
            onChange={(on) => onChange('pixel', { on })}
          />
          {fx.pixel.on && (
            <div className="fx-opts">
              <div className="seg">
                {GRIDS.map((g) => (
                  <button
                    key={g.grid}
                    type="button"
                    className={fx.pixel.grid === g.grid ? 'on' : ''}
                    onClick={() => onChange('pixel', { grid: g.grid })}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {pixelStatus && <span className="muted small">{pixelStatus}</span>}
            </div>
          )}
        </li>
      </ul>
      <p className="muted small">
        Эффекты векторные и обратимые: их можно выключать в любой момент. В <code>.tgs</code> попадают при скачивании.
      </p>
    </section>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden />
    </label>
  );
}
