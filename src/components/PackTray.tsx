import { Check, CheckSquare, Copy, Download, FolderArchive, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { LazyThumb } from './LazyThumb';

export interface PackItem {
  id: string;
  name: string;
  catalogId: string | null;
  doc: LottieDoc;
}

interface PackTrayProps {
  pack: PackItem[];
  selectedIds: string[];
  primaryId: string;
  onSelect: (id: string, toggleMulti: boolean) => void;
  onSelectAll: () => void;
  onCollapseSelection: () => void;
  onAdd: () => void;
  onImportFiles: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onClearOther: () => void;
  onDownloadZip: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function PackTray({
  pack,
  selectedIds,
  primaryId,
  onSelect,
  onSelectAll,
  onCollapseSelection,
  onAdd,
  onImportFiles,
  onDuplicate,
  onRemove,
  onClearOther,
  onDownloadZip,
  isOpen,
  onToggle,
}: PackTrayProps) {
  const selectedSet = new Set(selectedIds);
  const allSelected = pack.length > 1 && selectedIds.length === pack.length;

  return (
    <div className={`pack-tray ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="pack-tray-bar">
        <button type="button" className="pack-toggle-btn" onClick={onToggle}>
          <FolderArchive size={16} />
          <span>Пак эмодзи</span>
          <span className="pack-badge">{pack.length}</span>
          {selectedIds.length > 1 && (
            <span className="pack-sel-pill">выбрано {selectedIds.length}</span>
          )}
          <span className="muted small">{isOpen ? '▾ свернуть' : '▴ развернуть'}</span>
        </button>

        {isOpen && (
          <div className="pack-bar-actions">
            {pack.length > 1 && (
              <button
                type="button"
                className={`pack-add-btn ${allSelected ? 'active-chip' : ''}`}
                onClick={allSelected ? onCollapseSelection : onSelectAll}
                title={
                  allSelected
                    ? 'Оставить выбранным только 1 эмодзи'
                    : 'Выбрать все эмодзи в паке для одновременного редактирования'
                }
              >
                {allSelected ? <X size={14} /> : <CheckSquare size={14} />}
                <span>
                  {allSelected ? 'Оставить 1' : `Выбрать все (${pack.length})`}
                </span>
              </button>
            )}
            <button
              type="button"
              className="pack-add-btn"
              onClick={onAdd}
              title="Добавить эмодзи из каталога"
            >
              <Plus size={14} /> Из каталога
            </button>
            <button
              type="button"
              className="pack-add-btn"
              onClick={onImportFiles}
              title="Импортировать .tgs, .json или целый .zip архив"
            >
              <FolderOpen size={14} /> Импорт .zip/.tgs
            </button>
            {pack.length > 1 && (
              <button
                type="button"
                className="pack-add-btn danger-hover"
                onClick={onClearOther}
                title="Оставить в паке только выбранные эмодзи"
              >
                <Trash2 size={14} /> Убрать невыбранные
              </button>
            )}
            <button
              type="button"
              className="pack-zip-btn"
              onClick={onDownloadZip}
              title="Скачать весь пак готовых .tgs файлов в .zip архиве"
            >
              <Download size={14} /> Скачать пак .zip ({pack.length})
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="pack-items-scroll">
          {pack.map((item, idx) => {
            const isSelected = selectedSet.has(item.id);
            const isPrimary = item.id === primaryId;
            return (
              <div
                key={item.id}
                className={`pack-item-card ${isSelected ? 'active' : ''} ${isPrimary && selectedIds.length > 1 ? 'primary-focus' : ''}`}
                onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                title={`#${idx + 1}: ${item.name} (клик по галочке — мультивыбор)`}
              >
                <div className="pack-item-thumb">
                  <LazyThumb doc={item.doc} />
                  <button
                    type="button"
                    className={`card-check-btn ${isSelected ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(item.id, true);
                    }}
                    title={isSelected ? 'Убрать из мультивыбора' : 'Добавить к мультивыбору'}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </button>
                </div>
                <div className="pack-item-info">
                  <span className="pack-item-name">{item.name}</span>
                </div>
                <div className="pack-item-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(item.id);
                    }}
                    title="Дублировать"
                  >
                    <Copy size={12} />
                  </button>
                  {pack.length > 1 && (
                    <button
                      type="button"
                      className="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                      }}
                      title="Убрать из пака"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="pack-add-card"
            onClick={onAdd}
            title="Добавить эмодзи из каталога"
          >
            <Plus size={22} />
            <span>Добавить</span>
          </button>
        </div>
      )}
    </div>
  );
}
