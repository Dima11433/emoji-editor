import { useRef, useState } from 'react';
import { CheckCheck, Eye, EyeOff, ImagePlus, RotateCcw, Sparkles, Tag, Type } from 'lucide-react';
import type { BrandMode, BrandSlotOptions } from '../lib/brandSlot';
import { FONTS, type FontId } from '../lib/fonts';
import {
  BUILTIN_LOGOS,
  fileToVectorLogo,
  type BgRemovalMode,
  type VectorLogo,
} from '../lib/logoVector';

interface BrandPanelProps {
  slotCount: number;
  options: BrandSlotOptions;
  packCount: number;
  busy: boolean;
  uploadedLogo: VectorLogo | null;
  onUploadedLogoChange: (logo: VectorLogo) => void;
  onChange: (next: BrandSlotOptions, mergeKey?: string) => void;
  onReset: () => void;
  onApplyToPack: (opts: BrandSlotOptions, keepStickerColor: boolean) => void;
  onSwitchToAddText: () => void;
  onSay: (msg: string, bad?: boolean) => void;
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
  uploadedLogo,
  onUploadedLogoChange,
  onChange,
  onReset,
  onApplyToPack,
  onSwitchToAddText,
  onSay,
}: BrandPanelProps) {
  const [keepPackColor, setKeepPackColor] = useState(false);
  const [traceBusy, setTraceBusy] = useState(false);
  const [lastRasterFile, setLastRasterFile] = useState<File | null>(null);
  const [bgMode, setBgMode] = useState<BgRemovalMode>('auto');
  const [colorCount, setColorCount] = useState<number>(6);
  const [dropActive, setDropActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  if (slotCount === 0) {
    return (
      <div className="brand-empty pad">
        <p className="muted">
          В этом стикере нет встроенного слота <strong>MAGNAT</strong> (например, открыт пустой холст).
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

  const switchMode = (nextMode: BrandMode) => {
    if (nextMode === 'text') {
      update({ mode: 'text', hidden: false });
      return;
    }
    const fallbackLogo = options.logo ?? uploadedLogo ?? BUILTIN_LOGOS[0];
    const nextText =
      nextMode === 'logo+text' && options.useOriginalGlyphs ? 'MAGNAT' : options.text || 'VIP';
    update({
      mode: nextMode,
      logo: fallbackLogo,
      text: nextText,
      useOriginalGlyphs: false,
      hidden: false,
    });
  };

  const processLogoFile = async (
    file: File,
    overrideBg = bgMode,
    overrideColors = colorCount,
  ) => {
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
    setTraceBusy(true);
    try {
      const vec = await fileToVectorLogo(file, {
        removeBg: overrideBg,
        maxColors: overrideColors,
        resolution: 116,
      });
      setLastRasterFile(isSvg ? null : file);
      onUploadedLogoChange(vec);
      const targetMode: BrandMode = options.mode === 'logo+text' ? 'logo+text' : 'logo';
      update({
        mode: targetMode,
        logo: vec,
        tintLogo: false,
        hidden: false,
        useOriginalGlyphs: false,
      });
      onSay(
        isSvg
          ? `Векторный SVG-логотип «${vec.name}» установлен вместо ника!`
          : `Картинка «${vec.name}» переведена в чистый вектор Telegram (${vec.layers.length} цв.)!`,
      );
    } catch (e) {
      onSay(e instanceof Error ? e.message : 'Не удалось обработать логотип', true);
    } finally {
      setTraceBusy(false);
    }
  };

  const activeFont = FONTS.find((f) => f.id === options.fontId) ?? FONTS[0];
  const isLogoMode = options.mode === 'logo' || options.mode === 'logo+text';
  const isTextVisible = options.mode === 'text' || options.mode === 'logo+text';

  return (
    <div className="brand-panel pad">
      <div className="brand-slot-banner">
        <div className="brand-slot-badge">
          <Sparkles size={14} />
          <span>Слот бренда · {slotWord(slotCount)}</span>
        </div>
        <div className="brand-slot-top-btns">
          <button
            type="button"
            className="mini-btn"
            onClick={() => update({ hidden: !options.hidden })}
            title={options.hidden ? 'Показать слот' : 'Скрыть слот со стикера'}
          >
            {options.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{options.hidden ? 'Скрыт' : 'Виден'}</span>
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

      {/* Mode Switch: Text / Logo / Logo + Text */}
      <div className="brand-mode-switch" role="tablist" aria-label="Что поставить вместо MAGNAT">
        <button
          type="button"
          className={options.mode === 'text' ? 'on' : ''}
          onClick={() => switchMode('text')}
        >
          <Type size={14} />
          <span>Текст</span>
        </button>
        <button
          type="button"
          className={options.mode === 'logo' ? 'on' : ''}
          onClick={() => switchMode('logo')}
        >
          <ImagePlus size={14} />
          <span>Логотип</span>
        </button>
        <button
          type="button"
          className={options.mode === 'logo+text' ? 'on' : ''}
          onClick={() => switchMode('logo+text')}
        >
          <Tag size={14} />
          <span>Лого + Ник</span>
        </button>
      </div>

      {/* LOGO UPLOAD & PRESETS */}
      {isLogoMode && (
        <div className="logo-studio-box">
          <div
            className={`logo-dropzone ${dropActive ? 'drop' : ''}`}
            onClick={() => logoInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(true);
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              setDropActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) processLogoFile(f);
            }}
          >
            <ImagePlus size={20} className="logo-drop-icon" />
            <div className="logo-drop-text">
              <strong>
                {traceBusy
                  ? 'Векторизую логотип…'
                  : options.logo
                    ? `Активен: ${options.logo.name}`
                    : 'Загрузить свой логотип'}
              </strong>
              <span className="muted tiny">
                SVG, PNG, WEBP или JPG — авто-перевод в вектор для Telegram .tgs
              </span>
            </div>
          </div>

          <input
            ref={logoInputRef}
            type="file"
            accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processLogoFile(f);
              e.target.value = '';
            }}
          />

          {lastRasterFile && (
            <div className="raster-trace-opts">
              <div className="field">
                <span>Фон картинки</span>
                <div className="seg">
                  {(
                    [
                      ['auto', 'Авто'],
                      ['on', 'Вырезать'],
                      ['off', 'Оставить'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={bgMode === id ? 'on' : ''}
                      disabled={traceBusy}
                      onClick={() => {
                        setBgMode(id);
                        processLogoFile(lastRasterFile, id, colorCount);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Детализация цветов</span>
                <div className="seg">
                  {[2, 4, 6, 8].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      className={colorCount === cnt ? 'on' : ''}
                      disabled={traceBusy}
                      onClick={() => {
                        setColorCount(cnt);
                        processLogoFile(lastRasterFile, bgMode, cnt);
                      }}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <span>Быстрые векторные эмблемы{uploadedLogo ? ' + ваш лого' : ''}</span>
            <div className="logo-presets-row">
              {uploadedLogo && (
                <button
                  type="button"
                  className={`logo-preset-chip ${options.logo?.id === uploadedLogo.id ? 'on' : ''}`}
                  onClick={() => update({ logo: uploadedLogo, hidden: false })}
                  title="Ваш загруженный логотип"
                >
                  ★ Мой лого
                </button>
              )}
              {BUILTIN_LOGOS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`logo-preset-chip ${options.logo?.id === preset.id ? 'on' : ''}`}
                  onClick={() => {
                    setLastRasterFile(null);
                    update({ logo: preset, hidden: false });
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <label className="inline-check small">
            <input
              type="checkbox"
              checked={options.tintLogo}
              onChange={(e) => update({ tintLogo: e.target.checked })}
            />
            <span>Перекрасить логотип в выбранный ниже цвет</span>
          </label>
        </div>
      )}

      {/* TEXT INPUT & FONT (for 'text' and 'logo+text') */}
      {isTextVisible && (
        <>
          <label className="field">
            <span>
              {options.mode === 'logo+text'
                ? 'Текст рядом с логотипом'
                : 'Текст вместо MAGNAT (с сохранением анимации)'}
            </span>
            <input
              type="text"
              className="brand-text-input"
              value={options.text}
              maxLength={22}
              placeholder="Введите ваш ник или бренд..."
              style={{
                fontFamily: options.useOriginalGlyphs ? '"Montserrat", sans-serif' : activeFont.css,
                fontWeight: options.useOriginalGlyphs ? 900 : activeFont.weight,
              }}
              onChange={(e) => {
                update(
                  {
                    text: e.target.value,
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
              value={options.mode === 'text' && options.useOriginalGlyphs ? '__orig__' : options.fontId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__orig__') {
                  update({ mode: 'text', text: 'MAGNAT', useOriginalGlyphs: true });
                } else {
                  update({ fontId: v as FontId, useOriginalGlyphs: false });
                }
              }}
            >
              {options.mode === 'text' && (
                <option value="__orig__">Оригинальный вектор MAGNAT</option>
              )}
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {/* COLOR & OUTLINE */}
      {(isTextVisible || options.tintLogo) && (
        <div className="field">
          <span>
            {options.mode === 'logo'
              ? 'Цвет заливки логотипа'
              : options.tintLogo
                ? 'Цвет логотипа и текста'
                : 'Цвет текста'}
          </span>
          <div className="brand-color-row">
            <label className="brand-color-picker" style={{ background: options.fillHex }}>
              <input
                type="color"
                value={options.fillHex}
                onChange={(e) => update({ fillHex: e.target.value }, 'brand:fill')}
                aria-label="Цвет бренда"
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
      )}

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

      {/* GEOMETRY SLIDERS */}
      <div className="brand-sliders">
        <label className="field">
          <div className="slider-head">
            <span>Размер · {options.scale}%</span>
            {options.scale !== 100 && (
              <button type="button" className="link" onClick={() => update({ scale: 100 })}>
                100%
              </button>
            )}
          </div>
          <input
            type="range"
            min={30}
            max={300}
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
              min={-80}
              max={80}
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
              min={-80}
              max={80}
              value={options.offsetY}
              onChange={(e) => update({ offsetY: Number(e.target.value) }, 'brand:oy')}
            />
          </label>
        </div>

        {options.mode === 'logo+text' && (
          <label className="field">
            <div className="slider-head">
              <span>Отступ между лого и текстом · {options.logoGap}</span>
              {options.logoGap !== 18 && (
                <button type="button" className="link" onClick={() => update({ logoGap: 18 })}>
                  18
                </button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={60}
              value={options.logoGap}
              onChange={(e) => update({ logoGap: Number(e.target.value) }, 'brand:gap')}
            />
          </label>
        )}

        {isTextVisible && !options.useOriginalGlyphs && (
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
          {(isTextVisible || options.tintLogo) && (
            <label className="inline-check small muted">
              <input
                type="checkbox"
                checked={keepPackColor}
                onChange={(e) => setKeepPackColor(e.target.checked)}
              />
              <span>Сохранить родной цвет слота у каждого эмодзи в паке</span>
            </label>
          )}
          <button
            type="button"
            className="primary wide"
            disabled={busy || traceBusy}
            onClick={() => onApplyToPack(options, keepPackColor)}
          >
            <CheckCheck size={16} />
            <span>
              {options.mode === 'logo'
                ? `Поставить логотип во весь пак (${packCount})`
                : options.mode === 'logo+text'
                  ? `Поставить лого + ник во весь пак (${packCount})`
                  : `Применить надпись ко всему паку (${packCount})`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
