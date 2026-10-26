import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Info,
  Search,
  X,
} from 'lucide-react';
import {
  CATALOG,
  loadCatalogDoc,
  type CatalogItem,
  type TemplateCategory,
} from '../lib/templates';
import type { LottieDoc } from '../lib/lottie';
import { LazyThumb } from './LazyThumb';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: LottieDoc, item: CatalogItem, addToPack: boolean) => void;
  onOpenMultiForEdit: (items: CatalogItem[]) => void;
  onAddBatchToPack: (items: CatalogItem[]) => void;
  defaultAddToPack?: boolean;
}

type WhaleFilter = 'no_whale' | 'all' | 'with_whale';

interface CategoryTab {
  id: 'all' | TemplateCategory | 'finance';
  label: string;
}

const MODAL_CATEGORIES: CategoryTab[] = [
  { id: 'shablony1', label: 'шаблоны tier' },
  { id: 'classic', label: 'классика' },
  { id: 'characters', label: 'персонажи' },
  { id: 'gifts', label: 'подарки' },
  { id: 'love', label: 'любовь' },
  { id: 'finance', label: 'финансы' },
  { id: 'all', label: 'все' },
];

export function TemplatesModal({
  isOpen,
  onClose,
  onSelect,
  onOpenMultiForEdit,
  defaultAddToPack = false,
}: TemplatesModalProps) {
  const [category, setCategory] = useState<'all' | TemplateCategory | 'finance'>('shablony1');
  const [search, setSearch] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [whaleFilter, setWhaleFilter] = useState<WhaleFilter>('no_whale');
  const [showWhaleDropdown, setShowWhaleDropdown] = useState(false);
  const [showBriefModal, setShowBriefModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBriefModal) {
          setShowBriefModal(false);
        } else if (showWhaleDropdown) {
          setShowWhaleDropdown(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, showBriefModal, showWhaleDropdown]);

  // Pre-calculate finance items (17 curated finance/wealth items from classic)
  const financeIds = useMemo(() => {
    const classicItems = CATALOG.filter((c) => c.category === 'classic');
    return new Set(classicItems.slice(0, 17).map((c) => c.id));
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: CATALOG.length,
      finance: 17,
    };
    for (const item of CATALOG) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return CATALOG.filter((item) => {
      // Category filter
      if (category === 'finance') {
        if (!financeIds.has(item.id)) return false;
      } else if (category !== 'all' && item.category !== category) {
        return false;
      }

      // Whale filter
      if (whaleFilter === 'with_whale') {
        if (!item.name.toLowerCase().includes('кит') && !item.name.toLowerCase().includes('whale')) {
          return false;
        }
      } else if (whaleFilter === 'no_whale') {
        if (item.name.toLowerCase().includes('кит') || item.name.toLowerCase().includes('whale')) {
          return false;
        }
      }

      // Search query
      if (!q) return true;
      const numStr = String(item.num);
      const padStr = String(item.num).padStart(3, '0');
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        numStr === q ||
        padStr.includes(q)
      );
    });
  }, [category, financeIds, whaleFilter, search]);

  if (!isOpen) return null;

  const pickedSet = new Set(pickedIds);

  const togglePicked = (id: string) => {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    const allFilteredIds = filtered.map((f) => f.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => pickedSet.has(id));
    if (allSelected) {
      setPickedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setPickedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const pickItem = async (item: CatalogItem, toPack: boolean) => {
    if (loadingId) return;
    setLoadingId(item.id);
    try {
      const doc = await loadCatalogDoc(item);
      onSelect(doc, item, toPack);
    } finally {
      setLoadingId(null);
    }
  };

  const resolvePickedItems = (): CatalogItem[] => {
    const byId = new Map(CATALOG.map((c) => [c.id, c]));
    return pickedIds.map((id) => byId.get(id)).filter((x): x is CatalogItem => Boolean(x));
  };

  const handleDone = async () => {
    if (pickedIds.length === 1) {
      const target = CATALOG.find((c) => c.id === pickedIds[0]);
      if (target) {
        await pickItem(target, defaultAddToPack);
        onClose();
        return;
      }
    } else if (pickedIds.length > 1) {
      const items = resolvePickedItems();
      onOpenMultiForEdit(items);
      onClose();
      return;
    }

    if (filtered.length > 0) {
      await pickItem(filtered[0], defaultAddToPack);
      onClose();
    } else {
      onClose();
    }
  };

  const whaleLabel =
    whaleFilter === 'no_whale' ? 'Т без кита' : whaleFilter === 'with_whale' ? 'С китом' : 'Все шаблоны';

  return (
    <div className="tier-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tier-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* TOP HEADER */}
        <div className="tier-modal-header">
          <div className="tier-modal-title">шаблоны tier</div>

          <div className="tier-modal-controls">
            {/* Whale filter dropdown */}
            <div className="tier-dropdown-wrap">
              <button
                type="button"
                className="tier-btn-dropdown"
                onClick={() => setShowWhaleDropdown((v) => !v)}
              >
                <span>{whaleLabel}</span>
                <ChevronDown size={14} className="tier-dropdown-chevron" />
              </button>

              {showWhaleDropdown && (
                <div className="tier-dropdown-menu">
                  <button
                    type="button"
                    className={`tier-dropdown-item ${whaleFilter === 'no_whale' ? 'active' : ''}`}
                    onClick={() => {
                      setWhaleFilter('no_whale');
                      setShowWhaleDropdown(false);
                    }}
                  >
                    Т без кита
                  </button>
                  <button
                    type="button"
                    className={`tier-dropdown-item ${whaleFilter === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setWhaleFilter('all');
                      setShowWhaleDropdown(false);
                    }}
                  >
                    Все шаблоны
                  </button>
                  <button
                    type="button"
                    className={`tier-dropdown-item ${whaleFilter === 'with_whale' ? 'active' : ''}`}
                    onClick={() => {
                      setWhaleFilter('with_whale');
                      setShowWhaleDropdown(false);
                    }}
                  >
                    С китом
                  </button>
                </div>
              )}
            </div>

            {/* Select all button */}
            <button
              type="button"
              className="tier-btn-action"
              onClick={handleSelectAll}
              title="Выбрать все показанные эмодзи"
            >
              выбрать все
            </button>

            {/* Briefs button */}
            <button
              type="button"
              className="tier-btn-action"
              onClick={() => setShowBriefModal(true)}
              title="Открыть бриф и требования к Telegram .tgs шаблонам"
            >
              брифы
            </button>

            {/* Done primary button */}
            <button
              type="button"
              className="tier-btn-done"
              onClick={handleDone}
              title={
                pickedIds.length > 1
                  ? `Открыть ${pickedIds.length} эмодзи для совместного редактирования`
                  : 'Завершить выбор'
              }
            >
              {pickedIds.length > 1 ? `готово (${pickedIds.length})` : 'готово'}
            </button>

            {/* Close button */}
            <button
              type="button"
              className="tier-btn-close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="tier-modal-search-row">
          <div className="tier-modal-search-box">
            <Search size={16} className="tier-search-icon" />
            <input
              type="text"
              className="tier-search-input"
              placeholder="поиск по номеру"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="tier-search-clear"
                onClick={() => setSearch('')}
                title="Очистить"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY PILLS */}
        <div className="tier-categories-row">
          {MODAL_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`tier-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                <span className="tier-pill-label">{cat.label}</span>
                <span className="tier-pill-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 10-COLUMN COMPACT SQUARE GRID */}
        <div className="tier-modal-grid">
          {filtered.map((item) => {
            const isPicked = pickedSet.has(item.id);
            const isBusy = loadingId === item.id;
            return (
              <div
                key={item.id}
                className={`tier-card ${isPicked ? 'picked' : ''} ${isBusy ? 'busy' : ''}`}
                onClick={() => togglePicked(item.id)}
                onDoubleClick={() => {
                  pickItem(item, defaultAddToPack);
                  onClose();
                }}
                title={`#${item.num} ${item.name}`}
              >
                {/* Sticker preview */}
                <div className="tier-card-thumb">
                  <LazyThumb item={item} />
                </div>

                {/* Top-right selection ring */}
                <div className={`tier-card-check ${isPicked ? 'checked' : ''}`}>
                  {isPicked ? <Check size={12} strokeWidth={3} /> : null}
                </div>

                {/* Bottom-left number */}
                <div className="tier-card-num">#{item.num}</div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="tier-modal-empty">По запросу ничего не найдено</div>
          )}
        </div>

        {/* BRIEFS POPUP MODAL */}
        {showBriefModal && (
          <div className="tier-brief-overlay" onClick={() => setShowBriefModal(false)}>
            <div className="tier-brief-box" onClick={(e) => e.stopPropagation()}>
              <div className="tier-brief-header">
                <div className="tier-brief-title">
                  <Info size={18} className="tier-brief-icon" />
                  <span>Брифы и стандарты шаблонов tier</span>
                </div>
                <button
                  type="button"
                  className="tier-btn-close"
                  onClick={() => setShowBriefModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="tier-brief-body">
                <div className="tier-brief-item">
                  <strong>📐 Формат & Размер:</strong>
                  <span>Холст 512×512 px, 60 кадров/сек, до 3.0 секунд (180 кадров).</span>
                </div>
                <div className="tier-brief-item">
                  <strong>💾 Вес Telegram .tgs:</strong>
                  <span>До 64 КБ (строго по лимиту Telegram Gzip).</span>
                </div>
                <div className="tier-brief-item">
                  <strong>🎨 Векторные слоты:</strong>
                  <span>Чистые Shape Layers с поддержкой шрифтов, 3D градиентов и обводок.</span>
                </div>
                <div className="tier-brief-item">
                  <strong>🏷️ Двойной бренд-слот:</strong>
                  <span>Центральный никнейм (`TextGroup`) + текст на нижней плашке (`USERNAME`). Возможность отключения плашки.</span>
                </div>
              </div>

              <div className="tier-brief-footer">
                <button
                  type="button"
                  className="tier-btn-done"
                  onClick={() => setShowBriefModal(false)}
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
