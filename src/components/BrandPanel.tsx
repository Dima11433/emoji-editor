import { useRef, useState } from 'react';
import {
  CheckCheck,
  Eye,
  EyeOff,
  ImagePlus,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  Type,
} from 'lucide-react';
import {
  BRAND_GRADIENTS,
  type BrandMode,
  type BrandPlateStyle,
  type BrandSlotAnim,
  type BrandSlotOptions,
  type BrandSlotPosition,
} from '../lib/brandSlot';
import { FONTS, type FontId } from '../lib/fonts';
import {
  BUILTIN_LOGOS,
  fileToVectorLogo,
  type BgRemovalMode,
  type VectorLogo,
} from '../lib/logoVector';

interface BrandPanelProps {
  slotCount: number;
  isInjected: boolean;
  origText: string;
  hasPlateSlot?: boolean;
  origPlateText?: string;
  options: BrandSlotOptions;
  selectedCount: number;
  anyNeedsOverlay: boolean;
  packCount: number;
  busy: boolean;
  uploadedLogo: VectorLogo | null;
  onUploadedLogoChange: (logo: VectorLogo) => void;
  onChange: (next: BrandSlotOptions, mergeKey?: string, keepStickerColor?: boolean) => void;
  onReset: () => void;
  onApplyToPack: (opts: BrandSlotOptions, keepStickerColor: boolean) => void;
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

const PLATE_STYLES: { id: BrandPlateStyle; label: string }[] = [
  { id: 'none', label: 'Без плашки' },
  { id: 'dark', label: 'Тёмная' },
  { id: 'gold', label: 'Золото' },
  { id: 'neon', label: 'Неон' },
  { id: 'light', label: 'Белая' },
];

const POSITIONS: { id: BrandSlotPosition; label: string }[] = [
  { id: 'bottom', label: 'Снизу' },
  { id: 'center', label: 'По центру' },
  { id: 'top', label: 'Сверху' },
];

const SLOT_ANIMS: { id: BrandSlotAnim; label: string }[] = [
  { id: 'float', label: 'Левитация' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'swing', label: 'Качание' },
  { id: 'pop', label: 'Появление' },
  { id: 'none', label: 'Статично' },
];

function slotWord(n: number): string {
  if (n === 1) return '1 слот';
  if (n >= 2 && n <= 4) return `${n} слота`;
  return `${n} слотов`;
}

export function BrandPanel({
  slotCount,
  isInjected,
  origText,
  hasPlateSlot,
  origPlateText,
  options,
  selectedCount,
  anyNeedsOverlay,
  packCount,
  busy,
  uploadedLogo,
  onUploadedLogoChange,
  onChange,
  onReset,
  onApplyToPack,
  onSay,
}: BrandPanelProps) {
  const [keepMultiColor, setKeepMultiColor] = useState(false);
  const [keepPackColor, setKeepPackColor] = useState(false);
  const [traceBusy, setTraceBusy] = useState(false);
  const [lastRasterFile, setLastRasterFile] = useState<File | null>(null);
  const [bgMode, setBgMode] = useState<BgRemovalMode>('auto');
  const [colorCount, setColorCount] = useState<number>(6);
  const [dropActive, setDropActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const hasBuiltInSlot = slotCount > 0 && !isInjected;
  const showOverlayPlacement = slotCount === 0 || isInjected || anyNeedsOverlay;

  const update = (patch: Partial<BrandSlotOptions>, mergeKey?: string) => {
    const next: BrandSlotOptions = { ...options, ...patch };
    if ((!hasBuiltInSlot || anyNeedsOverlay) && next.mode === 'text') {
      next.useOriginalGlyphs = false;
    }
    onChange(next, mergeKey, selectedCount > 1 ? keepMultiColor : false);
  };

  const rafRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<Partial<BrandSlotOptions>>({});

  const throttledUpdate = (patch: Partial<BrandSlotOptions>, mergeKey?: string) => {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const currentPatch = pendingPatchRef.current;
        pendingPatchRef.current = {};
        update(currentPatch, mergeKey);
      });
    }
  };

  const switchMode = (nextMode: BrandMode) => {
    if (nextMode === 'text') {
      update({
        mode: 'text',
        hidden: false,
        useOriginalGlyphs: hasBuiltInSlot && !anyNeedsOverlay ? options.useOriginalGlyphs : false,
      });
      return;
    }
    const fallbackLogo = options.logo ?? uploadedLogo ?? BUILTIN_LOGOS[0];
    const nextText =
      nextMode === 'logo+text' && options.useOriginalGlyphs
        ? origText
        : options.text || 'VIP';
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
          ? `Векторный SVG-логотип «${vec.name}» установлен${selectedCount > 1 ? ` на ${selectedCount} эмодзи` : ''}!`
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
      {selectedCount > 1 && (
        <div className="multi-edit-callout">
          <div className="multi-edit-callout-top">
            <Sparkles size={14} />
            <strong>Мульти-режим: выбрано {selectedCount} эмодзи</strong>
          </div>
          <span className="muted tiny">
            Любой текст, логотип, плашка и размер ниже применяются сразу ко всем {selectedCount} выбранным эмодзи.
          </span>
          {(isTextVisible || options.tintLogo) && (
            <label className="inline-check tiny" style={{ marginTop: 2 }}>
              <input
                type="checkbox"
                checked={keepMultiColor}
                onChange={(e) => setKeepMultiColor(e.target.checked)}
              />
              <span>Сохранять свой родной цвет надписи у каждого эмодзи</span>
            </label>
          )}
        </div>
      )}

      {slotCount === 0 ? (
        <div className="brand-inject-cta">
          <div className="brand-inject-head">
            <Sparkles size={15} />
            <div>
              <strong>
                {selectedCount > 1
                  ? `Шаблоны без надписи (${selectedCount} шт.)`
                  : 'Чистый шаблон без надписи'}
              </strong>
              <span className="muted tiny">
                Добавьте свой ник, логотип или VIP-плашку в 1 клик
              </span>
            </div>
          </div>
          <button
            type="button"
            className="primary wide"
            disabled={busy || traceBusy}
            onClick={() => update({ hidden: false })}
          >
            <PlusCircle size={15} />
            <span>
              {selectedCount > 1
                ? `Добавить бренд-слот на все ${selectedCount} эмодзи`
                : 'Добавить бренд-слот на стикер'}
            </span>
          </button>
        </div>
      ) : (
        <div className="brand-slot-banner">
          <div className="brand-slot-badge">
            <Sparkles size={14} />
            <span>
              {selectedCount > 1
                ? `Слоты на ${selectedCount} эмодзи`
                : isInjected
                  ? 'Бренд-плашка на шаблоне'
                  : `Слот бренда · ${slotWord(slotCount)}`}
            </span>
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
              title={
                isInjected
                  ? 'Убрать добавленный бренд-слот'
                  : `Вернуть оригинальную векторную надпись (${origText})`
              }
            >
              {isInjected ? <Trash2 size={13} /> : <RotateCcw size={13} />}
              <span>{isInjected ? 'Убрать' : 'Сброс'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Switch: Text / Logo / Logo + Text */}
      <div className="brand-mode-switch" role="tablist" aria-label="Режим брендирования">
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
              {hasPlateSlot
                ? 'Никнейм по середине'
                : options.mode === 'logo+text'
                  ? 'Текст рядом с логотипом'
                  : selectedCount > 1
                    ? `Единая надпись сразу для ${selectedCount} эмодзи`
                    : hasBuiltInSlot
                      ? `Текст вместо «${origText}» (с сохранением анимации)`
                      : 'Текст бренда / никнейм на шаблоне'}
            </span>
            <input
              type="text"
              className="brand-text-input"
              value={options.text}
              maxLength={24}
              placeholder={hasPlateSlot ? 'Ник в центре (например: MAGNAT, VIP)...' : 'Введите ваш ник, магазин или бренд...'}
              style={{
                fontFamily:
                  hasBuiltInSlot && options.useOriginalGlyphs
                    ? '"Montserrat", sans-serif'
                    : activeFont.css,
                fontWeight:
                  hasBuiltInSlot && options.useOriginalGlyphs ? 900 : activeFont.weight,
              }}
              onChange={(e) => {
                const val = e.target.value;
                update(
                  {
                    text: val,
                    plateText: options.syncPlateText ? val : options.plateText,
                    useOriginalGlyphs: false,
                    hidden: false,
                  },
                  'brand:text',
                );
              }}
            />
          </label>

          {/* DUAL SLOT: LOWER PLATE & USERNAME */}
          {hasPlateSlot && (
            <div className="brand-dual-plate-box">
              <div className="dual-plate-header">
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={!options.hideBuiltInPlate}
                    onChange={(e) => update({ hideBuiltInPlate: !e.target.checked })}
                  />
                  <span>Показывать нижнюю плашку</span>
                </label>
              </div>

              {!options.hideBuiltInPlate && (
                <>
                  <div className="dual-plate-sync-row">
                    <label className="inline-check small">
                      <input
                        type="checkbox"
                        checked={options.syncPlateText}
                        onChange={(e) => {
                          const sync = e.target.checked;
                          update({
                            syncPlateText: sync,
                            plateText: sync ? options.text : options.plateText,
                            useOriginalGlyphs: false,
                          });
                        }}
                      />
                      <span>🔗 Одинаковый ник в центре и на плашке</span>
                    </label>

                    <label className="inline-check small">
                      <input
                        type="checkbox"
                        checked={options.plateTextEnabled}
                        onChange={(e) => update({ plateTextEnabled: e.target.checked })}
                      />
                      <span>Текст на плашке</span>
                    </label>
                  </div>

                  {!options.syncPlateText && options.plateTextEnabled && (
                    <label className="field" style={{ marginTop: '6px' }}>
                      <span>Текст на нижней плашке</span>
                      <input
                        type="text"
                        className="brand-text-input brand-plate-input"
                        value={options.plateText}
                        maxLength={24}
                        placeholder={
                          origPlateText
                            ? `Текст на плашке (по умолчанию: ${origPlateText})...`
                            : 'Текст на плашке (например: @username)...'
                        }
                        style={{
                          fontFamily: activeFont.css,
                          fontWeight: activeFont.weight,
                        }}
                        onChange={(e) => {
                          update(
                            {
                              plateText: e.target.value,
                              useOriginalGlyphs: false,
                              hidden: false,
                            },
                            'brand:plateText',
                          );
                        }}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          <label className="field">
            <span>Шрифт надписи</span>
            <select
              value={
                hasBuiltInSlot && !anyNeedsOverlay && options.mode === 'text' && options.useOriginalGlyphs
                  ? '__orig__'
                  : options.fontId
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__orig__') {
                  update({ mode: 'text', text: origText, useOriginalGlyphs: true });
                } else {
                  update({ fontId: v as FontId, useOriginalGlyphs: false });
                }
              }}
            >
              {hasBuiltInSlot && !anyNeedsOverlay && options.mode === 'text' && (
                <option value="__orig__">Оригинальный вектор ({origText})</option>
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

      {/* BADGE / PLATE CAPSULE */}
      <div className="field">
        <span>Подложка / плашка под бренд</span>
        <div className="plate-chips">
          {PLATE_STYLES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`logo-preset-chip ${options.plateStyle === p.id ? 'on' : ''}`}
              onClick={() => {
                const nextFill =
                  p.id === 'light' && options.fillHex.toLowerCase() === '#ffffff'
                    ? '#14171f'
                    : p.id !== 'light' && options.fillHex.toLowerCase() === '#14171f'
                      ? '#ffffff'
                      : options.fillHex;
                update({ plateStyle: p.id, fillHex: nextFill, hidden: false });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERLAY POSITION & ANIMATION (for unbranded / injected slots) */}
      {showOverlayPlacement && (
        <div className="overlay-placement-box">
          <div className="field">
            <span>Расположение на шаблоне</span>
            <div className="seg">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  className={options.slotPosition === pos.id ? 'on' : ''}
                  onClick={() => update({ slotPosition: pos.id, hidden: false })}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Анимация бренда</span>
            <div className="plate-chips">
              {SLOT_ANIMS.map((an) => (
                <button
                  key={an.id}
                  type="button"
                  className={`logo-preset-chip ${options.slotAnim === an.id ? 'on' : ''}`}
                  onClick={() => update({ slotAnim: an.id, hidden: false })}
                >
                  {an.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D GRADIENT & SOLID COLOR */}
      <div className="brand-paint-box">
        <div className="field">
          <span>
            {options.mode === 'logo'
              ? '3D-градиент логотипа'
              : options.tintLogo
                ? '3D-градиент текста и лого'
                : '3D-градиент текста'}
          </span>
          <div className="brand-grad-grid">
            {BRAND_GRADIENTS.map((g) => {
              const active =
                g.id === 'none'
                  ? options.gradientId === 'none' && (isTextVisible || options.tintLogo)
                  : options.gradientId === g.id && (isTextVisible || options.tintLogo);
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`brand-grad-chip ${active ? 'on' : ''}`}
                  onClick={() =>
                    update({
                      gradientId: g.id,
                      hidden: false,
                      ...(options.mode === 'logo' && g.id !== 'none' ? { tintLogo: true } : {}),
                    })
                  }
                >
                  <i
                    className="brand-grad-swatch"
                    style={{
                      background: g.id === 'none' ? options.fillHex : g.css,
                    }}
                    aria-hidden
                  />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
          {options.gradientId !== 'none' && (isTextVisible || options.tintLogo) && (
            <label className="inline-check small brand-grad-anim-check">
              <input
                type="checkbox"
                checked={options.gradientAnim}
                onChange={(e) => update({ gradientAnim: e.target.checked, hidden: false })}
              />
              <span>✨ Живой перелив градиента в анимации</span>
            </label>
          )}
        </div>

        {(isTextVisible || options.tintLogo) && (
          <div className="field">
            <span>
              {options.mode === 'logo'
                ? 'Сплошной цвет логотипа'
                : options.tintLogo
                  ? 'Сплошной цвет лого и текста'
                  : 'Сплошной цвет текста'}
            </span>
            <div className="brand-color-row">
              <label className="brand-color-picker" style={{ background: options.fillHex }}>
                <input
                  type="color"
                  value={options.fillHex}
                  onChange={(e) =>
                    update({ fillHex: e.target.value, gradientId: 'none' }, 'brand:fill')
                  }
                  aria-label="Цвет бренда"
                />
              </label>
              <div className="brand-swatches">
                {BRAND_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    className={`brand-swatch-dot ${
                      options.gradientId === 'none' && options.fillHex.toLowerCase() === sw.hex
                        ? 'on'
                        : ''
                    }`}
                    style={{ background: sw.hex }}
                    title={sw.title}
                    onClick={() => update({ fillHex: sw.hex, gradientId: 'none', hidden: false })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
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
            onChange={(e) => throttledUpdate({ strokeWidth: Number(e.target.value) }, 'brand:strokeW')}
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
            onChange={(e) => throttledUpdate({ scale: Number(e.target.value) }, 'brand:scale')}
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
              onChange={(e) => throttledUpdate({ offsetX: Number(e.target.value) }, 'brand:ox')}
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
              onChange={(e) => throttledUpdate({ offsetY: Number(e.target.value) }, 'brand:oy')}
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
              onChange={(e) => throttledUpdate({ logoGap: Number(e.target.value) }, 'brand:gap')}
            />
          </label>
        )}

        {isTextVisible && !(hasBuiltInSlot && !anyNeedsOverlay && options.useOriginalGlyphs) && (
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
              onChange={(e) => throttledUpdate({ letterSpacing: Number(e.target.value) }, 'brand:track')}
            />
          </label>
        )}
      </div>

      {packCount > selectedCount && packCount > 1 && (
        <div className="brand-batch-box">
          {(isTextVisible || options.tintLogo) && (
            <label className="inline-check small muted">
              <input
                type="checkbox"
                checked={keepPackColor}
                onChange={(e) => setKeepPackColor(e.target.checked)}
              />
              <span>Сохранить родной цвет слота у остальных эмодзи в паке</span>
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
                ? `Поставить логотип вообще во весь пак (${packCount})`
                : options.mode === 'logo+text'
                  ? `Поставить лого + ник во весь пак (${packCount})`
                  : `Применить бренд ко всему паку (${packCount})`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
