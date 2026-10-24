import { Copy, Download, FolderArchive, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { LazyThumb } from './LazyThumb';

export interface PackItem {
  id: string;
  name: string;
  doc: LottieDoc;
}

interface PackTrayProps {
  pack: PackItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onImportFiles: () => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onClearOther: () => void;
  onDownloadZip: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function PackTray({
  pack,
  activeIndex,
  onSelect,
  onAdd,
  onImportFiles,
  onDuplicate,
  onRemove,
  onClearOther,
  onDownloadZip,
  isOpen,
  onToggle,
}: PackTrayProps) {
  return (
    <div className={`pack-tray ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="pack-tray-bar">
        <button type="button" className="pack-toggle-btn" onClick={onToggle}>
          <FolderArchive size={16} />
          <span>Пак эмодзи</span>
          <span className="pack-badge">{pack.length}</span>
          <span className="muted small">{isOpen ? '▾ свернуть' : '▴ развернуть'}</span>
        </button>

        {isOpen && (
          <div className="pack-bar-actions">
            <button
              type="button"
              className="pack-add-btn"
              onClick={onAdd}
              title="Добавить эмодзи из каталога MAGNAT"
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
                title="Оставить только текущий эмодзи в паке"
              >
                <Trash2 size={14} /> Очистить ({pack.length - 1})
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
            const isActive = idx === activeIndex;
            return (
              <div
                key={item.id}
                className={`pack-item-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelect(idx)}
                title={`#${idx + 1}: ${item.name}`}
              >
                <div className="pack-item-thumb">
                  <LazyThumb doc={item.doc} />
                </div>
                <div className="pack-item-info">
                  <span className="pack-item-name">{item.name}</span>
                </div>
                <div className="pack-item-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(idx);
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
                        onRemove(idx);
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
