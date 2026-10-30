import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport, toTgsAutoFit } from '../lib/tgs';
import {
  applyBrandSlot,
  DEFAULT_BRAND_OPTIONS,
} from '../lib/brandSlot';
import { loadFont } from '../lib/fonts';
import { fileToVectorLogo, type VectorLogo } from '../lib/logoVector';
import { haptic } from '../lib/telegram';
import type { CatalogItem } from '../lib/catalog';
import type { SubscriptionState } from '../lib/subscription';
import type { Font } from 'opentype.js';

interface TmaEditorViewProps {
  initialDoc: LottieDoc;
  templateItem: CatalogItem;
  subscription: SubscriptionState;
  onBackToCatalog: () => void;
  onOpenAdvancedStudio: () => void;
  onSaveSticker: (doc: LottieDoc, name: string) => void;
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
  onOpenAdvancedStudio,
  onSaveSticker,
  onOpenTemplatesModal,
  onOpenProModal,
}: TmaEditorViewProps) {
  const [packType, setPackType] = useState<'emoji' | 'stickers'>('emoji');
  const [brandText, setBrandText] = useState('MAGNAT');
  const [fillColor, setFillColor] = useState('#131822');
  const [strokeColor, setStrokeColor] = useState('#a8c7ef');
  const [uploadedLogo, setUploadedLogo] = useState<VectorLogo | null>(null);
  const [fonts, setFonts] = useState<Font[] | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);

  // Load brand font on mount
  useEffect(() => {
    loadFont('montserrat')
      .then((f) => setFonts(f))
      .catch(() => {});
  }, []);

  // Compute live customized Lottie document
  const customizedDoc = useMemo(() => {
    const clone = structuredClone(initialDoc);
    if (fonts) {
      applyBrandSlot(
        clone,
        {
          ...DEFAULT_BRAND_OPTIONS,
          mode: uploadedLogo ? 'logo+text' : 'text',
          logo: uploadedLogo,
          text: brandText.trim() || 'MAGNAT',
          plateText: brandText.trim() || 'MAGNAT',
          fillHex: fillColor,
          strokeHex: strokeColor,
          strokeWidth: strokeColor ? 4 : 0,
          useOriginalGlyphs: false,
        },
        fonts,
      );
    }
    return clone;
  }, [initialDoc, brandText, fillColor, strokeColor, uploadedLogo, fonts]);

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
    const name = `${templateItem.name} (MAGNAT)`;

    // 1. Save to user's pack in state
    onSaveSticker(docToSave, name);

    // 2. Trigger .tgs download
    try {
      const rawTgs = toTgsAutoFit(docToSave);
      const blob = new Blob([rawTgs], { type: 'application/x-tgsticker' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateItem.id}_magnat.tgs`;
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

        <button
          type="button"
          className="tma-adv-toggle-btn"
          onClick={() => {
            haptic('light');
            onOpenAdvancedStudio();
          }}
          title="Открыть расширенный студийный редактор"
        >
          <Sliders size={14} />
          <span>студия</span>
        </button>
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
                placeholder="впишите текст"
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

        {/* SECTION 7: СОЗДАТЬ ЭМОДЗИ-ПАК BUTTON */}
        <div className="tma-editor-section" style={{ marginTop: 24, marginBottom: 12 }}>
          <button
            type="button"
            className={`tma-editor-create-btn ${savedSuccess ? 'success' : ''}`}
            onClick={handleCreate}
          >
            {savedSuccess ? (
              <>
                <Check size={18} /> Эмодзи создан и скачан!
              </>
            ) : (
              'создать эмодзи-пак'
            )}
          </button>
        </div>

        {/* FOOTER */}
        <div className="tma-editor-footer">@magnat_emoji_bot</div>
      </div>
    </div>
  );
}
