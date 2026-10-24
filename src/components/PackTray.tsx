import { Copy, Download, FolderArchive, Plus, Trash2 } from 'lucide-react';
import type { LottieDoc } from '../lib/lottie';
import { Thumb } from './Preview';

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
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onDownloadZip: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function PackTray({
  pack,
  activeIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onDownloadZip,
  isOpen,
  onToggle,
}: PackTrayProps) {
  return (
    <div className={`pack-tray ${isOpen ? 'open' : 'collapsed'}`}>
      <div className="pack-tray-bar">
        <button type="button" className="pack-toggle-btn" onClick={onToggle}>
          <FolderArchive size={16} />
          <span>Стикерпак</span>
          <span className="pack-badge">{pack.length}</span>
        </button>

        {isOpen && (
          <div className="pack-bar-actions">
            <button
              type="button"
              className="pack-add-btn"
              onClick={onAdd}
              title="Добавить новый стикер в пак"
            >
              <Plus size={15} /> Добавить
            </button>
            <button
              type="button"
              className="pack-zip-btn"
              onClick={onDownloadZip}
              title="Скачать все стикеры архивом .zip"
            >
              <Download size={15} /> Скачать пак (.zip)
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
                title={`Стикер #${idx + 1}: ${item.name}`}
              >
                <div className="pack-item-thumb">
                  <Thumb doc={item.doc} />
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
                    title="Дублировать стикер"
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
                      title="Удалить стикер из пака"
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
            title="Добавить стикер из шаблонов"
          >
            <Plus size={24} />
            <span>Новый</span>
          </button>
        </div>
      )}
    </div>
  );
}
