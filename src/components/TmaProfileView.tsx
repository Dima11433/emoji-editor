import { useState } from 'react';
import {
  ChevronRight,
  CreditCard,
  Crown,
  FileText,
  Layers,
  LayoutGrid,
  Minus,
  Pencil,
  Plus,
  Send,
  Smile,
  Sparkles,
  Square,
  Star,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  activateSubscription,
  addGenerations,
  TIER_PLANS,
  type BillingPeriod,
  type PlanId,
  type SubscriptionState,
} from '../lib/subscription';
import type { TelegramUser } from '../lib/telegram';
import { getTelegramWebApp, haptic } from '../lib/telegram';

interface TmaProfileViewProps {
  subscription: SubscriptionState;
  telegramUser: TelegramUser | null;
  onSubscriptionChange: (next: SubscriptionState) => void;
  onBackToCatalog: () => void;
  onOpenPacks: () => void;
}

function renderBadgeChip(text: string, idx: number) {
  let icon = null;
  if (text.includes('эмодзи в паке')) {
    icon = <LayoutGrid size={11} className="tma-chip-icon" />;
  } else if (text.includes('стикеров в паке')) {
    icon = <Square size={11} className="tma-chip-icon" />;
  } else if (text.includes('шаблонов') || text.includes('шаблоны')) {
    icon = <Layers size={11} className="tma-chip-icon" />;
  } else if (text.includes('стилей') || text.includes('стиль')) {
    icon = <Pencil size={11} className="tma-chip-icon" />;
  } else if (text.includes('свой логотип')) {
    icon = <Smile size={11} className="tma-chip-icon" />;
  } else if (text.includes('веб-редактор') || text.includes('редактор каждого')) {
    icon = <Pencil size={11} className="tma-chip-icon" />;
  } else if (text.includes('сборка') || text.includes('эффекты')) {
    icon = <Zap size={11} className="tma-chip-icon" />;
  } else if (text.includes('экспорт') || text.includes('telegram')) {
    icon = <Send size={11} className="tma-chip-icon" />;
  } else if (text.includes('брифы')) {
    icon = <FileText size={11} className="tma-chip-icon" />;
  }

  return (
    <span key={idx} className="tma-badge-chip">
      {icon}
      <span>{text}</span>
    </span>
  );
}

export function TmaProfileView({
  subscription,
  telegramUser,
  onSubscriptionChange,
  onBackToCatalog,
  onOpenPacks,
}: TmaProfileViewProps) {
  const [periodKey, setPeriodKey] = useState<BillingPeriod>('month');
  const [pieceCount, setPieceCount] = useState<number>(20);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{
    type: 'piece' | 'plan';
    planId?: PlanId;
    title: string;
    rubPrice: number;
    starsPrice: number;
  } | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'stars' | 'cryptobot'>('stars');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const userName = telegramUser?.first_name || 'magnat';
  const userHandle = telegramUser?.username ? `@${telegramUser.username}` : '@ggg468q';
  const isAdmin =
    telegramUser?.id === 6667583896 ||
    telegramUser?.id === 1380263054 ||
    window.location.search.includes('admin=1') ||
    telegramUser?.username?.toLowerCase() === 'ggg468q' ||
    telegramUser?.username?.toLowerCase() === 'dimaz';

  // Calculate piece price: 9 ₽ per unit, >= 50 is 7 ₽
  // 1 звезда = 1,2 ₽ (matching screenshot)
  const unitRate = pieceCount >= 50 ? 7 : 9;
  const pieceRubTotal = pieceCount * unitRate;
  const pieceStarsTotal = Math.max(10, Math.round(pieceRubTotal / 1.2));

  const handleOpenPieceCheckout = () => {
    haptic('medium');
    setCheckoutTarget({
      type: 'piece',
      title: `${pieceCount} генераций`,
      rubPrice: pieceRubTotal,
      starsPrice: pieceStarsTotal,
    });
    setShowCheckoutModal(true);
  };

  const handleOpenPlanCheckout = (planId: PlanId) => {
    if (planId === 'free') return;
    haptic('medium');
    const cfg = TIER_PLANS[planId];
    const p = cfg.prices[periodKey];
    const starsPrice = Math.max(10, Math.round(p.rub / 1.2));
    setCheckoutTarget({
      type: 'plan',
      planId,
      title: `${cfg.name} (${cfg.prices[periodKey].label})`,
      rubPrice: p.rub,
      starsPrice,
    });
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = () => {
    if (!checkoutTarget) return;
    haptic('success');

    if (checkoutTarget.type === 'piece') {
      const next = addGenerations(pieceCount);
      onSubscriptionChange(next);
    } else if (checkoutTarget.planId) {
      const next = activateSubscription(checkoutTarget.planId, periodKey, 'DIRECT_PAY');
      onSubscriptionChange(next);
    }

    const tg = getTelegramWebApp();
    if (tg?.showAlert) {
      tg.showAlert(`🎉 Оплата успешна! Тариф «${checkoutTarget.title}» активирован.`);
    }

    setShowCheckoutModal(false);
  };

  const handlePayStars = async () => {
    if (!checkoutTarget) return;
    haptic('medium');
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/create-stars-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: checkoutTarget.starsPrice,
          title: `MAGNAT ${checkoutTarget.title}`.slice(0, 32),
          description: `Оплата «${checkoutTarget.title}» в MAGNAT Emoji Studio`,
          payload: `sub_${checkoutTarget.type}_${Date.now()}`,
        }),
      });
      const data = await res.json();
      const tg = getTelegramWebApp();
      if (data.ok && data.invoiceLink) {
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceLink, (status: string) => {
            setIsProcessingPayment(false);
            if (status === 'paid') {
              handleConfirmPayment();
            } else if (status === 'cancelled') {
              haptic('warning');
            } else if (status === 'failed') {
              haptic('error');
              if (tg?.showAlert) {
                tg.showAlert('Платеж Telegram Stars не был завершён.');
              }
            }
          });
          return;
        } else {
          window.open(data.invoiceLink, '_blank');
          setIsProcessingPayment(false);
          return;
        }
      } else {
        const msg = data.error || 'Не удалось сформировать счёт Telegram Stars';
        tg?.showAlert ? tg.showAlert(msg) : alert(msg);
      }
    } catch (err) {
      console.warn('Stars invoice API error:', err);
      const tg = getTelegramWebApp();
      const msg = 'Не удалось подключиться к серверу оплаты Telegram Stars.';
      tg?.showAlert ? tg.showAlert(msg) : alert(msg);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePayCrypto = async () => {
    if (!checkoutTarget) return;
    haptic('medium');
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/create-crypto-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: checkoutTarget.rubPrice,
          currency: 'RUB',
          asset: 'USDT',
          description: `MAGNAT: ${checkoutTarget.title}`,
        }),
      });
      const data = await res.json();
      const tg = getTelegramWebApp();
      if (data.ok && (data.miniAppInvoiceUrl || data.botInvoiceUrl || data.payUrl)) {
        const targetUrl = data.miniAppInvoiceUrl || data.botInvoiceUrl || data.payUrl;
        if (tg?.openTelegramLink && targetUrl.startsWith('https://t.me/')) {
          tg.openTelegramLink(targetUrl);
        } else {
          window.open(targetUrl, '_blank');
        }
        setShowCheckoutModal(false);
        const msg = `Счёт на ${(checkoutTarget.rubPrice / 95).toFixed(2)} USDT сформирован в @CryptoBot. Баланс будет пополнен после оплаты счёта!`;
        tg?.showAlert ? tg.showAlert(msg) : alert(msg);
      } else {
        const msg = data.error || 'Не удалось создать счёт в CryptoBot';
        tg?.showAlert ? tg.showAlert(msg) : alert(msg);
      }
    } catch (err) {
      console.warn('Crypto invoice API error:', err);
      const tg = getTelegramWebApp();
      const msg = 'Ошибка при создании счёта CryptoBot.';
      tg?.showAlert ? tg.showAlert(msg) : alert(msg);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="tma-view-container tma-profile-view">
      {/* TOP HEADER (Matching Screenshot 2) */}
      <div className="tma-top-bar">
        <div className="tma-avatar-wrap" onClick={onBackToCatalog} title="Каталог">
          {telegramUser?.photo_url ? (
            <img src={telegramUser.photo_url} alt="User" className="tma-user-avatar" />
          ) : (
            <div className="tma-user-avatar-placeholder">
              {telegramUser?.first_name ? telegramUser.first_name[0].toUpperCase() : 'M'}
            </div>
          )}
        </div>

        <div className="tma-balance-pill">
          <Sparkles size={14} color="#ffd700" />
          <span>{subscription.generationsBalance}</span>
        </div>
      </div>

      <div className="tma-profile-scroll-body">
        {/* TITLE */}
        <h1 className="tma-page-title">профиль</h1>

        {/* HERO AVATAR WITH VERTICAL GLOW LINES (Matching Screenshot 2) */}
        <div className="tma-profile-hero">
          <div className="tma-hero-glow-lines" />
          <div className="tma-hero-avatar-ring">
            {telegramUser?.photo_url ? (
              <img src={telegramUser.photo_url} alt="User" className="tma-hero-avatar-img" />
            ) : (
              <div className="tma-hero-avatar-placeholder">
                <User size={46} color="#ffffff" />
              </div>
            )}
          </div>
          <h2 className="tma-profile-name">{userName}</h2>
          <div className="tma-profile-handle-pill">{userHandle}</div>
          {isAdmin && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(249, 115, 22, 0.18))',
                border: '1px solid rgba(234, 179, 8, 0.45)',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: '#facc15',
                cursor: 'pointer',
              }}
              onClick={() => {
                const tg = getTelegramWebApp();
                if (tg?.openTelegramLink) {
                  tg.openTelegramLink('https://t.me/magnat_emoji_bot?start=admin');
                } else {
                  window.open('https://t.me/magnat_emoji_bot', '_blank');
                }
              }}
            >
              <Crown size={13} color="#facc15" />
              <span>Администратор • Открыть панель бота</span>
            </div>
          )}
        </div>

        {/* CARD 1: БАЛАНС ГЕНЕРАЦИЙ (Matching Screenshot 2) */}
        <div className="tma-card-box tma-balance-card">
          <div className="tma-balance-left">
            <div className="tma-card-sublabel">
              <CreditCard size={14} className="tma-icon-muted" />
              <span>баланс генераций</span>
            </div>
            <div className="tma-balance-number">{subscription.generationsBalance}</div>
          </div>
          <button
            type="button"
            className="tma-btn-blue tma-btn-buy"
            onClick={handleOpenPieceCheckout}
          >
            купить
          </button>
        </div>

        {/* CARD 2: КУПИТЬ ГЕНЕРАЦИИ (Matching Screenshot 2) */}
        <div className="tma-card-box tma-stepper-card">
          <div className="tma-stepper-head">
            <h3 className="tma-card-heading">купить генерации</h3>
            <span className="tma-card-subtext">9 ₽ за штуку · -10% · от 50 по 7 ₽</span>
          </div>

          <div className="tma-stepper-row">
            <div className="tma-counter-control">
              <button
                type="button"
                className="tma-counter-btn"
                onClick={() => {
                  setPieceCount((c) => Math.max(5, c - 5));
                  haptic('select');
                }}
                aria-label="Уменьшить"
              >
                <Minus size={16} strokeWidth={2.4} />
              </button>
              <span className="tma-counter-val">{pieceCount}</span>
              <button
                type="button"
                className="tma-counter-btn"
                onClick={() => {
                  setPieceCount((c) => c + 5);
                  haptic('select');
                }}
                aria-label="Увеличить"
              >
                <Plus size={16} strokeWidth={2.4} />
              </button>
            </div>

            <button
              type="button"
              className="tma-btn-blue tma-btn-pay-stepper"
              onClick={handleOpenPieceCheckout}
            >
              оплатить {pieceRubTotal} ₽
            </button>
          </div>
        </div>

        {/* SECTION 3: ПОДПИСКА (Matching Screenshots 2, 3, 4, 5) */}
        <div className="tma-subs-section">
          <div className="tma-subs-head">
            <h3 className="tma-section-title">подписка</h3>
            <span className="tma-subs-subtext">
              генерации каждый месяц дешевле, чем поштучно
            </span>
          </div>

          {/* PERIOD TABS: месяц | 3 месяца -15% | год -30% */}
          <div className="tma-period-tabs">
            <button
              type="button"
              className={`tma-period-tab ${periodKey === 'month' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('month');
                haptic('select');
              }}
            >
              месяц
            </button>
            <button
              type="button"
              className={`tma-period-tab ${periodKey === '3months' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('3months');
                haptic('select');
              }}
            >
              3 месяца <span className="tma-discount-tag">-15%</span>
            </button>
            <button
              type="button"
              className={`tma-period-tab ${periodKey === 'year' ? 'active' : ''}`}
              onClick={() => {
                setPeriodKey('year');
                haptic('select');
              }}
            >
              год <span className="tma-discount-tag">-30%</span>
            </button>
          </div>

          {/* PLAN CARDS */}
          {/* 1. PRO */}
          <div
            className={`tma-plan-card ${subscription.plan === 'pro' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('pro')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <span className="tma-plan-title">Pro</span>
                <span className="tma-plan-subtitle">{TIER_PLANS.pro.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.pro.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 месяца' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.pro.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.pro.badges.map((b, idx) => renderBadgeChip(b, idx))}
            </div>
          </div>

          {/* 2. PRO+ */}
          <div
            className={`tma-plan-card ${subscription.plan === 'pro_plus' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('pro_plus')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tma-plan-title">Pro+</span>
                  <span className="tma-badge-pill-cyan">выгодно</span>
                </div>
                <span className="tma-plan-subtitle">{TIER_PLANS.pro_plus.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.pro_plus.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 месяца' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.pro_plus.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.pro_plus.badges.map((b, idx) => renderBadgeChip(b, idx))}
            </div>
          </div>

          {/* 3. MAX */}
          <div
            className={`tma-plan-card ${subscription.plan === 'max' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('max')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="tma-plan-title">Max</span>
                  <span className="tma-badge-pill-cyan">популярный</span>
                </div>
                <span className="tma-plan-subtitle">{TIER_PLANS.max.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.max.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 месяца' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.max.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.max.badges.map((b, idx) => renderBadgeChip(b, idx))}
            </div>
          </div>

          {/* 4. РЕДАКТОР */}
          <div
            className={`tma-plan-card ${subscription.plan === 'editor' ? 'is-current' : ''}`}
            onClick={() => handleOpenPlanCheckout('editor')}
          >
            <div className="tma-plan-card-top">
              <div className="tma-plan-title-block">
                <span className="tma-plan-title">Редактор</span>
                <span className="tma-plan-subtitle">{TIER_PLANS.editor.subtitle}</span>
              </div>
              <div className="tma-plan-price-block">
                <span className="tma-plan-price-num">
                  {TIER_PLANS.editor.prices[periodKey].rub} ₽
                </span>
                <span className="tma-plan-price-sub">
                  {periodKey === 'month' ? 'в месяц' : periodKey === '3months' ? 'за 3 месяца' : 'за год'}
                </span>
              </div>
            </div>

            <div className="tma-plan-highlight">{TIER_PLANS.editor.highlight}</div>

            <div className="tma-plan-badges-wrap">
              {TIER_PLANS.editor.badges.map((b, idx) => renderBadgeChip(b, idx))}
            </div>
          </div>
        </div>

        {/* SECTION 4: АККАУНТ (Matching Screenshot 4) */}
        <div className="tma-account-section">
          <div className="tma-section-title">аккаунт</div>

          <div className="tma-card-box tma-account-current-card">
            <div>
              <div className="tma-account-status-name">текущий</div>
              <div className="tma-account-status-desc">
                {subscription.plan === 'free'
                  ? 'бесплатный · 1 пробный экспорт'
                  : `активен тариф ${subscription.plan.toUpperCase()}`}
              </div>
            </div>
            <div className="tma-account-gens-count">
              {subscription.plan === 'max' || subscription.plan === 'lifetime'
                ? '∞ генераций'
                : `${subscription.generationsBalance} генераций`}
            </div>
          </div>

          <div
            className="tma-card-box tma-account-link-row"
            onClick={() => {
              handleOpenPlanCheckout('pro');
            }}
          >
            <span>бесплатно и проба</span>
            <ChevronRight size={18} className="tma-icon-muted" />
          </div>


        </div>



        <div style={{ height: 100 }} />
      </div>

      {/* FLOATING BOTTOM DOCK (Matching Screenshot 2) */}
      <div className="tma-dock-wrapper">
        <nav className="tma-floating-dock">
          <button
            type="button"
            className="tma-dock-btn"
            onClick={() => {
              onBackToCatalog();
              haptic('select');
            }}
          >
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
          <button type="button" className="tma-dock-btn active">
            <User size={17} />
            <span>профиль</span>
          </button>
        </nav>
        <div className="tma-dock-footer">@magnat_emoji_bot</div>
      </div>

      {/* CHECKOUT MODAL (STARS & CRYPTOBOT ONLY — matching screenshot media_1793367256359_d9089ade.png) */}
      {showCheckoutModal && checkoutTarget && (
        <div className="sub-modal-backdrop" onClick={() => setShowCheckoutModal(false)}>
          <div className="sub-modal-window tma-pay-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tma-pay-modal-top-row">
              <h2 className="tma-pay-modal-title">способы оплаты</h2>
              <button
                type="button"
                className="sub-close-btn"
                onClick={() => setShowCheckoutModal(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="tma-pay-summary-line">
              <span>Тариф: <strong>{checkoutTarget.title}</strong></span>
              <span className="tma-pay-total-badge">{checkoutTarget.rubPrice} ₽</span>
            </div>

            {/* 2-COLUMN GRID (ЗВЁЗДЫ & CRYPTOBOT ONLY) */}
            <div className="tma-pay-methods-grid">
              {/* CARD 1: ЗВЁЗДЫ */}
              <div
                className={`tma-pay-card ${paymentMethod === 'stars' ? 'selected' : ''}`}
                onClick={() => {
                  setPaymentMethod('stars');
                  haptic('select');
                }}
              >
                <div className="tma-pay-card-left">
                  <span className="tma-pay-card-title">Звёзды</span>
                  <span className="tma-pay-card-sub">1 звезда = 1,2 ₽</span>
                </div>
                <div className="tma-pay-art tma-pay-art-star">
                  <svg viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="tmaStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFE033" />
                        <stop offset="65%" stopColor="#FFB300" />
                        <stop offset="100%" stopColor="#FF8F00" />
                      </linearGradient>
                      <linearGradient id="tmaStarShine" x1="0%" y1="0%" x2="40%" y2="40%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M50 8 L62 33 L90 37 L70 57 L75 85 L50 71 L25 85 L30 57 L10 37 L38 33 Z"
                      fill="url(#tmaStarGrad)"
                      stroke="#FFF7C2"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    <path d="M50 12 L60 33 L85 36 L66 54 L50 24 Z" fill="url(#tmaStarShine)" />
                  </svg>
                </div>
              </div>

              {/* CARD 2: CRYPTOBOT */}
              <div
                className={`tma-pay-card ${paymentMethod === 'cryptobot' ? 'selected' : ''}`}
                onClick={() => {
                  setPaymentMethod('cryptobot');
                  haptic('select');
                }}
              >
                <div className="tma-pay-card-left">
                  <span className="tma-pay-card-title">CryptoBot</span>
                  <span className="tma-pay-card-sub">оплата криптой</span>
                </div>
                <div className="tma-pay-art tma-pay-art-crypto">
                  <svg viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="tmaCryptoDisc" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="55%" stopColor="#0284C7" />
                        <stop offset="100%" stopColor="#0369A1" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="50"
                      cy="50"
                      r="43"
                      fill="url(#tmaCryptoDisc)"
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="2"
                    />
                    <path d="M30 38 L50 64 L70 38 L58 38 L50 49 L42 38 Z" fill="#FFFFFF" />
                    <path d="M50 49 L70 38 L58 38 Z" fill="#BAE6FD" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ACTION BUTTON */}
            {paymentMethod === 'stars' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="tma-btn-blue tma-btn-pay-action"
                  disabled={isProcessingPayment}
                  onClick={handlePayStars}
                >
                  <Star size={16} fill="#fff" color="#fff" />
                  {isProcessingPayment ? 'Создание счёта...' : `Оплатить ${checkoutTarget.starsPrice} Stars`}
                </button>
                <span className="tma-pay-note">
                  Списание с баланса Telegram в 1 клик • 0% комиссий
                </span>
              </div>
            )}

            {paymentMethod === 'cryptobot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="tma-btn-blue tma-btn-pay-action tma-btn-crypto-pay"
                  disabled={isProcessingPayment}
                  onClick={handlePayCrypto}
                >
                  <Wallet size={16} />
                  {isProcessingPayment
                    ? 'Создание счёта...'
                    : `Оплатить ${(checkoutTarget.rubPrice / 95).toFixed(2)} USDT в CryptoBot`}
                </button>
                <span className="tma-pay-note">
                  USDT, TON, BTC через официального @CryptoBot
                </span>
              </div>
            )}


          </div>
        </div>
      )}
    </div>
  );
}
