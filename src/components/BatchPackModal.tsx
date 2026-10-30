import { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Sparkles,
  PackagePlus,
  CheckSquare,
  Square,
  Layers,
  Flame,
  Zap,
} from 'lucide-react';
import {
  CATALOG,
  TEMPLATE_CATEGORIES,
  isPureIconTemplate,
  PURE_ICON_TEMPLATE_IDS,
  type TemplateCategory,
} from '../lib/catalog';
import { loadCatalogDoc } from '../lib/templates';
import { applyBrandSlot, resetBrandSlot, DEFAULT_BRAND_OPTIONS } from '../lib/brandSlot';
import type { LottieDoc } from '../lib/lottie';
import type { VectorLogo } from '../lib/logoVector';
import type { Font } from 'opentype.js';
import { LazyThumb } from './LazyThumb';
import { haptic } from '../lib/telegram';

export interface BatchPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandText: string;
  fillColor: string;
  strokeColor: string;
  uploadedLogo: VectorLogo | null;
  fonts: Font[] | null;
  packLength: number;
  onAddBatch: (items: { doc: LottieDoc; name: string; catalogId: string }[]) => void;
}

export function BatchPackModal({
  isOpen,
  onClose,
  brandText,
  fillColor,
  strokeColor,
  uploadedLogo,
  fonts,
  packLength,
  onAddBatch,
}: BatchPackModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<'all' | TemplateCategory>('all');
  const [search, setSearch] = useState('');
  const [applyStyle, setApplyStyle] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Filter catalog
  const filteredItems = useMemo(() => {
    let list = CATALOG;
    if (activeCategory !== 'all') {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || String(i.num).includes(q));
    }
    return list;
  }, [activeCategory, search]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    haptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectPreset = (type: 'pure' | 'popular' | 'category' | 'all') => {
    haptic('medium');
    const next = new Set(selectedIds);
    if (type === 'pure') {
      for (const id of PURE_ICON_TEMPLATE_IDS) next.add(id);
    } else if (type === 'popular') {
      for (const item of CATALOG.slice(0, 16)) next.add(item.id);
    } else if (type === 'category') {
      for (const item of filteredItems) next.add(item.id);
    } else if (type === 'all') {
      for (const item of CATALOG) next.add(item.id);
    }
    setSelectedIds(next);
  };

  const selectAllFiltered = () => {
    haptic('light');
    const next = new Set(selectedIds);
    for (const item of filteredItems) next.add(item.id);
    setSelectedIds(next);
  };

  const clearSelection = () => {
    haptic('light');
    setSelectedIds(new Set());
  };

  const handleConfirmAdd = async () => {
    if (selectedIds.size === 0 || isProcessing) return;
    setIsProcessing(true);
    haptic('medium');

    const targetItems = CATALOG.filter((i) => selectedIds.has(i.id));
    setProgress({ current: 0, total: targetItems.length });

    try {
      const processed: { doc: LottieDoc; name: string; catalogId: string }[] = [];
      const trimmedText = brandText.trim();
      const hasText = trimmedText.length > 0;
      const hasLogo = Boolean(uploadedLogo);

      for (let i = 0; i < targetItems.length; i++) {
        const item = targetItems[i];
        const rawDoc = await loadCatalogDoc(item);
        const clone = structuredClone(rawDoc);

        const isPure = isPureIconTemplate(item.id);

        if (applyStyle && (hasText || hasLogo)) {
          if (isPure && !hasText && !hasLogo) {
            resetBrandSlot(clone);
          } else {
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
              fonts ?? null,
            );
          }
        } else {
          resetBrandSlot(clone);
        }

        const displayName = hasText && (!isPure || hasText)
          ? `${item.name} (${trimmedText})`
          : item.name;

        processed.push({
          doc: clone,
          name: displayName,
          catalogId: item.id,
        });

        if ((i + 1) % 5 === 0 || i === targetItems.length - 1) {
          setProgress({ current: i + 1, total: targetItems.length });
        }
      }

      onAddBatch(processed);
      haptic('success');
      onClose();
    } catch (err) {
      console.error('Batch add error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="batch-modal-backdrop" onClick={onClose}>
      <div className="batch-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="batch-modal-header">
          <div className="batch-modal-title-group">
            <div className="batch-modal-icon">
              <PackagePlus size={20} color="#2F6BFF" />
            </div>
            <div>
              <h2 className="batch-modal-title">Добавить много эмодзи в пак</h2>
              <p className="batch-modal-subtitle">
                Выберите готовые наборы или отметьте нужные шаблоны • Всего в каталоге: {CATALOG.length}
              </p>
            </div>
          </div>
          <button type="button" className="batch-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* QUICK PRESETS (1-CLICK SELECTION) */}
        <div className="batch-presets-section">
          <span className="batch-presets-label">Быстрый выбор в 1 клик:</span>
          <div className="batch-presets-chips">
            <button
              type="button"
              className="batch-preset-btn"
              onClick={() => selectPreset('pure')}
              title="Добавить все 11 чистых значков (Ракета, Корона, Огонь, Ссылка...)"
            >
              <Zap size={13} color="#3b82f6" />
              <span>⚡ Все 11 чистых значков</span>
            </button>
            <button
              type="button"
              className="batch-preset-btn"
              onClick={() => selectPreset('popular')}
              title="Добавить топ 16 популярных шаблонов"
            >
              <Flame size={13} color="#f59e0b" />
              <span>🔥 Топ 16 популярных</span>
            </button>
            <button
              type="button"
              className="batch-preset-btn"
              onClick={() => selectPreset('category')}
              title="Выбрать все шаблоны из текущей вкладки"
            >
              <Layers size={13} color="#10b981" />
              <span>Вся категория ({filteredItems.length})</span>
            </button>
            <button
              type="button"
              className="batch-preset-btn"
              onClick={() => selectPreset('all')}
              title="Выбрать вообще все 284 эмодзи для полного пака"
            >
              <Sparkles size={13} color="#a855f7" />
              <span>🚀 Все 284 эмодзи каталога</span>
            </button>
          </div>
        </div>

        {/* FILTERS AND SEARCH TOOLBAR */}
        <div className="batch-toolbar">
          <div className="batch-search-box">
            <Search size={14} color="#8c8c8c" />
            <input
              type="text"
              className="batch-search-input"
              placeholder="Поиск по названию или номеру..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <X size={13} className="batch-search-clear" onClick={() => setSearch('')} />
            )}
          </div>

          <div className="batch-category-pills">
            <button
              type="button"
              className={`batch-cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Все ({CATALOG.length})
            </button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`batch-cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label} ({CATALOG.filter((c) => c.category === cat.id).length})
              </button>
            ))}
          </div>

          <div className="batch-selection-actions">
            <button
              type="button"
              className="batch-action-link"
              onClick={selectAllFiltered}
            >
              <CheckSquare size={13} />
              <span>Выбрать все ({filteredItems.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="batch-action-link danger"
                onClick={clearSelection}
              >
                <Square size={13} />
                <span>Снять выбор</span>
              </button>
            )}
          </div>
        </div>

        {/* TEMPLATES GRID */}
        <div className="batch-grid-container">
          <div className="batch-grid">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`batch-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <div className={`batch-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <span className="batch-card-num">#{item.num}</span>
                  <div className="batch-card-thumb">
                    <LazyThumb item={item} />
                  </div>
                  <span className="batch-card-name" title={item.name}>
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="batch-modal-footer">
          <div className="batch-footer-left">
            <label className="batch-style-toggle">
              <input
                type="checkbox"
                checked={applyStyle}
                onChange={(e) => setApplyStyle(e.target.checked)}
              />
              <span className="batch-style-label">
                Применить текущую персонализацию:
                <strong style={{ marginLeft: 5, color: '#60a5fa' }}>
                  {brandText.trim() ? `«${brandText.trim()}»` : 'Чистый вид'}
                </strong>
                <span className="batch-color-dots">
                  <span className="batch-dot" style={{ background: fillColor }} title="Заливка" />
                  <span className="batch-dot" style={{ background: strokeColor }} title="Обводка" />
                </span>
              </span>
            </label>

            <span className="batch-count-info">
              Выбрано: <strong>{selectedIds.size}</strong> эмодзи • Всего в паке станет:{' '}
              <strong>{packLength + selectedIds.size}</strong>
            </span>
          </div>

          <div className="batch-footer-right">
            <button
              type="button"
              className="batch-btn-cancel"
              onClick={onClose}
              disabled={isProcessing}
            >
              Отмена
            </button>

            <button
              type="button"
              className="batch-btn-submit"
              onClick={handleConfirmAdd}
              disabled={selectedIds.size === 0 || isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="batch-spinner" />
                  <span>
                    Добавление {progress.current} / {progress.total}...
                  </span>
                </>
              ) : (
                <>
                  <PackagePlus size={15} />
                  <span>Добавить {selectedIds.size} в пак</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
