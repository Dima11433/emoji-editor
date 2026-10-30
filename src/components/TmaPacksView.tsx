import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type { PackItem } from './PackTray';
import type { SubscriptionState } from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';
import { haptic } from '../lib/telegram';
import { LazyThumb } from './LazyThumb';

interface PackEntry {
  id: string;
  name: string;
  botTag: string;
  count: number;
  stickers?: PackItem[];
}

interface TmaPacksViewProps {
  pack: PackItem[];
  subscription?: SubscriptionState;
  telegramUser?: TelegramUser | null;
  onOpenCatalog: () => void;
  onOpenProfile: () => void;
  onOpenEditorForSticker: (item: PackItem) => void;
  onDownloadZip: () => void;
  onRemoveSticker: (id: string) => void;
  onClearPack: () => void;
}

function StackedThumbnail({
  firstSticker,
  fallbackText,
}: {
  firstSticker?: PackItem;
  fallbackText: string;
}) {
  return (
    <div className="tma-pack-stack-wrap">
      <div className="tma-pack-stack-layer layer-back" />
      <div className="tma-pack-stack-layer layer-mid" />
      <div className="tma-pack-stack-layer layer-front">
        {firstSticker ? (
          <div style={{ width: '80%', height: '80%' }}>
            <LazyThumb doc={firstSticker.doc} />
          </div>
        ) : (
          <div className="tma-pack-stack-fallback">
            {fallbackText.slice(0, 2).toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}

export function TmaPacksView({
  pack,
  subscription,
  telegramUser,
  onOpenCatalog,
  onOpenProfile,
  onOpenEditorForSticker,
  onDownloadZip,
  onRemoveSticker,
  onClearPack,
}: TmaPacksViewProps) {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // List of packs matching Screenshot media_1793367215727_cb60614d.png
  const packList: PackEntry[] = [
    {
      id: 'current',
      name: 'ohhpoi',
      botTag: '@tierubot',
      count: pack.length > 0 ? pack.length : 11,
      stickers: pack,
    },
    {
      id: 'ueud',
      name: 'ueud',
      botTag: '@tierubot',
      count: 8,
    },
    {
      id: 'mgg',
      name: 'mgg',
      botTag: '@tierubot',
      count: 3,
    },
  ];

  const activePack = packList.find((p) => p.id === selectedPackId);

  return (
    <div className="tma-view-container tma-packs-view">
      {/* TOP BAR (Avatar + Balance) */}
      <div className="tma-top-bar">
        <div className="tma-avatar-wrap" onClick={onOpenProfile} title="Профиль">
          {telegramUser?.photo_url ? (
            <img src={telegramUser.photo_url} alt="User" className="tma-user-avatar" />
          ) : (
            <div className="tma-user-avatar-placeholder">
              {telegramUser?.first_name ? telegramUser.first_name[0].toUpperCase() : 'M'}
            </div>
          )}
        </div>

        <div className="tma-balance-pill" onClick={onOpenProfile} title="Баланс">
          <Sparkles size={14} color="#ffd700" />
          <span>{subscription?.generationsBalance ?? 0}</span>
        </div>
      </div>

      <div className="tma-packs-scroll-body">
        {/* TITLE */}
        {selectedPackId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 16px 0' }}>
            <button
              type="button"
              className="tma-nav-back-btn"
              onClick={() => {
                setSelectedPackId(null);
                haptic('light');
              }}
            >
              <ArrowLeft size={16} />
              <span>назад</span>
            </button>
            <h1 className="tma-page-title" style={{ margin: 0, fontSize: 24 }}>
              {activePack?.name}
            </h1>
          </div>
        ) : (
          <h1 className="tma-page-title">мои паки</h1>
        )}

        {/* VIEW 1: PACKS LIST (Exact match to screenshot media_1793367215727_cb60614d.png) */}
        {!selectedPackId && (
          <div className="tma-packs-list-card">
            {packList.map((item) => (
              <div
                key={item.id}
                className="tma-pack-row-item"
                onClick={() => {
                  setSelectedPackId(item.id);
                  haptic('select');
                }}
              >
                <div className="tma-pack-row-left">
                  <StackedThumbnail
                    firstSticker={item.id === 'current' ? pack[0] : undefined}
                    fallbackText={item.name}
                  />
                  <div className="tma-pack-row-text">
                    <span className="tma-pack-row-title">
                      {item.name} · сделано в {item.botTag}
                    </span>
                    <span className="tma-pack-row-subtitle">
                      эмодзи · {item.count} штук
                    </span>
                  </div>
                </div>

                <ChevronRight size={18} className="tma-icon-muted" />
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: PACK DETAIL (STICKERS GRID & EXPORT) */}
        {selectedPackId && (
          <div>
            <div className="tma-packs-actions-row">
              <button
                type="button"
                className="tma-btn-blue"
                onClick={() => {
                  onDownloadZip();
                  haptic('medium');
                }}
              >
                <Download size={15} /> Скачать ZIP ({pack.length || activePack?.count})
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

            {pack.length === 0 ? (
              <div className="tma-packs-empty">
                <div style={{ fontSize: '32px', marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  В паке пока нет собственных стикеров
                </div>
                <div style={{ fontSize: '13px', color: '#848c9e', marginBottom: 18 }}>
                  Выберите шаблоны в каталоге и добавьте их в свой пак!
                </div>
                <button
                  type="button"
                  className="tma-btn-blue"
                  onClick={() => {
                    onOpenCatalog();
                    haptic('select');
                  }}
                >
                  <LayoutGrid size={15} /> Выбрать шаблоны
                </button>
              </div>
            ) : (
              <>
                <div className="tma-packs-grid">
                  {pack.map((sticker) => (
                    <div key={sticker.id} className="tma-pack-item-card">
                      <div
                        className="tma-pack-item-thumb"
                        onClick={() => {
                          onOpenEditorForSticker(sticker);
                          haptic('select');
                        }}
                      >
                        <LazyThumb doc={sticker.doc} />
                      </div>
                      <div className="tma-pack-item-info">
                        <span className="tma-pack-item-name">{sticker.name}</span>
                        <button
                          type="button"
                          className="tma-pack-item-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSticker(sticker.id);
                            haptic('light');
                          }}
                          title="Удалить"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 100px 0' }}>
                  <button
                    type="button"
                    className="sub-btn-ghost-small"
                    onClick={onClearPack}
                  >
                    Очистить стикеры
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ height: 100 }} />
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
