import { useState } from 'react';
import { CheckCheck, Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import type { BrandSlotOptions } from '../lib/brandSlot';
import { FONTS, type FontId } from '../lib/fonts';

interface BrandPanelProps {
  slotCount: number;
  options: BrandSlotOptions;
  packCount: number;
  busy: boolean;
  onChange: (next: BrandSlotOptions, mergeKey?: string) => void;
  onReset: () => void;
  onApplyToPack: (opts: BrandSlotOptions, keepStickerColor: boolean) => void;
  onSwitchToAddText: () => void;
}

const BRAND_SWATCHES = [
  { hex: '#ffffff', title: 'Белый' },
  { hex: '#ffd54f', title: 'Золотой' },
  { hex: '#00f59b', title: 'Неон' },
  { hex: '#00e5ff', title: 'Голубой' },
  { hex: '#ff3366', title: 'Алый' },
  { hex: '#b366ff', title: 'Фиолетовый' },
  { hex: '#ff8a00', title: 'Оранжевый' },
  { hex: '#14171f', title: 'Тёмный' },
];

function slotWord(n: number): string {
  if (n === 1) return '1 слот';
  if (n >= 2 && n <= 4) return `${n} слота`;
  return `${n} слотов`;
}

export function BrandPanel({
  slotCount,
  options,
  packCount,
  busy,
  onChange,
  onReset,
  onApplyToPack,
  onSwitchToAddText,
}: BrandPanelProps) {
  const [keepPackColor, setKeepPackColor] = useState(false);

  if (slotCount === 0) {
    return (
      <div className="brand-empty pad">
        <p className="muted">
          В этом стикере нет встроенного слота надписи <strong>MAGNAT</strong> (например, это пустой холст).
        </p>
        <button type="button" className="primary wide" onClick={onSwitchToAddText}>
          Добавить новый текстовый слой
        </button>
      </div>
    );
  }

  const update = (patch: Partial<BrandSlotOptions>, mergeKey?: string) => {
    onChange({ ...options, ...patch }, mergeKey);
  };

  const activeFont = FONTS.find((f) => f.id === options.fontId) ?? FONTS[0];

  return (
    <div className="brand-panel pad">
      <div className="brand-slot-banner">
        <div className="brand-slot-badge">
          <Sparkles size={14} />
          <span>Надпись в эмодзи · {slotWord(slotCount)}</span>
        </div>
        <div className="brand-slot-top-btns">
          <button
            type="button"
            className="mini-btn"
            onClick={() => update({ hidden: !options.hidden })}
            title={options.hidden ? 'Показать надпись' : 'Скрыть надпись со стикера'}
          >
            {options.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{options.hidden ? 'Скрыта' : 'Видна'}</span>
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={onReset}
            title="Вернуть оригинальную векторную надпись MAGNAT"
          >
            <RotateCcw size={13} />
            <span>Сброс</span>
          </button>
        </div>
      </div>

      <label className="field">
        <span>Текст вместо MAGNAT (живая замена с сохранением анимации)</span>
        <input
          type="text"
          className="brand-text-input"
          value={options.text}
          maxLength={22}
          placeholder="Введите ваш текст..."
          style={{
            fontFamily: options.useOriginalGlyphs ? '"Montserrat", sans-serif' : activeFont.css,
            fontWeight: options.useOriginalGlyphs ? 900 : activeFont.weight,
          }}
          onChange={(e) => {
            const val = e.target.value;
            update(
              {
                text: val,
                useOriginalGlyphs: false,
                hidden: false,
              },
              'brand:text',
            );
          }}
        />
      </label>

      <label className="field">
        <span>Шрифт надписи</span>
        <select
          value={options.useOriginalGlyphs ? '__orig__' : options.fontId}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__orig__') {
              update({ text: 'MAGNAT', useOriginalGlyphs: true });
            } else {
              update({ fontId: v as FontId, useOriginalGlyphs: false });
            }
          }}
        >
          <option value="__orig__">Оригинальный вектор MAGNAT</option>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Цвет только надписи</span>
        <div className="brand-color-row">
          <label className="brand-color-picker" style={{ background: options.fillHex }}>
            <input
              type="color"
              value={options.fillHex}
              onChange={(e) => update({ fillHex: e.target.value }, 'brand:fill')}
              aria-label="Цвет надписи"
            />
          </label>
          <div className="brand-swatches">
            {BRAND_SWATCHES.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                className={`brand-swatch-dot ${options.fillHex.toLowerCase() === sw.hex ? 'on' : ''}`}
                style={{ background: sw.hex }}
                title={sw.title}
                onClick={() => update({ fillHex: sw.hex })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="inline-check">
            <input
              type="checkbox"
              checked={options.strokeHex !== null}
              onChange={(e) => update({ strokeHex: e.target.checked ? '#0c0e14' : null })}
            />
            <span>Обводка</span>
          </span>
          <input
            type="color"
            disabled={options.strokeHex === null}
            value={options.strokeHex ?? '#0c0e14'}
            onChange={(e) => update({ strokeHex: e.target.value }, 'brand:stroke')}
          />
        </label>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>Толщина обводки · {options.strokeWidth}</span>
          <input
            type="range"
            min={1}
            max={16}
            step={0.5}
            disabled={options.strokeHex === null}
            value={options.strokeWidth}
            onChange={(e) => update({ strokeWidth: Number(e.target.value) }, 'brand:strokeW')}
          />
        </label>
      </div>

      <div className="brand-sliders">
        <label className="field">
          <div className="slider-head">
            <span>Размер надписи · {options.scale}%</span>
            {options.scale !== 100 && (
              <button type="button" className="link" onClick={() => update({ scale: 100 })}>
                100%
              </button>
            )}
          </div>
          <input
            type="range"
            min={45}
            max={185}
            value={options.scale}
            onChange={(e) => update({ scale: Number(e.target.value) }, 'brand:scale')}
          />
        </label>

        <div className="two-col">
          <label className="field">
            <div className="slider-head">
              <span>Сдвиг X · {options.offsetX}%</span>
              {options.offsetX !== 0 && (
                <button type="button" className="link" onClick={() => update({ offsetX: 0 })}>
                  0
                </button>
              )}
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={options.offsetX}
              onChange={(e) => update({ offsetX: Number(e.target.value) }, 'brand:ox')}
            />
          </label>

          <label className="field">
            <div className="slider-head">
              <span>Сдвиг Y · {options.offsetY}%</span>
              {options.offsetY !== 0 && (
                <button type="button" className="link" onClick={() => update({ offsetY: 0 })}>
                  0
                </button>
              )}
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={options.offsetY}
              onChange={(e) => update({ offsetY: Number(e.target.value) }, 'brand:oy')}
            />
          </label>
        </div>

        {!options.useOriginalGlyphs && (
          <label className="field">
            <div className="slider-head">
              <span>Межбуквенный интервал · {options.letterSpacing}</span>
              {options.letterSpacing !== 0 && (
                <button type="button" className="link" onClick={() => update({ letterSpacing: 0 })}>
                  0
                </button>
              )}
            </div>
            <input
              type="range"
              min={-8}
              max={32}
              value={options.letterSpacing}
              onChange={(e) => update({ letterSpacing: Number(e.target.value) }, 'brand:track')}
            />
          </label>
        )}
      </div>

      {packCount > 1 && (
        <div className="brand-batch-box">
          <label className="inline-check small muted">
            <input
              type="checkbox"
              checked={keepPackColor}
              onChange={(e) => setKeepPackColor(e.target.checked)}
            />
            <span>Оставить свой родной цвет текста у каждого эмодзи в паке</span>
          </label>
          <button
            type="button"
            className="primary wide"
            disabled={busy}
            onClick={() => onApplyToPack(options, keepPackColor)}
          >
            <CheckCheck size={16} />
            <span>Применить надпись ко всему паку ({packCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}
