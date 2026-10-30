import { Download, LayoutGrid, Send, Trash2, User } from 'lucide-react';
import type { PackItem } from './PackTray';
import { haptic } from '../lib/telegram';
import { LazyThumb } from './LazyThumb';

interface TmaPacksViewProps {
  pack: PackItem[];
  onOpenCatalog: () => void;
  onOpenProfile: () => void;
  onOpenEditorForSticker: (item: PackItem) => void;
  onDownloadZip: () => void;
  onRemoveSticker: (id: string) => void;
  onClearPack: () => void;
}

export function TmaPacksView({
  pack,
  onOpenCatalog,
  onOpenProfile,
  onOpenEditorForSticker,
  onDownloadZip,
  onRemoveSticker,
  onClearPack,
}: TmaPacksViewProps) {
  return (
    <div className="tma-view-container tma-packs-view">
      <div className="tma-top-bar">
        <h1 className="tma-page-title" style={{ margin: 0 }}>мои паки</h1>
        <span className="tma-cat-count" style={{ fontSize: '13px', padding: '4px 10px' }}>
          {pack.length} эмодзи
        </span>
      </div>

      <div className="tma-packs-scroll-body">
        {pack.length === 0 ? (
          <div className="tma-packs-empty">
            <div style={{ fontSize: '36px', marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
              Ваш пак пока пуст
            </div>
            <div style={{ fontSize: '13px', color: '#848c9e', marginBottom: 20 }}>
              Выберите шаблоны в каталоге, настройте свой никнейм и соберите свой собственный пак!
            </div>
            <button
              type="button"
              className="tma-btn-blue"
              onClick={() => {
                onOpenCatalog();
                haptic('select');
              }}
            >
              <LayoutGrid size={16} /> Перейти к шаблонам
            </button>
          </div>
        ) : (
          <>
            <div className="tma-packs-actions-row">
              <button
                type="button"
                className="tma-btn-blue"
                onClick={() => {
                  onDownloadZip();
                  haptic('medium');
                }}
              >
                <Download size={15} /> Скачать ZIP ({pack.length})
              </button>
              <button
                type="button"
                className="tma-btn-secondary"
                onClick={() => {
                  window.open('https://t.me/Stickers', '_blank');
                  haptic('light');
                }}
              >
                <Send size={15} /> Бот @Stickers
              </button>
            </div>

            <div className="tma-packs-grid">
              {pack.map((item) => (
                <div key={item.id} className="tma-pack-item-card">
                  <div
                    className="tma-pack-item-thumb"
                    onClick={() => {
                      onOpenEditorForSticker(item);
                      haptic('select');
                    }}
                  >
                    <LazyThumb doc={item.doc} />
                  </div>
                  <div className="tma-pack-item-info">
                    <span className="tma-pack-item-name">{item.name}</span>
                    <button
                      type="button"
                      className="tma-pack-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSticker(item.id);
                        haptic('light');
                      }}
                      title="Удалить из пака"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 100px 0' }}>
              <button
                type="button"
                className="sub-btn-ghost-small"
                onClick={onClearPack}
              >
                Очистить весь пак
              </button>
            </div>
          </>
        )}
      </div>

      {/* FLOATING BOTTOM DOCK */}
      <div className="tma-dock-wrapper">
        <nav className="tma-floating-dock">
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onOpenCatalog();
              haptic('select');
            }}
          >
            <LayoutGrid size={17} />
            <span>шаблоны</span>
          </button>
          <button type="button" className="tma-dock-btn active">
            <Trash2 size={17} />
            <span>мои паки</span>
          </button>
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onOpenProfile();
              haptic('select');
            }}
          >
            <User size={17} />
            <span>профиль</span>
          </button>
        </nav>
        <div className="tma-dock-footer">@tierubot</div>
      </div>
    </div>
  );
}
