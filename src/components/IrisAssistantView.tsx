import { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Pause,
  Play,
  Search,
  Sparkles,
  Star,
  Type,
  Upload,
  Wand2,
  X,
  Plus,
  PackagePlus,
  Layers,
} from 'lucide-react';
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
import type { LottieDoc } from '../lib/lottie';
import { cleanForExport, toTgsAutoFit } from '../lib/tgs';
import { applyBrandSlot, resetBrandSlot, DEFAULT_BRAND_OPTIONS } from '../lib/brandSlot';
import { FONTS, loadFont, type FontId } from '../lib/fonts';
import { fileToVectorLogo, type VectorLogo } from '../lib/logoVector';
import {
  CATALOG,
  TEMPLATE_CATEGORIES,
  isPureIconTemplate,
  type CatalogItem,
  type TemplateCategory,
} from '../lib/templates';
import type { PackItem } from './PackTray';
import type { SubscriptionState } from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';
import { haptic } from '../lib/telegram';
import { LazyThumb } from './LazyThumb';
import { BatchPackModal } from './BatchPackModal';
import type { Font } from 'opentype.js';

interface IrisAssistantViewProps {
  initialDoc: LottieDoc;
  templateItem: CatalogItem;
  pack: PackItem[];
  subscription: SubscriptionState;
  telegramUser: TelegramUser | null;
  onSelectTemplate: (item: CatalogItem) => void;
  onSaveSticker: (doc: LottieDoc, name: string) => void;
  onAddBatchItems?: (items: { doc: LottieDoc; name: string; catalogId?: string | null }[]) => void;
  onDownloadZip: () => void;
  onOpenProfile: () => void;
  onOpenAdvancedStudio: () => void;
}

/** Single clean sticker player without duplicate SVGs */
function IrisStickerPlayer({
  doc,
  playing = true,
  speed = 1,
  className,
  onFrameUpdate,
}: {
  doc: LottieDoc;
  playing?: boolean;
  speed?: number;
  className?: string;
  onFrameUpdate?: (cur: number, total: number) => void;
}) {
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
        autoplay: playing,
        animationData: cleanForExport(doc),
      });
      animRef.current = anim;
      anim.setSpeed(speed);

      if (onFrameUpdate) {
        anim.addEventListener('enterFrame', () => {
          if (anim) {
            onFrameUpdate(Math.round(anim.currentFrame), Math.round(anim.totalFrames));
          }
        });
      }
    } catch {}

    return () => {
      anim?.destroy();
      animRef.current = null;
    };
  }, [doc]);

  useEffect(() => {
    if (animRef.current) {
      if (playing) animRef.current.play();
      else animRef.current.pause();
    }
  }, [playing]);

  useEffect(() => {
    if (animRef.current) {
      animRef.current.setSpeed(speed);
    }
  }, [speed]);

  return <div ref={containerRef} className={className} />;
}

export function IrisAssistantView({
  initialDoc,
  templateItem,
  pack,
  subscription,
  telegramUser,
  onSelectTemplate,
  onSaveSticker,
  onDownloadZip,
  onOpenProfile,
  onOpenAdvancedStudio: _onOpenAdvancedStudio,
  onAddBatchItems,
}: IrisAssistantViewProps) {
  const isPureIcon = isPureIconTemplate(templateItem?.id);
  const [activeTab, setActiveTab] = useState<'editor' | 'catalog' | 'packs' | 'chat'>('editor');
  const [brandText, setBrandText] = useState(isPureIcon ? '' : 'MAGNAT');
  const [fillColor, setFillColor] = useState('#131822');
  const [strokeColor, setStrokeColor] = useState('#a8c7ef');
  const [selectedFontId, setSelectedFontId] = useState<FontId>('montserrat');
  const [uploadedLogo, setUploadedLogo] = useState<VectorLogo | null>(null);
  const [fonts, setFonts] = useState<Font[] | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Reset personalization when switching between templates
  useEffect(() => {
    if (isPureIconTemplate(templateItem?.id)) {
      setBrandText('');
      setUploadedLogo(null);
    } else {
      setBrandText('MAGNAT');
    }
  }, [templateItem?.id]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [frameInfo, setFrameInfo] = useState({ current: 0, total: 180 });
  const [backdropMode, setBackdropMode] = useState<'orb' | 'dark' | 'light' | 'alpha'>('orb');

  // Catalog tab filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);

  const userName = telegramUser?.first_name || 'MAGNAT';

  // Load font
  useEffect(() => {
    loadFont(selectedFontId)
      .then((f) => setFonts(f))
      .catch(() => {});
  }, [selectedFontId]);

  // Compute live styled LottieDoc
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Download .tgs directly
  const handleDownloadTgs = () => {
    haptic('medium');
    try {
      const docToExport = customizedDoc || initialDoc;
      const rawTgs = toTgsAutoFit(docToExport);
      const blob = new Blob([rawTgs], { type: 'application/x-tgsticker' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanFileName = brandText.trim()
        ? `${templateItem.id}_${brandText.trim().toLowerCase().replace(/\s+/g, '_')}.tgs`
        : `${templateItem.id}.tgs`;
      a.download = cleanFileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Файл «${templateItem.name}.tgs» успешно скачан!`);
    } catch {
      showToast('Ошибка при экспорте .tgs');
    }
  };

  // Save to user pack
  const handleSaveToPack = () => {
    haptic('success');
    const docToSave = customizedDoc || initialDoc;
    const name = brandText.trim()
      ? `${templateItem.name} (${brandText.trim()})`
      : templateItem.name;
    onSaveSticker(docToSave, name);
    showToast(`«${name}» сохранён в ваши паки!`);
  };

  // Handle logo upload
  const handleLogoUpload = async (file: File) => {
    try {
      const logo = await fileToVectorLogo(file);
      setUploadedLogo(logo);
      haptic('success');
      showToast(`Логотип «${logo.name}» встроен в слои!`);
    } catch {
      haptic('error');
      showToast('Не удалось векторизовать логотип');
    }
  };

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    let list = CATALOG;
    if (selectedCategory !== 'all') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  // Top popular templates for carousel
  const popularTemplates = useMemo(() => CATALOG.slice(0, 16), []);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="iris-page-root">
      {/* ATMOSPHERIC TOP LIGHTING GLOW */}
      <div className="top-glow-system">
        <div className="glow-center-blue" />
        <div className="glow-right-violet" />
        <div className="glow-left-cyan" />
      </div>

      <div className="app-shell">
        {/* LEFT RAIL (48u) */}
        <aside className="left-rail">
          {/* Logo Tile */}
          <div
            className="rail-logo-tile"
            onClick={() => setActiveTab('editor')}
            title="MAGNAT Emoji Studio"
          >
            <Sparkles size={18} color="#0E0E0E" />
          </div>

          {/* Grouped 32u Icon Tiles */}
          <nav className="rail-group">
            <button
              type="button"
              className={`rail-tile ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('editor');
                haptic('select');
              }}
              title="Студия / Редактор"
            >
              <Wand2 size={16} />
            </button>

            <button
              type="button"
              className={`rail-tile ${activeTab === 'catalog' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('catalog');
                haptic('select');
              }}
              title="Каталог 284 шаблонов"
            >
              <LayoutGrid size={16} />
            </button>

            <button
              type="button"
              className={`rail-tile ${activeTab === 'packs' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('packs');
                haptic('select');
              }}
              title="Мои паки"
            >
              <FolderOpen size={16} />
            </button>

            <button
              type="button"
              className={`rail-tile ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('chat');
                haptic('select');
              }}
              title="Превью в Telegram чате"
            >
              <MessageSquare size={16} />
            </button>
          </nav>

          {/* Bottom user & settings */}
          <div className="rail-bottom">
            <div
              className="rail-user-tile"
              onClick={onOpenProfile}
              title={`Профиль: ${userName} • Баланс: ${subscription.generationsBalance} ✨`}
            >
              {userName[0].toUpperCase()}
            </div>
            <button
              type="button"
              className="rail-tile"
              onClick={onOpenProfile}
              title="Настройки тарифа и VIP"
            >
              <Star size={16} />
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="main-viewport">
          {/* TOP BAR */}
          <header className="top-bar">
            <div className="top-bar-left">
              <button
                type="button"
                className="nav-arrow-tile"
                onClick={() => setActiveTab('catalog')}
                title="Все шаблоны"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                className="nav-arrow-tile"
                onClick={() => setActiveTab('editor')}
                title="Редактор"
              >
                <ArrowRight size={14} />
              </button>
              <nav className="breadcrumbs">
                <span className="breadcrumb-item" onClick={() => setActiveTab('catalog')}>
                  MAGNAT
                </span>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-item" onClick={() => setActiveTab('editor')}>
                  Студия эмодзи
                </span>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-current">
                  #{templateItem.num} {templateItem.name}
                </span>
              </nav>
            </div>

            <div className="top-bar-right">
              {/* Search */}
              <div className="glass-search-box">
                <Search size={13} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Поиск по 284 шаблонам..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTab !== 'catalog') setActiveTab('catalog');
                  }}
                />
              </div>

              {/* Quick Actions in Top Bar */}
              <button
                type="button"
                className="top-action-btn primary"
                onClick={handleDownloadTgs}
                title="Экспортировать официальный .tgs стикер"
              >
                <Download size={13} />
                <span>Скачать .tgs</span>
              </button>

              <button
                type="button"
                className="top-action-btn"
                onClick={handleSaveToPack}
                title="Сохранить стикер в ваш пак"
              >
                <Sparkles size={13} color="#fbbf24" />
                <span>В пак</span>
              </button>

              <div
                className="top-avatar-tile"
                onClick={onOpenProfile}
                title={`Профиль: ${userName} • Баланс: ${subscription.generationsBalance} ✨`}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {userName[0].toUpperCase()}
                </span>
              </div>
            </div>
          </header>

          {/* SUB BAR (UNDER TOP BAR) */}
          <section className="sub-bar">
            <div className="segmented-toggle">
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('editor');
                  haptic('select');
                }}
              >
                🎨 Редактор
              </button>
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'catalog' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('catalog');
                  haptic('select');
                }}
              >
                ▦ Каталог (284)
              </button>
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'packs' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('packs');
                  haptic('select');
                }}
              >
                📂 Мои паки ({pack.length})
              </button>
              <button
                type="button"
                className={`toggle-segment ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('chat');
                  haptic('select');
                }}
              >
                💬 Чат
              </button>
            </div>

            <div className="status-pill-glass">
              <span className="status-pulse-dot" />
              <span className="status-pill-text">MAGNAT Engine • 284 готовых шаблона</span>
              <span className="status-count-badge">60 FPS</span>
            </div>
          </section>

          {/* TAB 1: THE MAIN EDITOR VIEW */}
          {activeTab === 'editor' && (
            <section className="hero-container">
              {/* THE LIVING GLASS STAGE LAYER (160u) */}
              <div
                className={`orb-stage-layer ${backdropMode !== 'orb' ? `backdrop-${backdropMode}` : ''}`}
                style={{
                  width: 'calc(160 * var(--u))',
                  height: 'calc(160 * var(--u))',
                  margin: 'calc(6 * var(--u)) 0 calc(2 * var(--u)) 0',
                  borderRadius: '50%',
                }}
              >
                <div className="orb-still-plate" />

                {/* Animated Lottie Sticker inside Stage */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 3,
                    width: '84%',
                    height: '84%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IrisStickerPlayer
                    doc={customizedDoc}
                    playing={isPlaying}
                    speed={playSpeed}
                    className="tma-editor-choice-player"
                    onFrameUpdate={(cur, tot) => setFrameInfo({ current: cur, total: tot })}
                  />
                </div>

                <div className="orb-glass-specular" />
              </div>

              {/* STAGE CONTROLS ROW */}
              <div className="stage-controls-bar">
                <div className="stage-ctrl-group">
                  <button
                    type="button"
                    className="stage-ctrl-btn"
                    onClick={() => setIsPlaying((p) => !p)}
                    title={isPlaying ? 'Пауза' : 'Воспроизведение'}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  </button>

                  <div className="stage-frame-counter">
                    {frameInfo.current} / {frameInfo.total}
                  </div>
                </div>

                <div className="stage-ctrl-divider" />

                <div className="stage-speed-chips">
                  {[0.5, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`speed-chip ${playSpeed === s ? 'active' : ''}`}
                      onClick={() => setPlaySpeed(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div className="stage-ctrl-divider" />

                <div className="stage-backdrop-chips">
                  <button
                    type="button"
                    className={`backdrop-chip ${backdropMode === 'orb' ? 'active' : ''}`}
                    onClick={() => setBackdropMode('orb')}
                  >
                    Студия
                  </button>
                  <button
                    type="button"
                    className={`backdrop-chip ${backdropMode === 'dark' ? 'active' : ''}`}
                    onClick={() => setBackdropMode('dark')}
                  >
                    Тёмный
                  </button>
                  <button
                    type="button"
                    className={`backdrop-chip ${backdropMode === 'alpha' ? 'active' : ''}`}
                    onClick={() => setBackdropMode('alpha')}
                  >
                    Сетка
                  </button>
                </div>
              </div>

              {/* HERO TYPOGRAPHY */}
              <div className="hero-text-block">
                <p className="hero-greeting">#{templateItem.num} • {templateItem.name}</p>
                <h1 className="hero-headline">
                  <span>MAGNAT</span>
                  <span>EMOJI</span>
                  <span>STUDIO</span>
                </h1>
                <p className="hero-subline">
                  Персонализируйте надпись, цвета и векторный логотип для Telegram на лету.
                </p>
              </div>

              {/* COMPOSER (Crisp, perfectly aligned, zero overflow) */}
              <div className="composer-wrap">
                {/* Top text input row */}
                <div className="composer-top-row">
                  <Type size={18} color="#2F6BFF" />
                  <input
                    type="text"
                    className="composer-main-input"
                    placeholder={isPureIcon ? "Впишите текст (по желанию)..." : "Впишите надпись (например MAGNAT)..."}
                    value={brandText}
                    onChange={(e) => setBrandText(e.target.value)}
                    maxLength={18}
                  />
                  <span className="composer-char-pill">{brandText.length}/18</span>
                </div>

                <div className="composer-divider" />

                {/* Middle tools row (Font, Colors, Logo) */}
                <div className="composer-tools-row">
                  {/* Font selector */}
                  <select
                    className="composer-chip-btn font-select"
                    value={selectedFontId}
                    onChange={(e) => setSelectedFontId(e.target.value as FontId)}
                    style={{ background: '#181818', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {FONTS.map((f) => (
                      <option key={f.id} value={f.id} style={{ background: '#151515', color: '#fff' }}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  {/* Fill color */}
                  <button
                    type="button"
                    className="composer-chip-btn"
                    onClick={() => fillInputRef.current?.click()}
                    title={`Цвет заливки: ${fillColor}`}
                  >
                    <span className="composer-color-indicator" style={{ background: fillColor }} />
                    <span>Заливка</span>
                    <span className="composer-hex-tag">{fillColor}</span>
                    <input
                      ref={fillInputRef}
                      type="color"
                      value={fillColor}
                      onChange={(e) => setFillColor(e.target.value)}
                      hidden
                    />
                  </button>

                  {/* Stroke color */}
                  <button
                    type="button"
                    className="composer-chip-btn"
                    onClick={() => strokeInputRef.current?.click()}
                    title={`Цвет обводки: ${strokeColor}`}
                  >
                    <span className="composer-color-indicator" style={{ background: strokeColor }} />
                    <span>Обводка</span>
                    <span className="composer-hex-tag">{strokeColor}</span>
                    <input
                      ref={strokeInputRef}
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      hidden
                    />
                  </button>

                  {/* Upload Logo */}
                  <button
                    type="button"
                    className="composer-chip-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Загрузить векторный логотип"
                  >
                    <Upload size={12} />
                    <span>{uploadedLogo ? uploadedLogo.name : 'Логотип'}</span>
                    {uploadedLogo && (
                      <X
                        size={12}
                        style={{ marginLeft: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedLogo(null);
                        }}
                      />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.svg"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Bottom action row: Pack info + Multi-add on left, Single actions on right */}
                <div className="composer-action-bar">
                  <div className="composer-pack-meta">
                    <button
                      type="button"
                      className="composer-pack-pill"
                      onClick={() => setActiveTab('packs')}
                      title="Открыть мой пак"
                    >
                      <Layers size={13} color="#2F6BFF" />
                      <span>В паке: <strong>{pack.length}</strong></span>
                    </button>

                    <button
                      type="button"
                      className="composer-multi-btn"
                      onClick={() => setShowBatchModal(true)}
                      title="Собрать пак: выбрать сразу много или все эмодзи"
                    >
                      <Plus size={13} />
                      <span>Добавить много в пак</span>
                    </button>
                  </div>

                  <div className="composer-action-buttons">
                    <button
                      type="button"
                      className="composer-btn-glass"
                      onClick={handleSaveToPack}
                      title="Добавить этот эмодзи в пак"
                    >
                      <Sparkles size={13} color="#fbbf24" />
                      <span>В пак</span>
                    </button>
                    <button
                      type="button"
                      className="composer-btn-gradient"
                      onClick={handleDownloadTgs}
                      title="Скачать официальный .tgs стикер"
                    >
                      <Download size={13} />
                      <span>Скачать .tgs</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* THREE QUICK-ACTION CARDS (Strict 3-column grid, zero overlap) */}
              <div className="quick-actions-row">
                <div
                  className="quick-card"
                  onClick={() => setActiveTab('catalog')}
                  title="Открыть все 284 шаблона"
                >
                  <div className="card-icon-wrap card-icon-blue">
                    <LayoutGrid size={16} />
                  </div>
                  <div className="card-content">
                    <div className="card-title">284 готовых шаблона</div>
                    <div className="card-subtitle">Персонажи, подарки, любовь, 3D значки</div>
                  </div>
                </div>

                <div
                  className="quick-card"
                  onClick={() => fileInputRef.current?.click()}
                  title="Загрузить логотип"
                >
                  <div className="card-icon-wrap card-icon-violet">
                    <ImageIcon size={16} />
                  </div>
                  <div className="card-content">
                    <div className="card-title">Векторный брендинг</div>
                    <div className="card-subtitle">Загрузка логотипа прямо в слои</div>
                  </div>
                </div>

                <div
                  className="quick-card"
                  onClick={onDownloadZip}
                  title="Скачать ZIP архив пака"
                >
                  <div className="card-icon-wrap card-icon-indigo">
                    <FolderOpen size={16} />
                  </div>
                  <div className="card-content">
                    <div className="card-title">Экспорт в @Stickers</div>
                    <div className="card-subtitle">Готовый .zip архив эмодзи и стикеров</div>
                  </div>
                </div>
              </div>

              {/* RECENT / POPULAR TEMPLATES CAROUSEL */}
              <div className="popular-shelf-wrap">
                <div className="popular-shelf-header">
                  <span className="popular-shelf-title">Популярные шаблоны каталога</span>
                  <span className="popular-shelf-link" onClick={() => setActiveTab('catalog')}>
                    Смотреть все 284 →
                  </span>
                </div>

                <div className="popular-shelf-cards">
                  {popularTemplates.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectTemplate(item)}
                      className={`popular-tile-card ${templateItem.id === item.id ? 'selected' : ''}`}
                      title={`#${item.num} ${item.name}`}
                    >
                      <div className="popular-tile-thumb">
                        <LazyThumb item={item} />
                      </div>
                      <span className="popular-tile-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: FULL CATALOG (284 TEMPLATES) */}
          {activeTab === 'catalog' && (
            <div className="iris-catalog-container">
              {/* Category Filter Pills & Multi-add button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'calc(16 * var(--u))' }}>
                <div className="iris-catalog-filters" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`iris-filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    Все ({CATALOG.length})
                  </button>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`iris-filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.label} ({CATALOG.filter((c) => c.category === cat.id).length})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="composer-multi-btn"
                  onClick={() => setShowBatchModal(true)}
                  style={{ height: 'calc(32 * var(--u))', padding: '0 calc(14 * var(--u))' }}
                >
                  <PackagePlus size={14} color="#3b82f6" />
                  <span>Добавить много в пак</span>
                </button>
              </div>

              {/* Grid of 284 Templates */}
              <div className="iris-grid-cards">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    className={`iris-template-card ${templateItem.id === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectTemplate(item);
                      setActiveTab('editor');
                      haptic('select');
                    }}
                  >
                    <span className="iris-template-num">#{item.num}</span>
                    <div className="iris-template-thumb">
                      <LazyThumb item={item} />
                    </div>
                    <span className="iris-template-name">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PACKS VIEW */}
          {activeTab === 'packs' && (
            <div className="iris-catalog-container" style={{ maxWidth: 'calc(780 * var(--u))' }}>
              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'calc(18 * var(--u))',
                  padding: 'calc(24 * var(--u))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'calc(16 * var(--u))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 'calc(18 * var(--u))', fontWeight: 600 }}>Мой стикерпак</h2>
                    <p style={{ fontSize: 'calc(12 * var(--u))', color: '#8C8C8C', marginTop: 4 }}>
                      Готово к публикации в официальном боте @Stickers • {pack.length} эмодзи
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'calc(10 * var(--u))' }}>
                    <button
                      type="button"
                      className="top-action-btn"
                      onClick={() => setShowBatchModal(true)}
                      style={{ height: 'calc(38 * var(--u))', padding: '0 calc(16 * var(--u))' }}
                    >
                      <Plus size={14} color="#3b82f6" />
                      <span>Добавить много</span>
                    </button>
                    <button
                      type="button"
                      className="top-action-btn primary"
                      onClick={onDownloadZip}
                      disabled={pack.length === 0}
                      style={{ height: 'calc(38 * var(--u))', padding: '0 calc(16 * var(--u))' }}
                    >
                      <Download size={14} />
                      <span>Скачать ZIP для Telegram</span>
                    </button>
                  </div>
                </div>

                {pack.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'calc(40 * var(--u)) 0', color: '#6E6E6E' }}>
                    В паке пока нет сохранённых стикеров. Выберите шаблон в редакторе и нажмите «В пак»!
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(calc(90 * var(--u)), 1fr))',
                      gap: 'calc(12 * var(--u))',
                      marginTop: 'calc(10 * var(--u))',
                    }}
                  >
                    {pack.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          background: 'var(--surface-2)',
                          borderRadius: 'calc(10 * var(--u))',
                          padding: 'calc(8 * var(--u))',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          border: '1px solid var(--border-hairline)',
                        }}
                      >
                        <div style={{ width: '80%', aspectRatio: '1' }}>
                          <LazyThumb doc={item.doc} />
                        </div>
                        <span
                          style={{
                            fontSize: 'calc(10 * var(--u))',
                            color: '#CBD5E1',
                            marginTop: 4,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '90%',
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TELEGRAM CHAT SIMULATION */}
          {activeTab === 'chat' && (
            <div className="iris-catalog-container" style={{ maxWidth: 'calc(620 * var(--u))' }}>
              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'calc(20 * var(--u))',
                  padding: 'calc(24 * var(--u))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'calc(16 * var(--u))',
                }}
              >
                <div style={{ fontSize: 'calc(13 * var(--u))', color: '#8C8C8C', fontWeight: 600 }}>
                  ПРЕВЬЮ АНИМАЦИИ В СООБЩЕНИИ TELEGRAM
                </div>

                <div
                  style={{
                    background: '#0B0E14',
                    borderRadius: 'calc(16 * var(--u))',
                    padding: 'calc(20 * var(--u))',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      background: '#1F2937',
                      borderRadius: 'calc(14 * var(--u)) calc(14 * var(--u)) calc(14 * var(--u)) calc(4 * var(--u))',
                      padding: 'calc(10 * var(--u)) calc(14 * var(--u))',
                      maxWidth: '70%',
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: 'calc(14 * var(--u))' }}>
                      Смотри какой анимированный эмодзи сделал в MAGNAT! 🔥
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 'calc(10 * var(--u))', textAlign: 'right', marginTop: 4 }}>
                      {timeStr} ✓✓
                    </div>
                  </div>

                  <div style={{ width: 'calc(70 * var(--u))', height: 'calc(70 * var(--u))', flexShrink: 0 }}>
                    <IrisStickerPlayer doc={customizedDoc} playing={true} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'calc(10 * var(--u))' }}>
                  <button type="button" className="top-action-btn primary" onClick={handleDownloadTgs}>
                    <Download size={13} />
                    <span>Скачать .tgs</span>
                  </button>
                  <button type="button" className="top-action-btn" onClick={handleSaveToPack}>
                    <Sparkles size={13} color="#fbbf24" />
                    <span>В пак</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* BATCH PACK MODAL */}
      <BatchPackModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        brandText={brandText}
        fillColor={fillColor}
        strokeColor={strokeColor}
        uploadedLogo={uploadedLogo}
        fonts={fonts}
        packLength={pack.length}
        onAddBatch={(items) => {
          if (onAddBatchItems) {
            onAddBatchItems(items);
          } else {
            for (const it of items) onSaveSticker(it.doc, it.name);
          }
          showToast(`🎉 Добавлено ${items.length} эмодзи в ваш пак! Всего: ${pack.length + items.length}`);
        }}
      />

      {/* FLOATING TOAST */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(24 * var(--u))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #2F6BFF, #5A4CF5)',
            color: '#ffffff',
            padding: 'calc(10 * var(--u)) calc(20 * var(--u))',
            borderRadius: 'calc(999 * var(--u))',
            fontSize: 'calc(13 * var(--u))',
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(47, 107, 255, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check size={16} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
