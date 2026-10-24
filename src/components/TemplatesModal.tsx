import { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Search, X } from 'lucide-react';
import type { Font } from 'opentype.js';
import type { LottieDoc } from '../lib/lottie';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  type Template,
  type TemplateCategory,
} from '../lib/templates';
import { Thumb } from './Preview';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (doc: LottieDoc, template: Template, addToPack: boolean) => void;
  templateFonts: Font[] | null;
  defaultAddToPack?: boolean;
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelect,
  templateFonts,
  defaultAddToPack = false,
}: TemplatesModalProps) {
  const [category, setCategory] = useState<'all' | TemplateCategory>('all');
  const [search, setSearch] = useState('');
  const [addToPack, setAddToPack] = useState(defaultAddToPack);

  useEffect(() => {
    setAddToPack(defaultAddToPack);
  }, [defaultAddToPack]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const thumbs = useMemo(
    () =>
      TEMPLATES.map((t) => ({
        t,
        doc: t.needsFont && !templateFonts ? null : t.build(templateFonts),
      })),
    [templateFonts],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEMPLATES.length };
    for (const t of TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return thumbs.filter(({ t }) => {
      if (category !== 'all' && t.category !== category) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [thumbs, category, search]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>Шаблоны</h2>
            <span className="modal-count">{TEMPLATES.length} стикеров</span>
          </div>

          <div className="modal-search-box">
            <Search size={16} className="modal-search-icon" />
            <input
              type="text"
              className="modal-search-input"
              placeholder="Поиск по названию..."
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
            <button
              type="button"
              className={`modal-mode-btn ${addToPack ? 'active' : ''}`}
              onClick={() => setAddToPack((v) => !v)}
              title={addToPack ? 'Новый стикер добавится в пак' : 'Заменит текущий стикер на холсте'}
            >
              {addToPack ? <Plus size={15} /> : <Layers size={15} />}
              <span>{addToPack ? 'Добавить в пак' : 'Заменить текущий'}</span>
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
          {filtered.map(({ t, doc: tdoc }) => (
            <div
              key={t.id}
              className="modal-card"
              onClick={() => {
                if (!tdoc) return;
                onSelect(structuredClone(tdoc), t, addToPack);
              }}
            >
              <div className="modal-card-thumb">
                {tdoc ? <Thumb doc={tdoc} /> : <div className="thumb-placeholder" />}
              </div>
              <div className="modal-card-info">
                <span className="modal-card-name">{t.name}</span>
                <button
                  type="button"
                  className="modal-card-add"
                  title="Добавить в пак"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tdoc) return;
                    onSelect(structuredClone(tdoc), t, true);
                  }}
                >
                  <Plus size={14} /> В пак
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
