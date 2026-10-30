import { useMemo, useState } from 'react';
import { ChevronRight, Sparkles, Trash2, User, LayoutGrid } from 'lucide-react';
import { CATALOG, TEMPLATE_CATEGORIES, type CatalogItem, type TemplateCategory } from '../lib/templates';
import type { SubscriptionState } from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';
import { haptic } from '../lib/telegram';
import { LazyThumb } from './LazyThumb';

interface TmaCatalogViewProps {
  subscription: SubscriptionState;
  telegramUser: TelegramUser | null;
  onSelectTemplate: (item: CatalogItem) => void;
  onOpenProfile: () => void;
  onOpenPacks: () => void;
  onOpenEditor: () => void;
}

export function TmaCatalogView({
  subscription,
  telegramUser,
  onSelectTemplate,
  onOpenProfile,
  onOpenPacks,
}: TmaCatalogViewProps) {
  const [activeCat, setActiveCat] = useState<'all' | TemplateCategory>('classic');
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  const filteredItems = useMemo(() => {
    if (activeCat === 'all') return CATALOG;
    return CATALOG.filter((c) => c.category === activeCat);
  }, [activeCat]);

  const currentCatLabel = useMemo(() => {
    return TEMPLATE_CATEGORIES.find((c) => c.id === activeCat)?.label ?? 'классика';
  }, [activeCat]);

  const handlePick = (item: CatalogItem) => {
    haptic('select');
    onSelectTemplate(item);
  };

  return (
    <div className="tma-view-container tma-catalog-view">
      {/* TOP HEADER */}
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

        <div className="tma-balance-pill" onClick={onOpenProfile} title="Баланс генераций">
          <Sparkles size={14} color="#ffd700" />
          <span>{subscription.generationsBalance}</span>
        </div>
      </div>

      {/* TITLE & CATEGORY SELECTOR */}
      <div className="tma-catalog-head">
        <h1 className="tma-catalog-title">шаблоны</h1>

        <div className="tma-cat-dropdown-wrap">
          <button
            type="button"
            className="tma-cat-btn"
            onClick={() => {
              setShowCatDropdown((v) => !v);
              haptic('light');
            }}
          >
            <span className="tma-cat-icon">🔝</span>
            <span>{currentCatLabel}</span>
            <ChevronRight size={14} className={`tma-cat-chevron ${showCatDropdown ? 'open' : ''}`} />
          </button>

          {showCatDropdown && (
            <div className="tma-cat-menu">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className={`tma-cat-menu-item ${activeCat === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCat(cat.id);
                    setShowCatDropdown(false);
                    haptic('select');
                  }}
                >
                  <span>{cat.label}</span>
                  <span className="tma-cat-count">
                    {cat.id === 'all'
                      ? CATALOG.length
                      : CATALOG.filter((c) => c.category === cat.id).length}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3-COLUMN TEMPLATES GRID (Matching Screenshot 1) */}
      <div className="tma-cards-grid">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="tma-card"
            onClick={() => handlePick(item)}
            title={`#${item.num} ${item.name}`}
          >
            <div className="tma-card-thumb">
              <LazyThumb item={item} />
            </div>
          </div>
        ))}
      </div>

      {/* FLOATING BOTTOM DOCK (Matching Screenshot 1) */}
      <div className="tma-dock-wrapper">
        <nav className="tma-floating-dock">
          <button type="button" className="tma-dock-btn active">
            <LayoutGrid size={17} />
            <span>шаблоны</span>
          </button>
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onOpenPacks();
              haptic('select');
            }}
          >
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
        <div className="tma-dock-footer">@magnat_emoji_bot</div>
      </div>
    </div>
  );
}
