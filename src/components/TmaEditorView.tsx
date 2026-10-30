import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  PackagePlus,
} from 'lucide-react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport, toTgsAutoFit } from '../lib/tgs';
import {
  applyBrandSlot,
  resetBrandSlot,
  DEFAULT_BRAND_OPTIONS,
} from '../lib/brandSlot';
import { loadFont } from '../lib/fonts';
import { fileToVectorLogo, type VectorLogo } from '../lib/logoVector';
import { haptic } from '../lib/telegram';
import { isPureIconTemplate, type CatalogItem } from '../lib/catalog';
import { BatchPackModal } from './BatchPackModal';
import type { SubscriptionState } from '../lib/subscription';
import type { Font } from 'opentype.js';

interface TmaEditorViewProps {
  initialDoc: LottieDoc;
  templateItem: CatalogItem;
  subscription: SubscriptionState;
  onBackToCatalog: () => void;
  onOpenAdvancedStudio: () => void;
  onSaveSticker: (doc: LottieDoc, name: string) => void;
  onAddBatchItems?: (items: { doc: LottieDoc; name: string; catalogId: string }[]) => void;
  onOpenTemplatesModal: () => void;
  onOpenProModal: () => void;
}

/** Lightweight and reliable animated sticker player with 0 duplicate SVGs */
function StickerPlayer({ doc, className }: { doc: LottieDoc; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let anim: AnimationItem | null = null;
    try {
      containerRef.current.innerHTML = '';
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: cleanForExport(doc),
      });
      animRef.current = anim;
    } catch {}

    return () => {
      anim?.destroy();
      animRef.current = null;
    };
  }, [doc]);

  return <div ref={containerRef} className={className} />;
}

export function TmaEditorView({
  initialDoc,
  templateItem,
  subscription: _subscription,
  onBackToCatalog,
  onOpenAdvancedStudio: _onOpenAdvancedStudio,
  onSaveSticker,
  onAddBatchItems,
  onOpenTemplatesModal,
  onOpenProModal,
}: TmaEditorViewProps) {
  const isPureIcon = isPureIconTemplate(templateItem?.id);
  const [packType, setPackType] = useState<'emoji' | 'stickers'>('emoji');
  const [brandText, setBrandText] = useState(isPureIcon ? '' : 'MAGNAT');
  const [fillColor, setFillColor] = useState('#131822');
  const [strokeColor, setStrokeColor] = useState('#a8c7ef');
  const [uploadedLogo, setUploadedLogo] = useState<VectorLogo | null>(null);
  const [fonts, setFonts] = useState<Font[] | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);

  // Reset personalization when switching between templates
  useEffect(() => {
    if (isPureIconTemplate(templateItem?.id)) {
      setBrandText('');
      setUploadedLogo(null);
    } else {
      setBrandText('MAGNAT');
    }
  }, [templateItem?.id]);

  // Load brand font on mount
  useEffect(() => {
    loadFont('montserrat')
      .then((f) => setFonts(f))
      .catch(() => {});
  }, []);

  // Compute live customized Lottie document
  const customizedDoc = useMemo(() => {
    const clone = structuredClone(initialDoc);
    const trimmedText = brandText.trim();
    const hasText = trimmedText.length > 0;
    const hasLogo = Boolean(uploadedLogo);

    // Pure icon templates remain 100% clean without forced MAGNAT
    if (isPureIcon && !hasText && !hasLogo) {
      resetBrandSlot(clone);
      return clone;
    }

    if (fonts && (hasText || hasLogo)) {
      applyBrandSlot(
        clone,
        {
          ...DEFAULT_BRAND_OPTIONS,
          mode: uploadedLogo ? (hasText ? 'logo+text' : 'logo') : 'text',
          logo: uploadedLogo,
          text: trimmedText,
          plateText: trimmedText,
          fillHex: fillColor,
          strokeHex: strokeColor,
          strokeWidth: strokeColor ? 4 : 0,
          useOriginalGlyphs: false,
        },
        fonts,
      );
    } else if (!hasText && !hasLogo) {
      resetBrandSlot(clone);
    }
    return clone;
  }, [initialDoc, brandText, fillColor, strokeColor, uploadedLogo, fonts, isPureIcon]);

  // Handle logo file upload
  const handleLogoUpload = async (file: File) => {
    try {
      const logo = await fileToVectorLogo(file);
      setUploadedLogo(logo);
      haptic('success');
    } catch {
      haptic('error');
    }
  };

  // Handle create pack / download
  const handleCreate = () => {
    haptic('medium');
    const docToSave = customizedDoc || initialDoc;
    const trimmed = brandText.trim();
    const name = trimmed ? `${templateItem.name} (${trimmed})` : templateItem.name;

    // 1. Save to user's pack in state
    onSaveSticker(docToSave, name);

    // 2. Trigger .tgs download
    try {
      const rawTgs = toTgsAutoFit(docToSave);
      const blob = new Blob([rawTgs], { type: 'application/x-tgsticker' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanFileName = trimmed
        ? `${templateItem.id}_${trimmed.toLowerCase().replace(/\s+/g, '_')}.tgs`
        : `${templateItem.id}.tgs`;
      a.download = cleanFileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="tma-view-container tma-editor-view">
      {/* TOP HEADER */}
      <div className="tma-top-bar" style={{ justifyContent: 'space-between' }}>
        <button
          type="button"
          className="tma-header-back-btn"
          onClick={() => {
            haptic('select');
            onBackToCatalog();
          }}
        >
          <ArrowLeft size={16} />
          <span>шаблоны</span>
        </button>

        <span className="tier-logo" style={{ fontSize: 18, margin: 0 }}>
          MAGNAT
        </span>

        <div style={{ width: 68 }} />
      </div>

      <div className="tma-editor-scroll-content">
        {/* SECTION 1: ВАШ ВЫБОР */}
        <div className="tma-editor-section">
          <div className="tma-editor-label">ваш выбор</div>
          <div className="tma-editor-choice-card">
            <StickerPlayer doc={customizedDoc} className="tma-editor-choice-player" />

            {/* Remove / return to catalog */}
            <button
              type="button"
              className="tma-editor-badge-btn badge-top-right"
              onClick={() => {
                haptic('select');
                onBackToCatalog();
              }}
              title="Закрыть выбор"
            >
              <X size={13} />
            </button>

            {/* Edit / switch template */}
            <button
              type="button"
              className="tma-editor-badge-btn badge-bottom-left"
              onClick={() => {
                haptic('select');
                onOpenTemplatesModal();
              }}
              title="Выбрать другой шаблон"
            >
              <Pencil size={11} />
            </button>
          </div>
        </div>

        {/* SECTION 2: ТИП ПАКА */}
        <div className="tma-editor-section">
          <div className="tma-editor-label">тип пака</div>
          <div className="tma-editor-seg-control">
            <button
              type="button"
              className={`tma-editor-seg-btn ${packType === 'emoji' ? 'active' : ''}`}
              onClick={() => {
                setPackType('emoji');
                haptic('select');
              }}
            >
              эмодзи
            </button>
            <button
              type="button"
              className={`tma-editor-seg-btn ${packType === 'stickers' ? 'active' : ''}`}
              onClick={() => {
                setPackType('stickers');
                haptic('select');
              }}
            >
              стикеры
            </button>
          </div>
        </div>

        {/* SECTION 3: ПЕРСОНАЛИЗАЦИЯ */}
        <div className="tma-editor-section">
          <div className="tma-editor-label">персонализация</div>
          <div className="tma-editor-card">
            {/* Текст */}
            <div className="tma-editor-row">
              <span className="tma-editor-row-label">текст</span>
              <input
                type="text"
                className="tma-editor-input"
                placeholder={isPureIcon ? "без текста (впишите при желании)" : "впишите текст"}
                value={brandText}
                onChange={(e) => setBrandText(e.target.value)}
                maxLength={18}
              />
            </div>

            {/* Загрузить логотип */}
            <div
              className="tma-editor-row"
              onClick={() => {
                haptic('select');
                fileInputRef.current?.click();
              }}
            >
              <span className="tma-editor-row-label">загрузить логотип</span>
              <div className="tma-editor-row-right">
                {uploadedLogo ? (
                  <span className="tma-editor-logo-badge">
                    {uploadedLogo.name}
                    <X
                      size={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedLogo(null);
                        haptic('select');
                      }}
                    />
                  </span>
                ) : (
                  <ChevronRight size={16} color="#787f95" />
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleLogoUpload(e.target.files[0]);
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* PRIMARY ACTION BUTTONS */}
        <div className="tma-editor-section" style={{ marginTop: 22, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className={`tma-editor-create-btn ${savedSuccess ? 'success' : ''}`}
            onClick={handleCreate}
          >
            {savedSuccess ? (
              <>
                <Check size={18} /> {packType === 'emoji' ? 'Эмодзи добавлен в пак!' : 'Стикер добавлен в пак!'}
              </>
            ) : (
              packType === 'emoji' ? 'сохранить этот эмодзи в пак' : 'сохранить этот стикер в пак'
            )}
          </button>

          <button
            type="button"
            className="tma-editor-batch-btn"
            onClick={() => setShowBatchModal(true)}
            style={{
              height: 48,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <PackagePlus size={18} color="#3b82f6" />
            <span>📦 Добавить много эмодзи в пак</span>
          </button>
        </div>

        {/* ADVANCED COLORS TOGGLE */}
        <div style={{ textAlign: 'center', margin: '4px 0 16px 0' }}>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '12.5px',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
            onClick={() => setShowAdvancedColors((v) => !v)}
          >
            {showAdvancedColors ? '▴ скрыть доп. настройки' : '🎨 цвета и превью ▾'}
          </button>
        </div>

        {showAdvancedColors && (
          <>
            {/* SECTION 4: СОХРАНЁННЫЕ СТИЛИ */}
            <div className="tma-editor-section">
              <div
                className="tma-editor-card tma-editor-clickable-card"
                onClick={() => {
                  haptic('medium');
                  onOpenProModal();
                }}
              >
                <div className="tma-editor-row" style={{ borderBottom: 'none' }}>
                  <span className="tma-editor-row-label">сохранённые стили</span>
                  <div className="tma-editor-row-right">
                    <span className="tma-editor-pro-badge">pro</span>
                    <ChevronRight size={16} color="#787f95" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: ЦВЕТА */}
            <div className="tma-editor-section">
              <div className="tma-editor-label">цвета</div>
              <div className="tma-editor-card">
                {/* Заливка */}
                <div
                  className="tma-editor-row"
                  onClick={() => fillInputRef.current?.click()}
                >
                  <span className="tma-editor-row-label">заливка</span>
                  <div className="tma-editor-row-right">
                    <span className="tma-editor-hex">{fillColor.toLowerCase()}</span>
                    <div
                      className="tma-editor-color-circle"
                      style={{ backgroundColor: fillColor }}
                    >
                      <input
                        ref={fillInputRef}
                        type="color"
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
                        className="tma-editor-hidden-color"
                      />
                    </div>
                  </div>
                </div>

                {/* Обводка */}
                <div
                  className="tma-editor-row"
                  onClick={() => strokeInputRef.current?.click()}
                >
                  <span className="tma-editor-row-label">обводка</span>
                  <div className="tma-editor-row-right">
                    <span className="tma-editor-hex">{strokeColor.toLowerCase()}</span>
                    <div
                      className="tma-editor-color-circle"
                      style={{ backgroundColor: strokeColor }}
                    >
                      <input
                        ref={strokeInputRef}
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="tma-editor-hidden-color"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 6: ПРЕВЬЮ В ЧАТЕ */}
            <div className="tma-editor-section">
              <div className="tma-editor-label">превью в чате</div>
              <div className="tma-editor-chat-box">
                <div className="tma-editor-chat-bubble">
                  <span className="tma-editor-chat-bubble-text">го делать паки</span>
                  <span className="tma-editor-chat-bubble-time">{timeStr}</span>
                </div>
                <div className="tma-editor-chat-emoji-wrap">
                  <StickerPlayer doc={customizedDoc} className="tma-editor-chat-player" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="tma-editor-footer">@magnat_emoji_bot</div>
      </div>

      <BatchPackModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        brandText={brandText}
        fillColor={fillColor}
        strokeColor={strokeColor}
        uploadedLogo={uploadedLogo}
        fonts={fonts}
        packLength={0}
        onAddBatch={(items) => {
          if (onAddBatchItems) {
            onAddBatchItems(items);
          } else {
            for (const it of items) onSaveSticker(it.doc, it.name);
          }
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        }}
      />
    </div>
  );
}
