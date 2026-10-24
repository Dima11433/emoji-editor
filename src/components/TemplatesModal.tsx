import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Layers, Plus, Search, X } from 'lucide-react';
import {
  CATALOG,
  loadCatalogDoc,
  TEMPLATE_CATEGORIES,
  type CatalogItem,
  type TemplateCategory,
} from '../lib/templates';
import type { LottieDoc } from '../lib/lottie';
import { formatKb } from '../lib/tgs';
import { LazyThumb } from './LazyThumb';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: LottieDoc, item: CatalogItem, addToPack: boolean) => void;
  onAddBatchToPack: (items: CatalogItem[]) => void;
  defaultAddToPack?: boolean;
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelect,
  onAddBatchToPack,
  defaultAddToPack = false,
}: TemplatesModalProps) {
  const [category, setCategory] = useState<'all' | TemplateCategory>('all');
  const [search, setSearch] = useState('');
  const [addToPack, setAddToPack] = useState(defaultAddToPack);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setAddToPack(defaultAddToPack);
  }, [defaultAddToPack]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: CATALOG.length };
    for (const item of CATALOG) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
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
  }, [category, search]);

  if (!isOpen) return null;

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

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>Каталог шаблонов и эмодзи</h2>
            <span className="modal-count">{CATALOG.length} эмодзи</span>
          </div>

          <div className="modal-search-box">
            <Search size={16} className="modal-search-icon" />
            <input
              type="text"
              className="modal-search-input"
              placeholder="Поиск по названию (Корона, Щит...) или номеру (#001)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="modal-search-clear"
                onClick={() => setSearch('')}
                title="Очистить"
              >
                ×
              </button>
            )}
          </div>

          <div className="modal-header-actions">
            {filtered.length > 0 && filtered.length <= 150 && (
              <button
                type="button"
                className="modal-mode-btn"
                onClick={() => {
                  onAddBatchToPack(filtered);
                  onClose();
                }}
                title="Загрузить все показанные эмодзи в нижнюю панель пака для пакетной переделки"
              >
                <FolderPlus size={15} />
                <span>Все в пак ({filtered.length})</span>
              </button>
            )}
            <button
              type="button"
              className={`modal-mode-btn ${addToPack ? 'active' : ''}`}
              onClick={() => setAddToPack((v) => !v)}
              title={addToPack ? 'Клик по карточке добавит эмодзи в пак' : 'Клик откроет эмодзи на холсте'}
            >
              {addToPack ? <Plus size={15} /> : <Layers size={15} />}
              <span>{addToPack ? 'Режим: в пак' : 'Режим: на холст'}</span>
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-categories">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`modal-chip ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <span>{cat.label}</span>
              <span className="count">{categoryCounts[cat.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="modal-grid">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`modal-card ${loadingId === item.id ? 'busy' : ''}`}
              onClick={() => {
                pickItem(item, addToPack);
              }}
            >
              <div className="modal-card-thumb">
                <LazyThumb item={item} />
                <span className="card-cat-tag">{item.categoryLabel}</span>
              </div>
              <div className="modal-card-info">
                <div>
                  <div className="modal-card-name">{item.name}</div>
                  <div className="muted tiny">{formatKb(item.bytes)}</div>
                </div>
                <button
                  type="button"
                  className="modal-card-add"
                  title="Добавить в пак без закрытия окна"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickItem(item, true);
                  }}
                >
                  <Plus size={13} /> В пак
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="modal-empty">По запросу «{search}» ничего не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
}
